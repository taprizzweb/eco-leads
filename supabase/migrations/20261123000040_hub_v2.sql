-- Gulabi Nagar v2: places near the guest (within 5 km), photo cards, one place to announce offers, terms written by the business.
alter table clients add column if not exists hub_lat double precision check (hub_lat is null or hub_lat between -90 and 90);
alter table clients add column if not exists hub_lng double precision check (hub_lng is null or hub_lng between -180 and 180);
alter table clients add column if not exists hub_terms text check (hub_terms is null or char_length(hub_terms) <= 600);
alter table hub_offers add column if not exists source_offer_id uuid unique references offers on delete cascade;

-- An offer announced in the business dashboard also becomes a live Gulabi Nagar offer, so one place updates the guest page, the mini link and Gulabi Nagar.
create or replace function public.hub_sync_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare c clients; s date; e date;
begin
  select * into c from clients where id = new.client_id;
  if c.id is null or not c.hub_listed then return new; end if;
  s := coalesce(new.starts_at, current_date);
  e := least(greatest(coalesce(new.ends_at, s + 30), s), s + 45);
  insert into hub_offers (client_id, kind, title, details, starts_on, ends_on, follow_first, status, source_offer_id)
  values (new.client_id, 'other', rpad(left(new.title, 70), 3, ' '), left(new.details, 300), s, e, true, 'live', new.id)
  on conflict (source_offer_id) do update set title = excluded.title, details = excluded.details, starts_on = excluded.starts_on, ends_on = excluded.ends_on;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'offers_hub_sync') then
    create trigger offers_hub_sync after insert or update of title, details, starts_at, ends_at on offers for each row execute function hub_sync_offer();
  end if;
end $$;

create or replace function public.hub_backfill_on_list() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.hub_listed and not coalesce(old.hub_listed, false) then
    insert into hub_offers (client_id, kind, title, details, starts_on, ends_on, follow_first, status, source_offer_id)
    select o.client_id, 'other', rpad(left(o.title, 70), 3, ' '), left(o.details, 300), coalesce(o.starts_at, current_date),
           least(greatest(coalesce(o.ends_at, coalesce(o.starts_at, current_date) + 30), coalesce(o.starts_at, current_date)), coalesce(o.starts_at, current_date) + 45), true, 'live', o.id
      from offers o where o.client_id = new.id and (o.ends_at is null or o.ends_at >= current_date)
    on conflict (source_offer_id) do nothing;
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'clients_hub_backfill') then
    create trigger clients_hub_backfill after update of hub_listed on clients for each row execute function hub_backfill_on_list();
  end if;
end $$;
-- the businesses already listed
insert into hub_offers (client_id, kind, title, details, starts_on, ends_on, follow_first, status, source_offer_id)
select o.client_id, 'other', rpad(left(o.title, 70), 3, ' '), left(o.details, 300), coalesce(o.starts_at, current_date),
       least(greatest(coalesce(o.ends_at, coalesce(o.starts_at, current_date) + 30), coalesce(o.starts_at, current_date)), coalesce(o.starts_at, current_date) + 45), true, 'live', o.id
  from offers o join clients c on c.id = o.client_id and c.hub_listed where (o.ends_at is null or o.ends_at >= current_date)
on conflict (source_offer_id) do nothing;

-- The business sets where it is (from the phone, standing in the shop) and the terms guests see with an offer.
create or replace function public.hub_set_location(p_client uuid, p_lat double precision, p_lng double precision, p_terms text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if coalesce(my_client_role(p_client), '') not in ('owner', 'manager') then raise exception 'Not allowed'; end if;
  update clients set hub_lat = p_lat, hub_lng = p_lng, hub_terms = nullif(left(btrim(coalesce(p_terms, '')), 600), '') where id = p_client;
end $$;
revoke execute on function public.hub_set_location(uuid, double precision, double precision, text) from public, anon;
grant execute on function public.hub_set_location(uuid, double precision, double precision, text) to authenticated;

-- Places within p_radius_km (at most 25) of a point, nearest first, each with up to three photos and its live offer.
create or replace function public.hub_nearby_places(p_lat double precision, p_lng double precision, p_radius_km numeric default 5, p_exclude text default null, p_cat text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with rk as (select * from hub_ranked(null, null)),
  d as (
    select c.*, (6371 * 2 * asin(least(1, sqrt(power(sin(radians(c.hub_lat - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(c.hub_lat)) * power(sin(radians(c.hub_lng - p_lng) / 2), 2)))))::numeric as km
      from clients c
     where c.hub_listed and c.hub_lat is not null and c.hub_lng is not null and client_is_live(c)
       and (p_exclude is null or c.slug <> p_exclude) and (p_cat is null or c.business_type = p_cat)
  )
  select coalesce(jsonb_agg(x.j order by x.km), '[]'::jsonb) from (
    select d.km, jsonb_build_object('slug', d.slug, 'name', d.name, 'tagline', d.tagline, 'logo_url', d.logo_url,
      'area', (select name from hub_areas where id = d.hub_area), 'category', (select label from business_templates where id = d.business_type),
      'distance_km', round(d.km, 1), 'rating', coalesce(rk.rating, 0), 'guests', coalesce(rk.guests, 0),
      'photos', (select coalesce(jsonb_agg(g.url order by g.sort, g.created_at), '[]'::jsonb) from (select url, sort, created_at from gallery_photos where client_id = d.id order by sort, created_at limit 3) g),
      'offer', (select jsonb_build_object('kind', o.kind, 'ends_on', o.ends_on, 'follow_first', o.follow_first, 'title', case when o.follow_first then null else o.title end)
                  from hub_offers o where o.client_id = d.id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date order by o.ends_on limit 1)) as j
      from d left join rk on rk.client_id = d.id
     where d.km <= least(coalesce(p_radius_km, 5), 25) order by d.km limit 60
  ) x;
$$;
revoke execute on function public.hub_nearby_places(double precision, double precision, numeric, text, text) from public;
grant execute on function public.hub_nearby_places(double precision, double precision, numeric, text, text) to anon, authenticated;

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
    'instagram', c.socials->>'instagram', 'maps', c.socials->>'maps', 'phone', c.socials->>'phone', 'review_url', c.google_review_url,
    'lat', c.hub_lat, 'lng', c.hub_lng, 'terms', c.hub_terms,
    'photos', (select coalesce(jsonb_agg(g.url order by g.sort, g.created_at), '[]'::jsonb) from (select url, sort, created_at from gallery_photos where client_id = c.id order by sort, created_at limit 8) g),
    'rating', rk.rating, 'guests', coalesce(rk.guests, 0), 'rank', rk.rank, 'total', total,
    'offers', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'ends_on', o.ends_on, 'follow_first', o.follow_first,
                 'title', case when o.follow_first then null else o.title end, 'details', case when o.follow_first then null else o.details end) order by o.ends_on), '[]'::jsonb)
                 from hub_offers o where o.client_id = c.id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date));
end $$;

-- Step two of an offer: after the guest has followed, the offer text opens. The code comes only when they claim it.
create or replace function public.hub_offer_reveal(p_offer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o hub_offers; c clients;
begin
  select * into o from hub_offers where id = p_offer and status = 'live' and starts_on <= current_date and ends_on >= current_date;
  if o.id is null then raise exception 'This offer is not available'; end if;
  select * into c from clients where id = o.client_id;
  if not (c.hub_listed and client_is_live(c)) then raise exception 'This offer is not available'; end if;
  return jsonb_build_object('id', o.id, 'title', o.title, 'details', o.details, 'ends_on', o.ends_on, 'name', c.name, 'terms', c.hub_terms);
end $$;
revoke execute on function public.hub_offer_reveal(uuid) from public;
grant execute on function public.hub_offer_reveal(uuid) to anon, authenticated;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.hub_claim(uuid,text)'::regprocedure);
  if d not like '%hub_terms%' then
    d := replace(d, '''name'', c.name,', '''name'', c.name, ''terms'', c.hub_terms,');
    execute d;
  end if;
end $$;
