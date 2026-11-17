-- Taprizz foundation schema
-- Three faces: guest page (anonymous), owner dashboard (client members), admin panel (team).
-- Rule: guests never touch tables directly. They go through SECURITY DEFINER functions
-- that expose only what the guest page needs and validate every write.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type team_role as enum ('owner', 'manager', 'rep');
create type member_role as enum ('owner', 'manager', 'staff');
create type client_status as enum ('active', 'paused');
create type feedback_kind as enum ('complaint', 'suggestion');
create type feedback_status as enum ('new', 'in_progress', 'resolved');
create type moderation_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------- team (admin panel users)
create table team_members (
  user_id uuid primary key references auth.users on delete cascade,
  role team_role not null default 'rep',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- packages
-- A package is only a preset of feature switches. Prices are editable in admin.
create table packages (
  id text primary key,                       -- starter | growth | premium | retainer
  name text not null,
  price_inr integer not null,
  sort integer not null default 0,
  features jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- business templates
create table business_templates (
  id text primary key,                       -- cafe | salon | gym | hotel | clinic | stay ...
  label text not null,
  tagline text,
  review_chips jsonb not null default '[]'::jsonb,
  keywords text[] not null default '{}',
  card_copy jsonb not null default '{}'::jsonb,
  sample_offers jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);

-- ---------------------------------------------------------------- clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null,
  business_type text references business_templates(id),
  tagline text,
  logo_url text,
  google_review_url text,
  menu_url text,
  theme text not null default 'navy',
  socials jsonb not null default '{}'::jsonb,    -- {instagram, facebook, maps, phone, zomato, swiggy}
  keywords text[] not null default '{}',
  review_chips jsonb,                            -- null = use template
  card_config jsonb not null default '{}'::jsonb,-- {order:[...], hidden:[...], copy:{card:{title,help}}}
  package_id text not null references packages(id) default 'starter',
  feature_overrides jsonb not null default '{}'::jsonb,
  status client_status not null default 'active',
  expires_at date,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_members (
  client_id uuid references clients on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role member_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

-- ---------------------------------------------------------------- plates (NFC / QR)
create table plates (
  code text primary key check (code ~ '^[a-zA-Z0-9]{4,16}$'),  -- taprizz.in/e/<code>
  client_id uuid references clients on delete set null,
  label text,                                  -- "Table 5", "Counter"
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- guest page content
create table gallery_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  url text not null,
  label text,                                  -- BEST SELLER
  caption text,                                -- dish name
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  title text not null,
  details text,
  starts_at date,
  ends_at date,
  claimable boolean not null default false,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  title text not null,
  details text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table google_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  author text not null,
  rating smallint not null check (rating between 1 and 5),
  body text,
  show_on_page boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- guest activity
create table taps (
  id bigint generated always as identity primary key,
  client_id uuid not null references clients on delete cascade,
  plate_code text,
  created_at timestamptz not null default now()
);

create table review_drafts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  plate_code text,
  rating smallint not null check (rating between 1 and 5),
  answers jsonb not null default '{}'::jsonb,
  draft text,
  provider text,
  copied boolean not null default false,
  created_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  plate_code text,
  kind feedback_kind not null,
  body text not null check (char_length(body) between 1 and 2000),
  media_paths text[] not null default '{}',
  contact_name text,
  contact_phone text,
  contact_consent boolean not null default false,
  status feedback_status not null default 'new',
  private_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table moments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  media_path text not null,
  caption text,
  instagram_handle text,
  repost_consent boolean not null,
  status moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text,
  phone text not null,
  whatsapp_consent boolean not null default false,
  consent_at timestamptz,
  consent_source text,
  member_code text,
  birthday date,
  anniversary date,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, phone)
);

create table offer_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers on delete cascade,
  client_id uuid not null references clients on delete cascade,
  code text not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, code)
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users,
  client_id uuid references clients on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes
create index on client_members (user_id);
create index on plates (client_id);
create index on gallery_photos (client_id, sort);
create index on offers (client_id, ends_at);
create index on events (client_id, starts_at);
create index on google_reviews (client_id);
create index on taps (client_id, created_at);
create index on review_drafts (client_id, created_at);
create index on feedback (client_id, status, created_at);
create index on moments (client_id, status);
create index on contacts (client_id);
create index on offer_claims (offer_id);
create index on audit_log (client_id, created_at);

-- ---------------------------------------------------------------- helpers
create or replace function is_team(min_role team_role default 'rep')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members t
    where t.user_id = auth.uid()
      and (min_role = 'rep'
        or (min_role = 'manager' and t.role in ('owner','manager'))
        or (min_role = 'owner' and t.role = 'owner'))
  );
$$;

create or replace function is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from client_members m where m.client_id = cid and m.user_id = auth.uid())
      or is_team('rep');
$$;

-- Effective feature switches = package preset overlaid with per-client overrides.
create or replace function client_features(cid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(p.features, '{}'::jsonb) || coalesce(c.feature_overrides, '{}'::jsonb)
  from clients c join packages p on p.id = c.package_id
  where c.id = cid;
$$;

-- A client is live when active and not expired. Otherwise the page falls back to the review link.
create or replace function client_is_live(c clients)
returns boolean language sql stable as $$
  select c.status = 'active' and (c.expires_at is null or c.expires_at >= current_date);
$$;

-- ---------------------------------------------------------------- RLS
alter table team_members enable row level security;
alter table packages enable row level security;
alter table business_templates enable row level security;
alter table clients enable row level security;
alter table client_members enable row level security;
alter table plates enable row level security;
alter table gallery_photos enable row level security;
alter table offers enable row level security;
alter table events enable row level security;
alter table google_reviews enable row level security;
alter table taps enable row level security;
alter table review_drafts enable row level security;
alter table feedback enable row level security;
alter table moments enable row level security;
alter table contacts enable row level security;
alter table offer_claims enable row level security;
alter table audit_log enable row level security;

-- team
create policy team_read on team_members for select to authenticated using (user_id = auth.uid() or is_team('rep'));
create policy team_write on team_members for all to authenticated using (is_team('owner')) with check (is_team('owner'));

-- packages & templates: readable by signed-in users, writable by admin managers
create policy pkg_read on packages for select to authenticated using (true);
create policy pkg_write on packages for all to authenticated using (is_team('manager')) with check (is_team('manager'));
create policy tpl_read on business_templates for select to authenticated using (true);
create policy tpl_write on business_templates for all to authenticated using (is_team('manager')) with check (is_team('manager'));

-- clients: members read and edit page content; billing fields guarded by trigger below
create policy clients_read on clients for select to authenticated using (is_member(id));
create policy clients_update on clients for update to authenticated using (is_member(id)) with check (is_member(id));
create policy clients_insert on clients for insert to authenticated with check (is_team('rep'));
create policy clients_delete on clients for delete to authenticated using (is_team('owner'));

create policy members_read on client_members for select to authenticated using (user_id = auth.uid() or is_team('rep'));
create policy members_write on client_members for all to authenticated using (is_team('manager')) with check (is_team('manager'));

-- plates: only admin managers create or reassign; reps and owners read
create policy plates_read on plates for select to authenticated using (is_team('rep') or (client_id is not null and is_member(client_id)));
create policy plates_write on plates for all to authenticated using (is_team('manager')) with check (is_team('manager'));

-- per-client content tables: members full access
do $$
declare t text;
begin
  foreach t in array array['gallery_photos','offers','events','google_reviews','feedback','moments','contacts','offer_claims'] loop
    execute format('create policy %1$s_member on %1$s for all to authenticated using (is_member(client_id)) with check (is_member(client_id))', t);
  end loop;
  foreach t in array array['taps','review_drafts'] loop
    execute format('create policy %1$s_member_read on %1$s for select to authenticated using (is_member(client_id))', t);
  end loop;
end $$;

create policy audit_read on audit_log for select to authenticated using (is_team('manager'));

-- Owners may edit their page but never their package, overrides, status, expiry or slug.
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
  return new;
end $$;

create trigger clients_guard before update on clients
for each row execute function guard_client_billing_fields();

-- ---------------------------------------------------------------- guest-facing functions
-- Everything the guest page needs, in one call, keyed by plate code or client slug.
create or replace function guest_page(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
      from (select * from google_reviews where client_id = c.id and show_on_page order by created_at desc limit 6) r), '[]'::jsonb) end
  );
end $$;

-- Simple per-client rate limit used by every guest write.
create or replace function guest_rate_ok(p_client uuid, p_table text, p_max int, p_window interval)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from %I where client_id = $1 and created_at > now() - $2', p_table)
    into n using p_client, p_window;
  return n < p_max;
end $$;

create or replace function guest_log_tap(p_client uuid, p_code text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not guest_rate_ok(p_client, 'taps', 2000, interval '1 hour') then return; end if;
  insert into taps (client_id, plate_code) values (p_client, p_code);
end $$;

create or replace function guest_save_review(p_client uuid, p_code text, p_rating int, p_answers jsonb, p_draft text, p_provider text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare rid uuid;
begin
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  if not guest_rate_ok(p_client, 'review_drafts', 300, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into review_drafts (client_id, plate_code, rating, answers, draft, provider)
  values (p_client, p_code, p_rating, coalesce(p_answers, '{}'), left(p_draft, 2000), p_provider)
  returning id into rid;
  return rid;
end $$;

create or replace function guest_mark_copied(p_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update review_drafts set copied = true where id = p_id and created_at > now() - interval '1 hour';
$$;

create or replace function guest_submit_feedback(
  p_client uuid, p_code text, p_kind feedback_kind, p_body text, p_media text[],
  p_name text, p_phone text, p_consent boolean)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare fid uuid; feats jsonb; c clients;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting messages'; end if;
  feats := client_features(p_client);
  if p_kind = 'complaint' and not coalesce((feats->>'complaints')::boolean, false) then raise exception 'Not available'; end if;
  if p_kind = 'suggestion' and not coalesce((feats->>'suggestions')::boolean, false) then raise exception 'Not available'; end if;
  if not guest_rate_ok(p_client, 'feedback', 60, interval '1 hour') then raise exception 'Too many messages, try again shortly'; end if;
  if coalesce(array_length(p_media, 1), 0) > 3 then raise exception 'Up to 3 attachments'; end if;
  if exists (select 1 from unnest(coalesce(p_media, '{}')) m where m not like p_client::text || '/%') then
    raise exception 'Bad attachment path';
  end if;
  insert into feedback (client_id, plate_code, kind, body, media_paths, contact_name, contact_phone, contact_consent)
  values (p_client, p_code, p_kind, left(p_body, 2000), coalesce(p_media, '{}'),
          case when p_kind = 'complaint' then left(p_name, 80) end,
          case when p_kind = 'complaint' then left(p_phone, 20) end,
          p_kind = 'complaint' and coalesce(p_consent, false))
  returning id into fid;
  return fid;
end $$;

-- Lock down: anon may only call the guest_* functions and guest_page.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function guest_page(text) to anon, authenticated;
grant execute on function guest_log_tap(uuid, text) to anon, authenticated;
grant execute on function guest_save_review(uuid, text, int, jsonb, text, text) to anon, authenticated;
grant execute on function guest_mark_copied(uuid) to anon, authenticated;
grant execute on function guest_submit_feedback(uuid, text, feedback_kind, text, text[], text, text, boolean) to anon, authenticated;
grant execute on function is_team(team_role) to authenticated;
grant execute on function is_member(uuid) to authenticated;
grant execute on function client_features(uuid) to authenticated;
grant execute on function client_is_live(clients) to authenticated;

-- ---------------------------------------------------------------- storage
-- Private bucket for guest uploads (complaint media, voice notes, moments). 10 MB cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-uploads', 'guest-uploads', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm',
              'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac'])
on conflict (id) do nothing;

-- Public bucket for page assets owners publish (logo, gallery). 2 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-assets', 'page-assets', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Guests may only upload into <client_id>/ of a live client; never read or list.
create policy guest_upload on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'guest-uploads'
  and exists (select 1 from clients c where c.id::text = (storage.foldername(name))[1] and client_is_live(c))
);
create policy members_read_uploads on storage.objects for select to authenticated
using (bucket_id = 'guest-uploads' and is_member(((storage.foldername(name))[1])::uuid));
create policy members_delete_uploads on storage.objects for delete to authenticated
using (bucket_id = 'guest-uploads' and is_member(((storage.foldername(name))[1])::uuid));

create policy members_write_assets on storage.objects for insert to authenticated
with check (bucket_id = 'page-assets' and is_member(((storage.foldername(name))[1])::uuid));
create policy members_update_assets on storage.objects for update to authenticated
using (bucket_id = 'page-assets' and is_member(((storage.foldername(name))[1])::uuid));
create policy members_delete_assets on storage.objects for delete to authenticated
using (bucket_id = 'page-assets' and is_member(((storage.foldername(name))[1])::uuid));
