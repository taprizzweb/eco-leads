-- Jaipur hub (working name "Jaipur Ki Raay"): a public guide of listed businesses by area, ranked from real guest ratings,
-- with limited special offers that unlock after the guest taps the business's Instagram page, and a code the shop checks at the counter.
-- Special offers are NOT sent on WhatsApp. WhatsApp offers stay a separate, approved tool.

create table if not exists hub_areas (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  sort int not null default 100,
  active boolean not null default true
);
insert into hub_areas (id, name, sort) values
  ('bajaj-nagar', 'Bajaj Nagar', 10), ('c-scheme', 'C-Scheme', 11), ('malviya-nagar', 'Malviya Nagar', 12), ('vaishali-nagar', 'Vaishali Nagar', 13),
  ('mansarovar', 'Mansarovar', 14), ('jagatpura', 'Jagatpura', 15), ('tonk-road', 'Tonk Road', 16), ('raja-park', 'Raja Park', 17),
  ('jhotwara', 'Jhotwara', 18), ('civil-lines', 'Civil Lines', 19), ('sodala', 'Sodala', 20), ('pratap-nagar', 'Pratap Nagar', 21),
  ('sitapura', 'Sitapura', 22), ('ajmer-road', 'Ajmer Road', 23), ('gopalpura', 'Gopalpura', 24), ('vidhyadhar-nagar', 'Vidhyadhar Nagar', 25),
  ('nirman-nagar', 'Nirman Nagar', 26), ('amer-road', 'Amer Road', 27), ('jawahar-circle', 'Jawahar Circle', 28), ('mi-road', 'MI Road', 29)
on conflict (id) do nothing;
alter table hub_areas enable row level security;
drop policy if exists hub_areas_read on hub_areas;
create policy hub_areas_read on hub_areas for select to authenticated using (true);
drop policy if exists hub_areas_write on hub_areas;
create policy hub_areas_write on hub_areas for all to authenticated using (is_team('manager')) with check (is_team('manager'));

alter table clients add column if not exists hub_area text references hub_areas(id) on delete set null;
alter table clients add column if not exists hub_listed boolean not null default false;
create index if not exists clients_hub_idx on clients (hub_area) where hub_listed;

-- Owners may not list themselves, move area, or join a chain. Only the Taprizz team does.
create or replace function public.guard_client_hub_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_team('rep') and (new.hub_listed is distinct from old.hub_listed or new.hub_area is distinct from old.hub_area or new.group_id is distinct from old.group_id) then
    raise exception 'Only the Taprizz team can change this';
  end if;
  return new;
end $$;
revoke execute on function public.guard_client_hub_fields() from public, anon, authenticated;
drop trigger if exists clients_guard_hub on clients;
create trigger clients_guard_hub before update on clients for each row execute function public.guard_client_hub_fields();

create table if not exists hub_offers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  kind text not null check (kind in ('new_year', 'diwali', 'festival', 'new_launch', 'new_product', 'other')),
  title text not null check (char_length(title) between 3 and 70),
  details text check (details is null or char_length(details) <= 300),
  starts_on date not null default current_date,
  ends_on date not null,
  follow_first boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'live', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 45)
);
create index if not exists hub_offers_client_idx on hub_offers (client_id);
create index if not exists hub_offers_status_idx on hub_offers (status, ends_on);
alter table hub_offers enable row level security;
drop policy if exists hub_offers_read on hub_offers;
create policy hub_offers_read on hub_offers for select to authenticated using (is_member(client_id));
drop policy if exists hub_offers_team on hub_offers;
create policy hub_offers_team on hub_offers for all to authenticated using (is_team('manager')) with check (is_team('manager'));
drop policy if exists hub_offers_owner_delete on hub_offers;
create policy hub_offers_owner_delete on hub_offers for delete to authenticated using (is_member(client_id) and status <> 'live');

create table if not exists hub_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references hub_offers on delete cascade,
  client_id uuid not null references clients on delete cascade,
  code text not null,
  device text check (device is null or char_length(device) <= 64),
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, code)
);
create unique index if not exists hub_claims_device_idx on hub_claims (offer_id, device) where device is not null;
create index if not exists hub_claims_offer_idx on hub_claims (offer_id, created_at);
alter table hub_claims enable row level security;
drop policy if exists hub_claims_read on hub_claims;
create policy hub_claims_read on hub_claims for select to authenticated using (is_member(client_id));

create table if not exists hub_counts (
  offer_id uuid not null references hub_offers on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('view', 'follow', 'claim', 'redeem')),
  n int not null default 0,
  primary key (offer_id, day, kind)
);
alter table hub_counts enable row level security;
drop policy if exists hub_counts_read on hub_counts;
create policy hub_counts_read on hub_counts for select to authenticated
  using (exists (select 1 from hub_offers o where o.id = hub_counts.offer_id and is_member(o.client_id)));

create table if not exists hub_sponsors (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references hub_offers on delete cascade,
  area text references hub_areas(id) on delete cascade,   -- null = all of Jaipur
  starts_on date not null default current_date,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
alter table hub_sponsors enable row level security;
drop policy if exists hub_sponsors_team on hub_sponsors;
create policy hub_sponsors_team on hub_sponsors for all to authenticated using (is_team('manager')) with check (is_team('manager'));

create or replace function public.hub_bump(p_offer uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  insert into hub_counts (offer_id, day, kind, n) values (p_offer, current_date, p_kind, 1)
  on conflict (offer_id, day, kind) do update set n = hub_counts.n + 1;
$$;
revoke execute on function public.hub_bump(uuid, text) from public, anon, authenticated;

-- Ranking: guest stars of the last 90 days (a new place starts near 4.0 and moves as guests rate), plus codes used at the counter in 30 days.
create or replace function public.hub_ranked(p_area text, p_cat text)
returns table (client_id uuid, slug text, name text, area_id text, area_name text, category text, rating numeric, guests int, score numeric, rank bigint)
language sql stable security definer set search_path = public as $$
  with base as (
    select c.id, c.slug, c.name, c.hub_area, a.name as an, c.business_type as cat
      from clients c join hub_areas a on a.id = c.hub_area
     where c.hub_listed and client_is_live(c) and (p_area is null or c.hub_area = p_area) and (p_cat is null or c.business_type = p_cat)
  ), r as (
    select d.client_id as cid, avg(d.rating)::numeric as avg_r, count(*)::int as n
      from review_drafts d where d.created_at >= now() - interval '90 days' and d.client_id in (select id from base) group by 1
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

create or replace function public.hub_home(p_area text default null, p_cat text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a text := nullif(p_area, ''); c text := nullif(p_cat, '');
begin
  return jsonb_build_object(
    'areas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort, name), '[]'::jsonb) from hub_areas where active),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label) order by t.sort), '[]'::jsonb)
                     from business_templates t where exists (select 1 from clients x where x.hub_listed and x.business_type = t.id)),
    'sponsors', (select coalesce(jsonb_agg(jsonb_build_object('offer_id', o.id, 'kind', o.kind, 'ends_on', o.ends_on, 'slug', cl.slug, 'name', cl.name, 'area', ar.name) order by sp.created_at desc), '[]'::jsonb)
                   from hub_sponsors sp
                   join hub_offers o on o.id = sp.offer_id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date
                   join clients cl on cl.id = o.client_id and cl.hub_listed and client_is_live(cl)
                   join hub_areas ar on ar.id = cl.hub_area
                  where sp.starts_on <= current_date and sp.ends_on >= current_date and (sp.area is null or a is null or sp.area = a)),
    'places', (select coalesce(jsonb_agg(jsonb_build_object('slug', q.slug, 'name', q.name, 'area', q.area_name, 'category', q.category, 'rating', q.rating, 'guests', q.guests, 'rank', q.rank, 'has_offer',
                 exists (select 1 from hub_offers o where o.client_id = q.client_id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date)) order by q.rank, q.name), '[]'::jsonb)
                 from (select * from hub_ranked(a, c) order by rank, name limit 60) q));
end $$;

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
    'offers', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'ends_on', o.ends_on, 'follow_first', o.follow_first,
                 'title', case when o.follow_first then null else o.title end) order by o.ends_on), '[]'::jsonb)
                 from hub_offers o where o.client_id = c.id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date));
end $$;

-- The offer text is only handed over here, after the guest has tapped the Instagram button. One code per phone per offer.
create or replace function public.hub_claim(p_offer uuid, p_device text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare o hub_offers; c clients; cd text; tries int := 0; ex hub_claims; dev text := nullif(left(coalesce(p_device, ''), 64), '');
begin
  select * into o from hub_offers where id = p_offer and status = 'live' and starts_on <= current_date and ends_on >= current_date;
  if o.id is null then raise exception 'This offer is not available'; end if;
  select * into c from clients where id = o.client_id;
  if not (c.hub_listed and client_is_live(c)) then raise exception 'This offer is not available'; end if;
  if dev is not null then
    select * into ex from hub_claims where offer_id = o.id and device = dev;
    if ex.id is not null then
      return jsonb_build_object('code', ex.code, 'title', o.title, 'details', o.details, 'ends_on', o.ends_on, 'name', c.name, 'used', ex.redeemed_at is not null);
    end if;
  end if;
  if (select count(*) from hub_claims where offer_id = o.id and created_at >= now() - interval '1 day') >= 1000 then
    raise exception 'Too many claims today. Please try again tomorrow';
  end if;
  loop
    cd := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from hub_claims where client_id = c.id and code = cd);
    tries := tries + 1;
    if tries > 10 then raise exception 'Please try again'; end if;
  end loop;
  insert into hub_claims (offer_id, client_id, code, device) values (o.id, c.id, cd, dev);
  perform hub_bump(o.id, 'claim');
  return jsonb_build_object('code', cd, 'title', o.title, 'details', o.details, 'ends_on', o.ends_on, 'name', c.name, 'used', false);
end $$;

create or replace function public.hub_track(p_offer uuid, p_kind text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_kind not in ('view', 'follow') then return; end if;
  if exists (select 1 from hub_offers where id = p_offer and status = 'live') then perform hub_bump(p_offer, p_kind); end if;
end $$;

-- Owner: make a limited offer (waits for the team to approve it). At most 3 open offers, each up to 45 days.
create or replace function public.hub_offer_create(p_client uuid, p_kind text, p_title text, p_details text, p_starts date, p_ends date, p_follow boolean)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare c clients; nid uuid; st date := coalesce(p_starts, current_date);
begin
  if not is_member(p_client) then raise exception 'Not allowed'; end if;
  select * into c from clients where id = p_client;
  if not c.hub_listed then raise exception 'This business is not on the Jaipur page yet'; end if;
  if p_ends is null or p_ends < st or p_ends > st + 45 then raise exception 'An offer can run for up to 45 days'; end if;
  if st < current_date then raise exception 'The start date cannot be in the past'; end if;
  if (select count(*) from hub_offers where client_id = p_client and ends_on >= current_date and status in ('pending', 'live')) >= 3 then
    raise exception 'You already have 3 offers open. Wait for one to end';
  end if;
  insert into hub_offers (client_id, kind, title, details, starts_on, ends_on, follow_first, status)
  values (p_client, p_kind, btrim(p_title), nullif(btrim(coalesce(p_details, '')), ''), st, p_ends, coalesce(p_follow, true), case when is_team('manager') then 'live' else 'pending' end)
  returning id into nid;
  return nid;
end $$;

create or replace function public.hub_check_code(p_client uuid, p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cl hub_claims; o hub_offers;
begin
  if not is_member(p_client) then raise exception 'Not allowed'; end if;
  select * into cl from hub_claims where client_id = p_client and code = upper(btrim(p_code));
  if cl.id is null then return jsonb_build_object('state', 'unknown'); end if;
  select * into o from hub_offers where id = cl.offer_id;
  return jsonb_build_object('state', case when cl.redeemed_at is not null then 'used' when o.ends_on < current_date then 'expired' else 'valid' end,
    'title', o.title, 'details', o.details, 'redeemed_at', cl.redeemed_at, 'ends_on', o.ends_on);
end $$;

create or replace function public.hub_redeem(p_client uuid, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare cl hub_claims; o hub_offers;
begin
  if not is_member(p_client) then raise exception 'Not allowed'; end if;
  select * into cl from hub_claims where client_id = p_client and code = upper(btrim(p_code)) for update;
  if cl.id is null then return jsonb_build_object('state', 'unknown'); end if;
  select * into o from hub_offers where id = cl.offer_id;
  if cl.redeemed_at is not null then return jsonb_build_object('state', 'used', 'title', o.title); end if;
  if o.ends_on < current_date then return jsonb_build_object('state', 'expired', 'title', o.title); end if;
  update hub_claims set redeemed_at = now() where id = cl.id;
  perform hub_bump(o.id, 'redeem');
  return jsonb_build_object('state', 'redeemed', 'title', o.title, 'details', o.details);
end $$;

revoke execute on function public.hub_home(text, text), public.hub_place(text), public.hub_claim(uuid, text), public.hub_track(uuid, text),
  public.hub_offer_create(uuid, text, text, text, date, date, boolean), public.hub_check_code(uuid, text), public.hub_redeem(uuid, text) from public, anon, authenticated;
grant execute on function public.hub_home(text, text), public.hub_place(text), public.hub_claim(uuid, text), public.hub_track(uuid, text) to anon, authenticated;
grant execute on function public.hub_offer_create(uuid, text, text, text, date, date, boolean), public.hub_check_code(uuid, text), public.hub_redeem(uuid, text) to authenticated;

-- Only a business that has set up a plate can be listed (so a listing cannot be bought on its own).
create or replace function public.guard_client_hub_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_team('rep') and (new.hub_listed is distinct from old.hub_listed or new.hub_area is distinct from old.hub_area or new.group_id is distinct from old.group_id) then
    raise exception 'Only the Taprizz team can change this';
  end if;
  if new.hub_listed and not coalesce(old.hub_listed, false) and not exists (select 1 from plates p where p.client_id = new.id and p.active) then
    raise exception 'A business needs an active plate before it can be listed';
  end if;
  return new;
end $$;
