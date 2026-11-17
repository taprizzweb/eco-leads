-- AI Review Studio: admin-controlled questions, rules and categories for the guest review flow,
-- time-limited owner editing, visitor registration, and a similarity check so no two drafts look alike.

alter table business_templates add column if not exists notes text, add column if not exists questions jsonb;
alter table clients add column if not exists review_setup jsonb not null default '{}'::jsonb;
alter table review_drafts
  add column if not exists language text,
  add column if not exists guest_name text,
  add column if not exists shingles jsonb;

-- ------------------------------------------------------------------ who may change what
-- Owners may edit their review QUESTIONS only while the admin has opened a window (owner_edit_until).
-- Category, language list, number of questions, low-star handling and the window itself stay with the team.
create or replace function guard_client_billing_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_team('rep') then
    if new.package_id is distinct from old.package_id
      or new.feature_overrides is distinct from old.feature_overrides
      or new.status is distinct from old.status
      or new.expires_at is distinct from old.expires_at
      or new.slug is distinct from old.slug then
      raise exception 'Only the Taprizz team can change plan, status, expiry or link';
    end if;
    if new.business_type is distinct from old.business_type then
      raise exception 'Only the Taprizz team can change the category';
    end if;
    if (new.review_setup - 'questions') is distinct from (old.review_setup - 'questions') then
      raise exception 'Only the Taprizz team can change review settings';
    end if;
    if (new.review_setup->'questions') is distinct from (old.review_setup->'questions')
       and coalesce(nullif(old.review_setup->>'owner_edit_until', '')::timestamptz, 'epoch'::timestamptz) < now() then
      raise exception 'Question editing is closed. Ask Taprizz to open it for you';
    end if;
  end if;
  new.updated_at := now();
  if new.package_id is distinct from old.package_id
    or new.feature_overrides is distinct from old.feature_overrides
    or new.status is distinct from old.status
    or new.expires_at is distinct from old.expires_at then
    insert into audit_log (actor, client_id, action, detail)
    values (auth.uid(), new.id, 'client.plan_changed', jsonb_build_object(
      'package', jsonb_build_array(old.package_id, new.package_id),
      'overrides', jsonb_build_array(old.feature_overrides, new.feature_overrides),
      'status', jsonb_build_array(old.status, new.status),
      'expires_at', jsonb_build_array(old.expires_at, new.expires_at)));
  end if;
  if new.review_setup is distinct from old.review_setup or new.business_type is distinct from old.business_type then
    insert into audit_log (actor, client_id, action, detail)
    values (auth.uid(), new.id, 'client.review_setup_changed', jsonb_build_object(
      'category', jsonb_build_array(old.business_type, new.business_type),
      'questions_changed', (new.review_setup->'questions') is distinct from (old.review_setup->'questions'),
      'edit_until', new.review_setup->>'owner_edit_until'));
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ AI Studio settings (team only)
create or replace function ai_studio_get()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_team('manager') then coalesce((select value from app_settings where key = 'ai_studio'), '{}'::jsonb) end;
$$;

create or replace function ai_studio_set(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'Not allowed'; end if;
  if pg_column_size(p) > 40000 then raise exception 'That is too large. Shorten the rules or examples'; end if;
  insert into app_settings (key, value) values ('ai_studio', p)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into audit_log (actor, action, detail) values (auth.uid(), 'ai_studio.updated', jsonb_build_object('bytes', pg_column_size(p)));
end $$;

-- What the writer needs for one business: global rules, banned phrases, length, examples and the category notes.
create or replace function review_ai_config(p_client uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s jsonb; c clients; t business_templates;
begin
  select * into c from clients where id = p_client;
  if c.id is null then return null; end if;
  select * into t from business_templates where id = c.business_type;
  select value into s from app_settings where key = 'ai_studio';
  s := coalesce(s, '{}'::jsonb);
  return jsonb_build_object(
    'rules', coalesce(s->>'rules', ''),
    'banned', coalesce(s->'banned', '[]'::jsonb),
    'length_min', coalesce((s->>'length_min')::int, 25),
    'length_max', coalesce((s->>'length_max')::int, 80),
    'examples', coalesce(s->'examples', '[]'::jsonb),
    'category', jsonb_build_object('id', t.id, 'label', t.label, 'keywords', to_jsonb(coalesce(t.keywords, '{}')), 'notes', coalesce(t.notes, '')),
    'business', jsonb_build_object('name', c.name, 'tagline', c.tagline));
end $$;

-- Word-group fingerprints of recent drafts (numbers only, no text), used to keep every draft different.
create or replace function guest_recent_sigs(p_client uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(shingles), '[]'::jsonb)
  from (select shingles from review_drafts where client_id = p_client and shingles is not null order by created_at desc limit 60) s;
$$;

-- ------------------------------------------------------------------ saving drafts (new fields)
drop function if exists guest_save_review(uuid, text, int, jsonb, text, text);
create or replace function guest_save_review(
  p_client uuid, p_code text, p_rating int, p_answers jsonb, p_draft text, p_provider text,
  p_language text default null, p_name text default null, p_shingles jsonb default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare rid uuid;
begin
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  if p_language is not null and p_language not in ('en', 'hi', 'hinglish') then raise exception 'bad language'; end if;
  if not guest_rate_ok(p_client, 'review_drafts', 300, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into review_drafts (client_id, plate_code, rating, answers, draft, provider, language, guest_name, shingles)
  values (p_client, p_code, p_rating, coalesce(p_answers, '{}'), left(p_draft, 2000), p_provider, p_language, left(p_name, 40), p_shingles)
  returning id into rid;
  return rid;
end $$;

-- ------------------------------------------------------------------ visitors: name and number on the first tap
create or replace function guest_register_visitor(p_client uuid, p_name text, p_phone text, p_marketing boolean default false)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare c clients; ph text; nm text; cid uuid;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not available'; end if;
  nm := left(trim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[<>]', '', 'g'), '\s+', ' ', 'g')), 40);
  if char_length(nm) < 1 then raise exception 'Add your name'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(ph) = 10 then ph := '91' || ph; end if;
  if ph !~ '^[1-9][0-9]{9,14}$' then raise exception 'Enter a valid mobile number'; end if;
  if not guest_rate_ok(p_client, 'contacts', 60, interval '1 hour') then raise exception 'Too many tries. Please wait a little'; end if;
  insert into contacts (client_id, name, phone, whatsapp_consent, consent_at, consent_source)
  values (p_client, nm, ph, coalesce(p_marketing, false), case when p_marketing then now() end, 'guest_page')
  on conflict (client_id, phone) do update
    set name = excluded.name,
        whatsapp_consent = contacts.whatsapp_consent or excluded.whatsapp_consent,
        consent_at = coalesce(contacts.consent_at, excluded.consent_at)
  returning id into cid;
  return cid;
end $$;

-- ------------------------------------------------------------------ guest_page now carries the review setup
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
      'low_star_mode', coalesce(c.review_setup->>'low_star_mode', 'private_first'))
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
