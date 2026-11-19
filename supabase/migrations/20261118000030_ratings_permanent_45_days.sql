-- Stars are counted for good, guest data is not. Guest data (phone numbers, names, drafts, offer codes) is deleted after 45 days.
-- Star counts live in rating_daily (numbers only, no person). One person counts once: the same phone number or device
-- cannot add a second star for the same business within 45 days.
-- NOT YET APPLIED to the database: run it in the Supabase SQL editor (or approve it when asked).

alter table review_drafts add column if not exists ident text;
create index if not exists review_drafts_ident_idx on review_drafts (client_id, ident, created_at) where ident is not null;

create table if not exists rating_daily (
  client_id uuid not null references clients on delete cascade,
  day date not null,
  star smallint not null check (star between 1 and 5),
  n int not null default 0,
  copied_n int not null default 0,
  primary key (client_id, day, star)
);
alter table rating_daily enable row level security;
drop policy if exists rating_daily_read on rating_daily;
create policy rating_daily_read on rating_daily for select to authenticated using (is_member(client_id));

-- Keep the numbers that already exist, before the 45 day clean-up starts.
insert into rating_daily (client_id, day, star, n, copied_n)
select client_id, (created_at at time zone 'Asia/Kolkata')::date, rating, count(*), count(*) filter (where copied)
  from review_drafts group by 1, 2, 3
on conflict (client_id, day, star) do nothing;

create or replace function public.review_drafts_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ident is null or not exists (select 1 from review_drafts d where d.client_id = new.client_id and d.ident = new.ident and d.id <> new.id and d.created_at >= now() - interval '45 days') then
    insert into rating_daily (client_id, day, star, n) values (new.client_id, (new.created_at at time zone 'Asia/Kolkata')::date, new.rating, 1)
    on conflict (client_id, day, star) do update set n = rating_daily.n + 1;
  end if;
  return new;
end $$;
revoke execute on function public.review_drafts_count() from public, anon, authenticated;
drop trigger if exists review_drafts_count_ins on review_drafts;
create trigger review_drafts_count_ins after insert on review_drafts for each row execute function public.review_drafts_count();

create or replace function public.review_drafts_copied() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into rating_daily (client_id, day, star, n, copied_n) values (new.client_id, (new.created_at at time zone 'Asia/Kolkata')::date, new.rating, 0, 1)
  on conflict (client_id, day, star) do update set copied_n = rating_daily.copied_n + 1;
  return new;
end $$;
revoke execute on function public.review_drafts_copied() from public, anon, authenticated;
drop trigger if exists review_drafts_copied_upd on review_drafts;
create trigger review_drafts_copied_upd after update of copied on review_drafts for each row when (new.copied and not old.copied) execute function public.review_drafts_copied();

drop function if exists public.guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb, text);
create or replace function public.guest_save_review(p_client uuid, p_code text, p_rating int, p_answers jsonb, p_draft text, p_provider text, p_language text, p_name text, p_shingles jsonb, p_ident text default null, p_key text default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare rid uuid;
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  if p_language is not null and p_language not in ('en', 'hi', 'hinglish') then raise exception 'bad language'; end if;
  if not guest_rate_ok(p_client, 'review_drafts', 300, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into review_drafts (client_id, plate_code, rating, answers, draft, provider, language, guest_name, shingles, ident)
  values (p_client, p_code, p_rating, coalesce(p_answers, '{}'), left(p_draft, 2000), p_provider, p_language, left(p_name, 40), p_shingles, nullif(left(p_ident, 80), ''))
  returning id into rid;
  return rid;
end $$;
revoke execute on function public.guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb, text, text) from public;
grant execute on function public.guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb, text, text) to anon, authenticated;

create or replace function public.guest_review_status(p_client uuid, p_ident text, p_key text) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  if nullif(p_ident, '') is null then return 'none'; end if;
  if exists (select 1 from review_drafts where client_id = p_client and ident = p_ident and copied and created_at >= now() - interval '45 days') then return 'published'; end if;
  if exists (select 1 from review_drafts where client_id = p_client and ident = p_ident and created_at >= now() - interval '45 days') then return 'rated'; end if;
  return 'none';
end $$;
revoke execute on function public.guest_review_status(uuid, text, text) from public;
grant execute on function public.guest_review_status(uuid, text, text) to anon, authenticated;

create or replace function public.purge_old_contacts() returns integer
language plpgsql security definer set search_path = public as $$
declare days int; n int; m int;
begin
  select coalesce((value #>> '{}')::int, 45) into days from app_settings where key = 'contact_retention_days';
  days := greatest(7, least(365, coalesce(days, 45)));
  delete from contacts where last_seen_at < now() - make_interval(days => days);
  get diagnostics n = row_count;
  delete from review_drafts where created_at < now() - make_interval(days => days);
  get diagnostics m = row_count;
  delete from hub_claims where created_at < now() - make_interval(days => days);
  return n + m;
end $$;
revoke all on function public.purge_old_contacts() from public, anon, authenticated;

-- The Jaipur ranking reads the permanent star counts (last 90 days), so the 45 day clean-up does not change it.
create or replace function public.hub_ranked(p_area text, p_cat text)
returns table (client_id uuid, slug text, name text, area_id text, area_name text, category text, rating numeric, guests int, score numeric, rank bigint)
language sql stable security definer set search_path = public as $$
  with base as (
    select c.id, c.slug, c.name, c.hub_area, a.name as an, c.business_type as cat
      from clients c join hub_areas a on a.id = c.hub_area
     where c.hub_listed and client_is_live(c) and (p_area is null or c.hub_area = p_area) and (p_cat is null or c.business_type = p_cat)
  ), r as (
    select d.client_id as cid, (sum(d.star * d.n)::numeric / nullif(sum(d.n), 0)) as avg_r, coalesce(sum(d.n), 0)::int as n
      from rating_daily d where d.day >= current_date - 90 and d.client_id in (select id from base) group by 1
  ), v as (
    select x.client_id as cid, count(*)::int as used from hub_claims x
     where x.redeemed_at >= now() - interval '30 days' and x.client_id in (select id from base) group by 1
  ), s as (
    select b.*, coalesce(r.n, 0) as n, r.avg_r,
           ((coalesce(r.avg_r, 0) * coalesce(r.n, 0) + 4.0 * 10) / (coalesce(r.n, 0) + 10)) as bay,
           coalesce(v.used, 0) as used
      from base b left join r on r.cid = b.id left join v on v.cid = b.id
  ), t as (
    select s.*, (0.7 * (s.bay / 5 * 100) + 0.3 * (least(s.used, 50) / 50.0 * 100)) as sc from s
  )
  select t.id, t.slug, t.name, t.hub_area, t.an, t.cat, round(coalesce(t.avg_r, 0), 1), t.n, round(t.sc, 1),
         rank() over (order by t.sc desc, t.n desc)
    from t;
$$;
revoke execute on function public.hub_ranked(text, text) from public, anon, authenticated;

create or replace function public.hub_place(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients; rk record; total int;
begin
  select * into c from clients where slug = lower(p_slug) and hub_listed;
  if c.id is null or not client_is_live(c) then return null; end if;
  select * into rk from hub_ranked(c.hub_area, c.business_type) where client_id = c.id;
  select count(*) into total from hub_ranked(c.hub_area, c.business_type);
  return jsonb_build_object(
    'name', c.name, 'slug', c.slug, 'tagline', c.tagline, 'logo_url', c.logo_url,
    'area', (select name from hub_areas where id = c.hub_area), 'category', (select label from business_templates where id = c.business_type),
    'instagram', c.socials->>'instagram', 'maps', c.socials->>'maps', 'phone', c.socials->>'phone',
    'rating', rk.rating, 'guests', coalesce(rk.guests, 0), 'rank', rk.rank, 'total', total,
    'total_guests', (select coalesce(sum(n), 0) from rating_daily where client_id = c.id),
    'offers', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'ends_on', o.ends_on, 'follow_first', o.follow_first,
                 'title', case when o.follow_first then null else o.title end) order by o.ends_on), '[]'::jsonb)
                 from hub_offers o where o.client_id = c.id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date));
end $$;
