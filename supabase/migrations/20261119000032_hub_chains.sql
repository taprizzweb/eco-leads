-- Jaipur page: companies with several listed branches get one tile; tapping it lists the branches. Read-only functions.

-- Companies (chains) that have 2 or more live, listed branches, optionally only in one area or category.
create or replace function public.hub_chains(p_area text default null, p_cat text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', q.slug, 'name', q.name, 'logo_url', q.logo_url, 'branches', q.n) order by q.name), '[]'::jsonb)
    from (
      select g.slug, g.name, g.logo_url, count(*)::int as n
        from groups g
        join clients c on c.group_id = g.id and c.hub_listed and client_is_live(c)
       where (nullif(p_area, '') is null or c.hub_area = p_area) and (nullif(p_cat, '') is null or c.business_type = p_cat)
       group by g.id
      having count(*) >= 2
    ) q;
$$;
revoke execute on function public.hub_chains(text, text) from public, anon, authenticated;
grant execute on function public.hub_chains(text, text) to anon, authenticated;

-- One company with its branches (each with rating, area and whether an offer is running).
create or replace function public.hub_chain(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g groups;
begin
  select * into g from groups where slug = lower(p_slug);
  if g.id is null then return null; end if;
  if (select count(*) from clients c where c.group_id = g.id and c.hub_listed and client_is_live(c)) < 2 then return null; end if;
  return jsonb_build_object('name', g.name, 'slug', g.slug, 'logo_url', g.logo_url,
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('slug', r.slug, 'name', r.name, 'area', r.area_name, 'category', r.category, 'rating', r.rating, 'guests', r.guests,
        'has_offer', exists (select 1 from hub_offers o where o.client_id = r.client_id and o.status = 'live' and o.starts_on <= current_date and o.ends_on >= current_date)) order by r.area_name, r.name), '[]'::jsonb)
      from hub_ranked(null, null) r join clients c on c.id = r.client_id where c.group_id = g.id));
end $$;
revoke execute on function public.hub_chain(text) from public, anon, authenticated;
grant execute on function public.hub_chain(text) to anon, authenticated;

-- For a place page: the company this branch belongs to, if it has 2 or more listed branches.
create or replace function public.hub_place_chain(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', g.slug, 'name', g.name, 'branches', (select count(*)::int from clients x where x.group_id = g.id and x.hub_listed and client_is_live(x)))
    from clients c join groups g on g.id = c.group_id
   where c.slug = lower(p_slug) and c.hub_listed and client_is_live(c)
     and (select count(*) from clients x where x.group_id = g.id and x.hub_listed and client_is_live(x)) >= 2;
$$;
revoke execute on function public.hub_place_chain(text) from public, anon, authenticated;
grant execute on function public.hub_place_chain(text) to anon, authenticated;
