-- Per-business switch: ask guests for name and number (default yes). Retention: contacts are removed automatically.
alter table contacts add column if not exists last_seen_at timestamptz not null default now();

insert into app_settings (key, value) values ('contact_retention_days', '45'::jsonb) on conflict (key) do nothing;

create or replace function public.purge_old_contacts() returns integer
language plpgsql security definer set search_path = public as $$
declare days int; n int;
begin
  select coalesce((value #>> '{}')::int, 45) into days from app_settings where key = 'contact_retention_days';
  days := greatest(7, least(365, coalesce(days, 45)));
  delete from contacts where last_seen_at < now() - make_interval(days => days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_old_contacts() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-contacts';
select cron.schedule('purge-old-contacts', '45 21 * * *', $$select public.purge_old_contacts()$$);

-- a returning guest refreshes their record; a first-time guest creates it
create or replace function public.guest_register_visitor(p_client uuid, p_name text, p_phone text, p_marketing boolean default false)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare c clients; ph text; nm text; cid uuid;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not available'; end if;
  if coalesce((c.review_setup->>'collect_contact')::boolean, true) = false then return null; end if;
  nm := left(trim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[<>]', '', 'g'), '\s+', ' ', 'g')), 40);
  if char_length(nm) < 1 then raise exception 'Add your name'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(ph) = 10 then ph := '91' || ph; end if;
  if ph !~ '^[1-9][0-9]{9,14}$' then raise exception 'Enter a valid mobile number'; end if;
  if not guest_rate_ok(p_client, 'contacts', 60, interval '1 hour') then raise exception 'Too many tries. Please wait a little'; end if;
  insert into contacts (client_id, name, phone, whatsapp_consent, consent_at, consent_source)
  values (p_client, nm, ph, coalesce(p_marketing, false), case when p_marketing then now() end, 'guest_page')
  on conflict (client_id, phone) do update
    set name = excluded.name, last_seen_at = now(),
        whatsapp_consent = contacts.whatsapp_consent or excluded.whatsapp_consent,
        consent_at = coalesce(contacts.consent_at, excluded.consent_at)
  returning id into cid;
  return cid;
end $$;

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
            limit coalesce((feats->>'custom_links')::int, 0)) l), '[]'::jsonb) end,
    'review', jsonb_build_object(
      'questions', coalesce(c.review_setup->'questions', t.questions),
      'max_questions', coalesce((c.review_setup->>'max_questions')::int, 6),
      'languages', coalesce(c.review_setup->'languages', '["hinglish","en","hi"]'::jsonb),
      'low_star_mode', coalesce(c.review_setup->>'low_star_mode', 'private_first'),
      'collect_contact', coalesce((c.review_setup->>'collect_contact')::boolean, true))
  );
end $function$;

-- ------------------------------------------------------------------ grants
revoke execute on function ai_studio_get() from public, anon;
revoke execute on function ai_studio_set(jsonb) from public, anon;
revoke execute on function review_ai_config(uuid) from public;
revoke execute on function guest_recent_sigs(uuid) from public;
revoke execute on function guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb) from public;
revoke execute on function guest_register_visitor(uuid, text, text, boolean) from public;
grant execute on function ai_studio_get() to authenticated;
grant execute on function ai_studio_set(jsonb) to authenticated;
grant execute on function review_ai_config(uuid) to anon, authenticated;
grant execute on function guest_recent_sigs(uuid) to anon, authenticated;
grant execute on function guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function guest_register_visitor(uuid, text, text, boolean) to anon, authenticated;
