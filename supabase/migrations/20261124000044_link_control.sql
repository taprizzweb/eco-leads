-- Mini link control: per-button click counts, a client-side editor (logged-in owner/manager) and a private
-- control link (secret token, no login) for people who only buy a mini link.
-- Everything goes through SECURITY DEFINER functions that whitelist the editable columns. link_pages stays closed.

alter table public.link_pages
  add column if not exists edit_token text unique,
  add column if not exists edit_enabled boolean not null default true;

create table if not exists public.link_button_stats (
  link_id uuid not null references public.link_pages(id) on delete cascade,
  day date not null,
  key text not null,
  clicks integer not null default 0,
  primary key (link_id, day, key)
);
alter table public.link_button_stats enable row level security;
drop policy if exists link_button_stats_team on public.link_button_stats;
create policy link_button_stats_team on public.link_button_stats for select using (public.is_team('manager'));

-- ---------- tracking ----------
drop function if exists public.link_track(uuid, text);
create or replace function public.link_track(p_id uuid, p_kind text, p_key text default null)
returns void language plpgsql security definer set search_path = public as $$
declare k text := nullif(left(trim(coalesce(p_key, '')), 60), '');
begin
  if p_kind not in ('view', 'click') then return; end if;
  if not exists (select 1 from link_pages where id = p_id and published) then return; end if;
  insert into link_stats (link_id, day, views, clicks) values (p_id, current_date, (p_kind = 'view')::int, (p_kind = 'click')::int)
  on conflict (link_id, day) do update set views = link_stats.views + (p_kind = 'view')::int, clicks = link_stats.clicks + (p_kind = 'click')::int;
  if p_kind = 'click' and k is not null then
    -- A page has a handful of buttons. Cap the distinct names per day so nobody can fill the table.
    if exists (select 1 from link_button_stats where link_id = p_id and day = current_date and key = k)
       or (select count(*) from link_button_stats where link_id = p_id and day = current_date) < 80 then
      insert into link_button_stats (link_id, day, key, clicks) values (p_id, current_date, k, 1)
      on conflict (link_id, day, key) do update set clicks = link_button_stats.clicks + 1;
    end if;
  end if;
end $$;
revoke all on function public.link_track(uuid, text, text) from public;
grant execute on function public.link_track(uuid, text, text) to anon, authenticated;

-- ---------- shared helpers (not callable from outside) ----------
create or replace function public._link_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'slug', l.slug, 'client_id', l.client_id, 'name', l.name, 'tagline', l.tagline, 'logo_url', l.logo_url,
    'theme', l.theme, 'tags', to_jsonb(l.tags), 'socials', l.socials, 'photos', l.photos, 'photo_direction', l.photo_direction,
    'buttons', l.buttons, 'outlets', l.outlets, 'offers', coalesce(l.offers, '[]'::jsonb), 'reviews', l.reviews,
    'show_client_reviews', l.show_client_reviews, 'published', l.published)
  from link_pages l where l.id = p_id;
$$;
revoke all on function public._link_json(uuid) from public, anon, authenticated;

-- A web address a visitor may be sent to. Blocks javascript: and data: links.
create or replace function public._link_url_ok(u text, allow_hash boolean default false) returns boolean
language sql immutable as $$
  select u is null or u = '' or (allow_hash and u in ('#offers', '#outlets')) or u ~* '^(https?://|tel:|mailto:)[^\s]+$';
$$;
revoke all on function public._link_url_ok(text, boolean) from public, anon, authenticated;

create or replace function public._link_arr(p jsonb, k text, mx int, cur jsonb) returns jsonb
language sql immutable as $$
  select case when p ? k and jsonb_typeof(p -> k) = 'array' and jsonb_array_length(p -> k) <= mx then p -> k else cur end;
$$;
revoke all on function public._link_arr(jsonb, text, int, jsonb) from public, anon, authenticated;

create or replace function public._link_apply(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l link_pages; b jsonb; o jsonb; s record; nb jsonb; nph jsonb; nout jsonb; noff jsonb; nsoc jsonb; nth text; ntags text[];
begin
  select * into l from link_pages where id = p_id;
  if l.id is null then raise exception 'not found'; end if;
  if pg_column_size(p) > 400000 then raise exception 'too large'; end if;

  nb := _link_arr(p, 'buttons', 12, l.buttons);
  for b in select * from jsonb_array_elements(nb) loop
    if not _link_url_ok(b ->> 'url', true) then raise exception 'bad button link'; end if;
  end loop;
  nout := _link_arr(p, 'outlets', 30, l.outlets);
  for o in select * from jsonb_array_elements(nout) loop
    if not (_link_url_ok(o ->> 'map_url') and _link_url_ok(o ->> 'review_url') and _link_url_ok(o ->> 'image_url') and _link_url_ok(o ->> 'instagram')) then raise exception 'bad outlet link'; end if;
  end loop;
  noff := _link_arr(p, 'offers', 60, coalesce(l.offers, '[]'::jsonb));
  for o in select * from jsonb_array_elements(noff) loop
    if not _link_url_ok(o ->> 'link') then raise exception 'bad offer link'; end if;
  end loop;
  nph := _link_arr(p, 'photos', 30, l.photos);
  for o in select * from jsonb_array_elements(nph) loop
    if not _link_url_ok(o ->> 'url') then raise exception 'bad photo link'; end if;
  end loop;
  nsoc := case when p ? 'socials' and jsonb_typeof(p -> 'socials') = 'object' then p -> 'socials' else l.socials end;
  for s in select key, value from jsonb_each_text(nsoc) loop
    if s.key not in ('phone', 'whatsapp') and not _link_url_ok(s.value) then raise exception 'bad social link'; end if;
  end loop;
  nth := case when p ? 'theme' and (p ->> 'theme') in ('midnight','graphite','obsidian','ocean','wine','forest','plum','ivory') then p ->> 'theme' else l.theme end;
  ntags := case when p ? 'tags' and jsonb_typeof(p -> 'tags') = 'array' and jsonb_array_length(p -> 'tags') <= 20
    then array(select left(trim(x), 40) from jsonb_array_elements_text(p -> 'tags') x where trim(x) <> '') else l.tags end;
  if p ? 'logo_url' and not _link_url_ok(p ->> 'logo_url') then raise exception 'bad logo link'; end if;

  update link_pages set
    name = coalesce(nullif(left(trim(p ->> 'name'), 80), ''), l.name),
    tagline = case when p ? 'tagline' then nullif(left(trim(p ->> 'tagline'), 120), '') else l.tagline end,
    logo_url = case when p ? 'logo_url' then nullif(p ->> 'logo_url', '') else l.logo_url end,
    theme = nth, tags = ntags, socials = nsoc, photos = nph, buttons = nb, outlets = nout, offers = noff,
    photo_direction = case when (p ->> 'photo_direction') in ('forward', 'backward') then p ->> 'photo_direction' else l.photo_direction end,
    updated_at = now()
  where id = p_id;
end $$;
revoke all on function public._link_apply(uuid, jsonb) from public, anon, authenticated;

create or replace function public._link_stats(p_id uuid, p_days int) returns jsonb
language sql stable security definer set search_path = public as $$
  with n as (select greatest(1, least(coalesce(p_days, 30), 90)) as d),
  days as (
    select g::date as day from n, generate_series(current_date - (n.d - 1), current_date, interval '1 day') g
  ),
  per as (
    select days.day, coalesce(s.views, 0) as views, coalesce(s.clicks, 0) as clicks
    from days left join link_stats s on s.link_id = p_id and s.day = days.day
  ),
  btn as (
    select key, sum(clicks)::int as clicks from link_button_stats, n
    where link_id = p_id and day >= current_date - (n.d - 1) group by key order by sum(clicks) desc limit 40
  )
  select jsonb_build_object(
    'days', (select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'clicks', clicks) order by day) from per),
    'buttons', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'clicks', clicks) order by clicks desc) from btn), '[]'::jsonb),
    'views', (select coalesce(sum(views), 0) from per), 'clicks', (select coalesce(sum(clicks), 0) from per),
    'since_start', (select jsonb_build_object('views', coalesce(sum(views), 0), 'clicks', coalesce(sum(clicks), 0)) from link_stats where link_id = p_id)
  );
$$;
revoke all on function public._link_stats(uuid, int) from public, anon, authenticated;

-- ---------- 1) the private control link (no login) ----------
create or replace function public.link_token_ok(p_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(length(p_token), 0) >= 32 and exists (select 1 from link_pages where edit_token = p_token and edit_enabled);
$$;
revoke all on function public.link_token_ok(text) from public;
grant execute on function public.link_token_ok(text) to anon, authenticated;

create or replace function public.link_edit_load(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i uuid;
begin
  if not link_token_ok(p_token) then return null; end if;
  select id into i from link_pages where edit_token = p_token;
  return _link_json(i);
end $$;
create or replace function public.link_edit_save(p_token text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i uuid;
begin
  if not link_token_ok(p_token) then raise exception 'not allowed'; end if;
  select id into i from link_pages where edit_token = p_token;
  perform _link_apply(i, p_patch);
end $$;
create or replace function public.link_edit_stats(p_token text, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i uuid;
begin
  if not link_token_ok(p_token) then return null; end if;
  select id into i from link_pages where edit_token = p_token;
  return _link_stats(i, p_days);
end $$;
revoke all on function public.link_edit_load(text), public.link_edit_save(text, jsonb), public.link_edit_stats(text, int) from public;
grant execute on function public.link_edit_load(text), public.link_edit_save(text, jsonb), public.link_edit_stats(text, int) to anon, authenticated;

-- Uploads from the control link go to page-assets/link-edit/<token>/... The folder name is the secret, so only its holder can upload.
drop policy if exists link_edit_upload on storage.objects;
create policy link_edit_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'page-assets' and (storage.foldername(name))[1] = 'link-edit' and public.link_token_ok((storage.foldername(name))[2]));

-- Taprizz team: make, reset, switch off the control link.
create or replace function public.link_token_set(p_id uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not is_team('manager') then raise exception 'not allowed'; end if;
  if p_action in ('create', 'reset') then
    t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update link_pages set edit_token = t, edit_enabled = true where id = p_id;
  elsif p_action = 'disable' then update link_pages set edit_enabled = false where id = p_id;
  elsif p_action = 'enable' then update link_pages set edit_enabled = true where id = p_id and edit_token is not null;
  else raise exception 'bad action'; end if;
  select edit_token into t from link_pages where id = p_id;
  return t;
end $$;
revoke all on function public.link_token_set(uuid, text) from public;
grant execute on function public.link_token_set(uuid, text) to authenticated;

-- ---------- 2) a logged-in owner or manager of the business ----------
create or replace function public._link_member_ok(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from link_pages l where l.id = p_id and l.client_id is not null and coalesce(my_client_role(l.client_id), '') in ('owner', 'manager'));
$$;
revoke all on function public._link_member_ok(uuid) from public, anon, authenticated;

create or replace function public.link_my_page(p_client uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i uuid;
begin
  if coalesce(my_client_role(p_client), '') not in ('owner', 'manager') then return null; end if;
  select id into i from link_pages where client_id = p_client order by updated_at desc limit 1;
  if i is null then return null; end if;
  return _link_json(i);
end $$;
create or replace function public.link_my_save(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _link_member_ok(p_id) then raise exception 'not allowed'; end if;
  perform _link_apply(p_id, p_patch);
end $$;
create or replace function public.link_my_stats(p_id uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _link_member_ok(p_id) then return null; end if;
  return _link_stats(p_id, p_days);
end $$;
revoke all on function public.link_my_page(uuid), public.link_my_save(uuid, jsonb), public.link_my_stats(uuid, int) from public;
grant execute on function public.link_my_page(uuid), public.link_my_save(uuid, jsonb), public.link_my_stats(uuid, int) to authenticated;

-- ---------- 3) the Taprizz team sees every page ----------
create or replace function public.link_admin_stats(p_id uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team('manager') then return null; end if;
  return _link_stats(p_id, p_days);
end $$;
revoke all on function public.link_admin_stats(uuid, int) from public;
grant execute on function public.link_admin_stats(uuid, int) to authenticated;
