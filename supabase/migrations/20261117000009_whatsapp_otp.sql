-- WhatsApp codes as the second step, sent only when needed:
--   * new or untrusted device (a trusted device skips the code for 30 days)
--   * sensitive actions call recently_verified() and ask for a fresh code
-- The code is generated and sent inside the database (pg_net -> WhatsApp Cloud API),
-- so it never passes through the website. Only a hash is stored.
-- The authenticator app (Supabase TOTP, aal2) keeps working as a backup.

create extension if not exists pg_net;

create table user_security (
  user_id uuid primary key references auth.users on delete cascade,
  whatsapp_phone text check (whatsapp_phone ~ '^[1-9][0-9]{9,14}$'),   -- E.164 digits, e.g. 919876543210
  phone_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table verified_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  method text not null,             -- whatsapp | device | totp
  verified_at timestamptz not null default now()
);

create table trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null
);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  purpose text not null check (purpose in ('signin', 'enroll', 'stepup')),
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  request_id bigint,                -- pg_net request, to check delivery
  created_at timestamptz not null default now()
);

create index on verified_sessions (user_id);
create index on trusted_devices (user_id);
create index on otp_codes (user_id, created_at desc);

alter table user_security enable row level security;
alter table verified_sessions enable row level security;
alter table trusted_devices enable row level security;
alter table otp_codes enable row level security;
-- No direct access: everything goes through the functions below.
create policy own_devices_read on trusted_devices for select to authenticated using (user_id = auth.uid());

create or replace function current_session_id() returns uuid
language sql stable set search_path = public as $$
  select nullif(auth.jwt()->>'session_id', '')::uuid;
$$;

-- A session counts as verified when Supabase says aal2 (authenticator app)
-- or when this session passed a WhatsApp code or a trusted-device check.
create or replace function has_aal2()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or exists (select 1 from verified_sessions v
                 where v.session_id = current_session_id() and v.user_id = auth.uid()
                   and v.verified_at > now() - interval '30 days');
$$;

-- For sensitive actions: verified within the last p_minutes.
create or replace function recently_verified(p_minutes int default 10)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from verified_sessions v
                 where v.session_id = current_session_id() and v.user_id = auth.uid()
                   and v.method <> 'device' and v.verified_at > now() - make_interval(mins => p_minutes))
      or (coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
          and to_timestamp((auth.jwt()->>'iat')::bigint) > now() - make_interval(mins => p_minutes));
$$;

create or replace function whatsapp_ready()
returns boolean language sql stable security definer set search_path = public, vault as $$
  select (select count(*) from vault.decrypted_secrets
          where name in ('whatsapp_token', 'whatsapp_phone_number_id', 'whatsapp_otp_template')
            and coalesce(decrypted_secret, '') <> '') = 3;
$$;

create or replace function mask_phone(p text) returns text
language sql immutable set search_path = public as $$
  select case when p is null then null else '+' || left(p, 2) || ' ••••• ' || right(p, 4) end;
$$;

-- What the verify screen needs to know. Never returns a full phone number.
create or replace function my_security_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s user_security;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into s from user_security where user_id = auth.uid();
  return jsonb_build_object(
    'verified', has_aal2(),
    'whatsapp_ready', whatsapp_ready(),
    'phone', mask_phone(s.whatsapp_phone),
    'phone_verified', s.phone_verified_at is not null,
    'has_totp', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified' and f.factor_type = 'totp')
  );
end $$;

create or replace function otp_hash(p_user uuid, p_code text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p_user::text || ':' || p_code, 'sha256'), 'hex');
$$;

-- Sends a WhatsApp code. p_phone is only used when adding or changing the number.
create or replace function otp_request(p_purpose text, p_phone text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, vault, extensions as $$
declare
  uid uuid := auth.uid();
  s user_security;
  target text;
  code text;
  last_at timestamptz;
  n_hour int; n_day int;
  token text; phone_id text; tpl text;
  req bigint;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_purpose not in ('signin', 'enroll', 'stepup') then raise exception 'Bad purpose'; end if;
  if not whatsapp_ready() then raise exception 'WhatsApp codes are not switched on yet'; end if;

  select * into s from user_security where user_id = uid;
  if p_purpose = 'enroll' then
    -- Changing an already verified number is a sensitive action.
    if s.phone_verified_at is not null and not recently_verified(10) then
      raise exception 'Confirm it is you before changing your WhatsApp number';
    end if;
    target := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    if length(target) = 10 then target := '91' || target; end if;
    if target !~ '^[1-9][0-9]{9,14}$' then raise exception 'Enter a valid mobile number'; end if;
  else
    if s.phone_verified_at is null then raise exception 'Add your WhatsApp number first'; end if;
    target := s.whatsapp_phone;
  end if;

  -- Cost control: 1 a minute, 5 an hour, 10 a day per person.
  select max(created_at), count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into last_at, n_hour, n_day
    from otp_codes where user_id = uid and created_at > now() - interval '1 day';
  if last_at > now() - interval '60 seconds' then
    raise exception 'Please wait % seconds before asking for another code', 60 - extract(epoch from now() - last_at)::int;
  end if;
  if n_hour >= 5 or n_day >= 10 then raise exception 'Too many codes asked for. Try again later or use your authenticator app'; end if;

  code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint & 2147483647) % 1000000)::text, 6, '0');
  update otp_codes set used_at = now() where user_id = uid and used_at is null;   -- only the newest code works

  select decrypted_secret into token from vault.decrypted_secrets where name = 'whatsapp_token';
  select decrypted_secret into phone_id from vault.decrypted_secrets where name = 'whatsapp_phone_number_id';
  select decrypted_secret into tpl from vault.decrypted_secrets where name = 'whatsapp_otp_template';

  select net.http_post(
    url := 'https://graph.facebook.com/v21.0/' || phone_id || '/messages',
    headers := jsonb_build_object('Authorization', 'Bearer ' || token, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'messaging_product', 'whatsapp',
      'to', target,
      'type', 'template',
      'template', jsonb_build_object(
        'name', tpl,
        'language', jsonb_build_object('code', 'en'),
        'components', jsonb_build_array(
          jsonb_build_object('type', 'body', 'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', code))),
          jsonb_build_object('type', 'button', 'sub_type', 'url', 'index', '0',
                             'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', code)))
        )
      )
    )
  ) into req;

  insert into otp_codes (user_id, purpose, phone, code_hash, expires_at, request_id)
  values (uid, p_purpose, target, otp_hash(uid, code), now() + interval '10 minutes', req);

  return jsonb_build_object('sent_to', mask_phone(target), 'expires_in', 600, 'retry_in', 60);
end $$;

-- Checks the code; on success marks this session verified (and saves the number when enrolling).
create or replace function otp_verify(p_code text)
returns boolean language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); c otp_codes; sid uuid := current_session_id();
begin
  if uid is null or sid is null then raise exception 'Not signed in'; end if;
  select * into c from otp_codes
   where user_id = uid and used_at is null and expires_at > now()
   order by created_at desc limit 1;
  if c.id is null then raise exception 'That code has expired. Ask for a new one'; end if;
  if c.attempts >= 5 then raise exception 'Too many wrong tries. Ask for a new code'; end if;
  if c.code_hash <> otp_hash(uid, regexp_replace(coalesce(p_code, ''), '\D', '', 'g')) then
    update otp_codes set attempts = attempts + 1 where id = c.id;
    return false;
  end if;
  update otp_codes set used_at = now() where id = c.id;
  if c.purpose = 'enroll' then
    insert into user_security (user_id, whatsapp_phone, phone_verified_at, updated_at)
    values (uid, c.phone, now(), now())
    on conflict (user_id) do update set whatsapp_phone = excluded.whatsapp_phone, phone_verified_at = now(), updated_at = now();
  end if;
  insert into verified_sessions (session_id, user_id, method) values (sid, uid, 'whatsapp')
  on conflict (session_id) do update set method = 'whatsapp', verified_at = now();
  return true;
end $$;

-- After a code (or authenticator) check, remember this device for 30 days. Returns the raw token once.
create or replace function device_trust_create(p_label text default null)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); tok text;
begin
  if uid is null or not has_aal2() then raise exception 'Verify first'; end if;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  delete from trusted_devices where user_id = uid and expires_at < now();
  insert into trusted_devices (user_id, token_hash, label, expires_at)
  values (uid, encode(extensions.digest(tok, 'sha256'), 'hex'), left(p_label, 80), now() + interval '30 days');
  return tok;
end $$;

-- Called on sign-in: a trusted device verifies the new session without a code.
create or replace function device_trust_check(p_token text)
returns boolean language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); sid uuid := current_session_id(); d trusted_devices;
begin
  if uid is null or sid is null or coalesce(p_token, '') = '' then return false; end if;
  select * into d from trusted_devices
   where user_id = uid and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now();
  if d.id is null then return false; end if;
  update trusted_devices set last_used_at = now() where id = d.id;
  insert into verified_sessions (session_id, user_id, method) values (sid, uid, 'device')
  on conflict (session_id) do nothing;
  return true;
end $$;

-- Lets someone sign out every other device (e.g. phone lost).
create or replace function device_trust_revoke_all()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not recently_verified(10) then raise exception 'Confirm it is you first'; end if;
  delete from trusted_devices where user_id = auth.uid();
end $$;

revoke execute on function otp_hash(uuid, text) from public, anon, authenticated;
revoke execute on function whatsapp_ready() from public, anon, authenticated;
revoke execute on function mask_phone(text) from public, anon, authenticated;
grant execute on function current_session_id() to authenticated;
grant execute on function has_aal2() to authenticated;
grant execute on function recently_verified(int) to authenticated;
grant execute on function my_security_status() to authenticated;
grant execute on function otp_request(text, text) to authenticated;
grant execute on function otp_verify(text) to authenticated;
grant execute on function device_trust_create(text) to authenticated;
grant execute on function device_trust_check(text) to authenticated;
grant execute on function device_trust_revoke_all() to authenticated;
