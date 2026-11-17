-- Creators corner (invited collabs with visit codes) and review replies.

alter table clients add column if not exists creator_settings jsonb not null default '{}'::jsonb;

-- google_reviews: reviews the owner pastes (or, later, that Google sends) plus a suggested reply.
alter table google_reviews
  add column if not exists reply_draft text,
  add column if not exists replied_at timestamptz,
  add column if not exists source text not null default 'manual',
  add column if not exists reviewed_on date;

create table if not exists creator_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text not null,
  handle text not null,
  followers_range text,
  city text,
  phone text not null,
  plan text,
  preferred_day date,
  contact_consent boolean not null default false,
  always_welcome boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  visit_code text,
  approved_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, visit_code)
);

create table if not exists creator_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  request_id uuid references creator_requests on delete set null,
  handle text not null,
  post_url text not null,
  media_path text,
  repost_consent boolean not null,
  status text not null default 'new' check (status in ('new', 'verified', 'posted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists creator_requests_client_idx on creator_requests (client_id, status, created_at desc);
create index if not exists creator_posts_client_idx on creator_posts (client_id, status, created_at desc);

alter table creator_requests enable row level security;
alter table creator_posts enable row level security;
create policy creator_requests_member on creator_requests for all to authenticated using (is_member(client_id)) with check (is_member(client_id));
create policy creator_posts_member on creator_posts for all to authenticated using (is_member(client_id)) with check (is_member(client_id));
revoke all on creator_requests, creator_posts from anon;

-- ---------------------------------------------------------------- guest side
-- What the guest sees in Creators corner. Never exposes caps, phone numbers or the always-welcome list.
create or replace function guest_creators_info(p_client uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c clients; s jsonb;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then return null; end if;
  if not coalesce((client_features(p_client)->>'creators')::boolean, false) then return null; end if;
  s := coalesce(c.creator_settings, '{}'::jsonb);
  return jsonb_build_object(
    'brief', coalesce(s->'brief', '{}'::jsonb),
    'barter', s->>'barter',
    'intro', s->>'intro',
    'ranges', coalesce(s->'ranges', '["1k-5k","5k-20k","20k-100k","100k+"]'::jsonb),
    'blackout_days', coalesce(s->'blackout_days', '[]'::jsonb));
end $$;

create or replace function guest_submit_collab(
  p_client uuid, p_name text, p_handle text, p_range text, p_city text, p_phone text,
  p_plan text, p_day date, p_consent boolean)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare c clients; s jsonb; h text; ph text; rid uuid; ranges jsonb;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting requests'; end if;
  if not coalesce((client_features(p_client)->>'creators')::boolean, false) then raise exception 'Not available'; end if;
  s := coalesce(c.creator_settings, '{}'::jsonb);
  h := lower(regexp_replace(coalesce(p_handle, ''), '^@', ''));
  if h !~ '^[a-z0-9._]{1,30}$' then raise exception 'Enter your Instagram handle, like name.surname'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'Add your name'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(ph) = 10 then ph := '91' || ph; end if;
  if ph !~ '^[1-9][0-9]{9,14}$' then raise exception 'Enter a valid mobile number'; end if;
  if not coalesce(p_consent, false) then raise exception 'Please tick that the business may contact you'; end if;
  ranges := coalesce(s->'ranges', '["1k-5k","5k-20k","20k-100k","100k+"]'::jsonb);
  if p_range is not null and not (ranges ? p_range) then raise exception 'That follower range is not accepted right now'; end if;
  if p_day is not null and p_day < current_date then raise exception 'Pick a day from today onwards'; end if;
  if p_day is not null and coalesce(s->'blackout_days', '[]'::jsonb) ? to_char(p_day, 'YYYY-MM-DD') then
    raise exception 'We are not hosting creators on that day. Please pick another'; end if;
  if exists (select 1 from creator_requests where client_id = p_client and handle = h
             and status in ('pending', 'approved') and created_at > now() - interval '30 days') then
    raise exception 'You already have a request with us. We will message you on WhatsApp'; end if;
  if not guest_rate_ok(p_client, 'creator_requests', 30, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into creator_requests (client_id, name, handle, followers_range, city, phone, plan, preferred_day, contact_consent, always_welcome)
  values (p_client, left(trim(p_name), 80), h, p_range, left(p_city, 60), ph, left(p_plan, 200), p_day, true,
          coalesce(s->'always_welcome', '[]'::jsonb) ? h)
  returning id into rid;
  return rid;
end $$;

create or replace function guest_submit_creator_post(
  p_client uuid, p_handle text, p_url text, p_media text, p_consent boolean, p_code text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare c clients; h text; rid uuid; pid uuid;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting posts'; end if;
  if not coalesce((client_features(p_client)->>'creators')::boolean, false) then raise exception 'Not available'; end if;
  h := lower(regexp_replace(coalesce(p_handle, ''), '^@', ''));
  if h !~ '^[a-z0-9._]{1,30}$' then raise exception 'Enter your Instagram handle, like name.surname'; end if;
  if coalesce(p_url, '') !~* '^https://(www\.)?instagram\.com/(reel|reels|p|tv)/[A-Za-z0-9_-]+' then
    raise exception 'Paste the link of your reel or post. It starts with https://www.instagram.com/'; end if;
  if not coalesce(p_consent, false) then raise exception 'Please tick that the business may repost this'; end if;
  if p_media is not null and p_media not like p_client::text || '/%' then raise exception 'Bad attachment path'; end if;
  if not guest_rate_ok(p_client, 'creator_posts', 30, interval '1 hour') then raise exception 'Too many posts, try again shortly'; end if;
  select id into rid from creator_requests
   where client_id = p_client and status = 'approved' and handle = h
     and (coalesce(p_code, '') = '' or visit_code = upper(trim(p_code)))
   order by approved_at desc limit 1;
  insert into creator_posts (client_id, request_id, handle, post_url, media_path, repost_consent)
  values (p_client, rid, h, left(p_url, 500), p_media, true) returning id into pid;
  return pid;
end $$;

-- ---------------------------------------------------------------- owner side
-- Approving checks this month's cap (default 8, 0 means no cap) and creates the visit code.
create or replace function owner_approve_collab(p_id uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare r creator_requests; s jsonb; cap int; used int; code text;
begin
  select * into r from creator_requests where id = p_id;
  if r.id is null or not is_member(r.client_id) then raise exception 'Not allowed'; end if;
  if r.status = 'approved' then return r.visit_code; end if;
  select coalesce(creator_settings, '{}'::jsonb) into s from clients where id = r.client_id;
  cap := coalesce((s->>'monthly_cap')::int, 8);
  select count(*) into used from creator_requests
   where client_id = r.client_id and status = 'approved'
     and approved_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
  if cap > 0 and used >= cap then raise exception 'You have reached this month''s limit of % collabs', cap; end if;
  loop
    code := 'TZ-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
    exit when not exists (select 1 from creator_requests where client_id = r.client_id and visit_code = code);
  end loop;
  update creator_requests set status = 'approved', visit_code = code, approved_at = now() where id = p_id;
  return code;
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function guest_creators_info(uuid) from public;
revoke execute on function guest_submit_collab(uuid, text, text, text, text, text, text, date, boolean) from public;
revoke execute on function guest_submit_creator_post(uuid, text, text, text, boolean, text) from public;
revoke execute on function owner_approve_collab(uuid) from public, anon;
grant execute on function guest_creators_info(uuid) to anon, authenticated;
grant execute on function guest_submit_collab(uuid, text, text, text, text, text, text, date, boolean) to anon, authenticated;
grant execute on function guest_submit_creator_post(uuid, text, text, text, boolean, text) to anon, authenticated;
grant execute on function owner_approve_collab(uuid) to authenticated;
