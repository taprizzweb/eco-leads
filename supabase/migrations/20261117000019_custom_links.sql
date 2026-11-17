-- Extra link buttons: the owner adds a button name and a URL; the admin decides how many each client may add
-- with the "custom_links" switch (a number). 0 means the feature is off.
create table if not exists client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  url text not null check (char_length(url) <= 500 and url ~* '^(https?://|tel:|mailto:)\S+$'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists client_links_client_idx on client_links (client_id, sort);
alter table client_links enable row level security;
create policy client_links_member on client_links for all to authenticated using (is_member(client_id)) with check (is_member(client_id));
revoke all on client_links from anon;

-- The limit is enforced here, not only in the screen. Taprizz team members are not limited.
create or replace function client_links_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  if not is_team('rep') then
    lim := coalesce((client_features(new.client_id)->>'custom_links')::int, 0);
    select count(*) into n from client_links where client_id = new.client_id;
    if n >= lim then raise exception 'Extra links are not switched on for this business, or the limit of % is used up', lim; end if;
  end if;
  return new;
end $$;
revoke execute on function client_links_guard() from public, anon, authenticated;
drop trigger if exists client_links_limit on client_links;
create trigger client_links_limit before insert on client_links for each row execute function client_links_guard();

-- Off in every package by default; grant it per client in the admin panel.
update packages set features = features || '{"custom_links": 0}'::jsonb where not (features ? 'custom_links');

-- guest_page now also returns the client's extra links (only while live, and only up to the allowed number).
create or replace function public.guest_page(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  pl plates;
  c clients;
  t business_templates;
  feats jsonb;
  live boolean;
begin
  select * into pl from plates where code = p_code and active;
  if found then
    select * into c from clients where id = pl.client_id;
  else
    select * into c from clients where slug = lower(p_code);
  end if;
  if c.id is null then return null; end if;

  select * into t from business_templates where id = c.business_type;
  feats := client_features(c.id);
  live := client_is_live(c);

  return jsonb_build_object(
    'live', live,
    'plate', case when pl.code is null then null else jsonb_build_object('code', pl.code, 'label', pl.label) end,
    'client', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name,
      'tagline', coalesce(c.tagline, t.tagline),
      'logo_url', c.logo_url, 'theme', c.theme,
      'google_review_url', c.google_review_url,
      'menu_url', c.menu_url, 'business_type', c.business_type,
      'socials', c.socials,
      'keywords', case when cardinality(c.keywords) > 0 then to_jsonb(c.keywords) else to_jsonb(coalesce(t.keywords, '{}')) end,
      'review_chips', coalesce(c.review_chips, t.review_chips, '[]'::jsonb),
      'card_config', c.card_config,
      'card_copy', coalesce(t.card_copy, '{}'::jsonb)
    ),
    'features', case when live then feats else '{}'::jsonb end,
    'gallery', case when not live then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('url', g.url, 'label', g.label, 'caption', g.caption) order by g.sort)
      from (select * from gallery_photos where client_id = c.id order by sort
            limit coalesce((feats->>'photo_limit')::int, 5)) g), '[]'::jsonb) end,
    'offers', case when not live then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'details', o.details,
               'starts_at', o.starts_at, 'ends_at', o.ends_at, 'claimable', o.claimable) order by o.ends_at nulls last)
      from offers o where o.client_id = c.id
        and (o.starts_at is null or o.starts_at <= current_date)
        and (o.ends_at is null or o.ends_at >= current_date)), '[]'::jsonb) end,
    'events', case when not live then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('title', e.title, 'details', e.details, 'starts_at', e.starts_at) order by e.starts_at)
      from events e where e.client_id = c.id and e.starts_at >= now() - interval '6 hours'), '[]'::jsonb) end,
    'reviews', case when not live then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('author', r.author, 'rating', r.rating, 'body', r.body))
      from (select * from google_reviews where client_id = c.id and show_on_page order by created_at desc limit 6) r), '[]'::jsonb) end,
    'links', case when not live then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.sort, l.created_at)
      from (select * from client_links where client_id = c.id order by sort, created_at
            limit coalesce((feats->>'custom_links')::int, 0)) l), '[]'::jsonb) end
  );
end $function$;
