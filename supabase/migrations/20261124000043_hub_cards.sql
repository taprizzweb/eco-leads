-- The Top rated list as full cards: photos, short description, and the live offer, in rank order.
create or replace function public.hub_cards(p_area text default null, p_cat text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.rk, x.nm), '[]'::jsonb) from (
    select r.rank as rk, r.name as nm, jsonb_build_object('slug', c.slug, 'name', c.name, 'tagline', c.tagline, 'logo_url', c.logo_url,
      'area', r.area_name, 'category', (select label from business_templates where id = c.business_type), 'rank', r.rank,
      'distance_km', null, 'rating', r.rating, 'guests', r.guests,
      'photos', (select coalesce(jsonb_agg(g.url order by g.sort, g.created_at), '[]'::jsonb) from (select url, sort, created_at from gallery_photos where client_id = c.id order by sort, created_at limit 5) g),
      'offer', (select jsonb_build_object('kind', o.kind, 'ends_on', o.ends_on, 'follow_first', o.follow_first, 'title', case when o.follow_first then null else o.title end)
                  from hub_offers o where o.client_id = c.id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date order by o.ends_on limit 1)) as j
      from hub_ranked(nullif(p_area, ''), nullif(p_cat, '')) r join clients c on c.id = r.client_id
     order by r.rank, r.name limit 40
  ) x;
$$;
revoke execute on function public.hub_cards(text, text) from public;
grant execute on function public.hub_cards(text, text) to anon, authenticated;
