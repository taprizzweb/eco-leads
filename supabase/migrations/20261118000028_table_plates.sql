-- Table plates: a table plate can open that table's own ordering link (Pro: "table_ordering"), and an admin can
-- redirect any plate to any https link (for example when a client stops paying), so a printed plate never goes dead.
alter table plates add column if not exists menu_url text;
alter table plates add column if not exists redirect_url text;
alter table plates drop constraint if exists plates_menu_url_https;
alter table plates add constraint plates_menu_url_https check (menu_url is null or (menu_url ~ '^https://' and length(menu_url) <= 600));
alter table plates drop constraint if exists plates_redirect_url_https;
alter table plates add constraint plates_redirect_url_https check (redirect_url is null or (redirect_url ~ '^https://' and length(redirect_url) <= 600));

create or replace function public.set_plate_menu(p_code text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare pl plates; u text := nullif(trim(coalesce(p_url, '')), '');
begin
  select * into pl from plates where code = p_code;
  if pl.code is null or pl.client_id is null then raise exception 'Plate not found'; end if;
  if not (is_team('manager') or is_member(pl.client_id)) then raise exception 'Not allowed'; end if;
  if not is_team('manager') and not coalesce((client_features(pl.client_id)->>'table_ordering')::boolean, false) then
    raise exception 'Table ordering links are not part of this plan';
  end if;
  if u is not null and u !~ '^https://' then raise exception 'The link must start with https://'; end if;
  update plates set menu_url = u where code = p_code;
end $$;
revoke execute on function public.set_plate_menu(text, text) from public, anon;
grant execute on function public.set_plate_menu(text, text) to authenticated;

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
    'plate', case when pl.code is null then null else jsonb_build_object('code', pl.code, 'label', pl.label,
      'redirect_url', pl.redirect_url,
      'menu_url', case when live and coalesce((feats->>'table_ordering')::boolean, false) then pl.menu_url end) end,
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
            limit coalesce((feats->>'custom_links')::int, 0)) l), '[]'::jsonb) end,
    'review', jsonb_build_object(
      'questions', coalesce(c.review_setup->'questions', t.questions),
      'max_questions', coalesce((c.review_setup->>'max_questions')::int, 6),
      'languages', coalesce(c.review_setup->'languages', '["hinglish","en","hi"]'::jsonb),
      'low_star_mode', coalesce(c.review_setup->>'low_star_mode', 'private_first'),
      'collect_contact', coalesce((c.review_setup->>'collect_contact')::boolean, false))
  );
end $function$;

-- Pro plan gets the table ordering switch.
update packages set features = features || '{"table_ordering":true}'::jsonb where id = 'premium';
update packages set features = features || '{"table_ordering":false}'::jsonb where id in ('starter', 'growth');
