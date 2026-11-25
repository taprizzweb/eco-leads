-- Self-serve mini links: anyone can build a page, the page goes live after a Rs 150 UPI payment is checked by the Taprizz team.
-- No login: the builder gets a private control link (the existing edit token). Everything goes through SECURITY DEFINER functions.

alter table public.link_pages add column if not exists plan text not null default 'full';
alter table public.link_pages drop constraint if exists link_pages_plan_ok;
alter table public.link_pages add constraint link_pages_plan_ok check (plan in ('full', 'mini'));
alter table public.link_pages add column if not exists paid_at timestamptz;

-- Who made the page. Contact details are only ever read by the Taprizz team; the marketing tick decides if they may be messaged.
create table if not exists public.mini_signups (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null unique references public.link_pages(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mini_signups_phone_idx on public.mini_signups (phone);
alter table public.mini_signups enable row level security;
drop policy if exists mini_signups_team on public.mini_signups;
create policy mini_signups_team on public.mini_signups for select using (public.is_team('manager'));

create table if not exists public.mini_payments (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.link_pages(id) on delete cascade,
  amount_inr integer not null,
  utr text not null,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists mini_payments_link_idx on public.mini_payments (link_id, created_at desc);
alter table public.mini_payments enable row level security;
drop policy if exists mini_payments_team on public.mini_payments;
create policy mini_payments_team on public.mini_payments for select using (public.is_team('manager'));

create table if not exists public.mini_settings (key text primary key, value text not null);
alter table public.mini_settings enable row level security;
drop policy if exists mini_settings_team on public.mini_settings;
create policy mini_settings_team on public.mini_settings for select using (public.is_team('manager'));
insert into public.mini_settings (key, value) values ('price_inr', '150'), ('upi_name', 'Taprizz'), ('whatsapp', '919672999166') on conflict (key) do nothing;

create table if not exists public.link_reports (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.link_pages(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.link_reports enable row level security;
drop policy if exists link_reports_team on public.link_reports;
create policy link_reports_team on public.link_reports for select using (public.is_team('manager'));

-- Payment screenshots: a private bucket. The folder name is the control token, so only its holder can add one; only the team can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pay-proofs', 'pay-proofs', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists pay_proof_upload on storage.objects;
create policy pay_proof_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'pay-proofs' and public.link_token_ok((storage.foldername(name))[1]));
drop policy if exists pay_proof_team_read on storage.objects;
create policy pay_proof_team_read on storage.objects for select to authenticated
  using (bucket_id = 'pay-proofs' and public.is_team('manager'));

-- ---------- public ----------
create or replace function public.mini_public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'price', coalesce((select value::int from mini_settings where key = 'price_inr'), 150),
    'upi_id', coalesce((select value from mini_settings where key = 'upi_id'), ''),
    'upi_name', coalesce((select value from mini_settings where key = 'upi_name'), 'Taprizz'),
    'whatsapp', coalesce((select value from mini_settings where key = 'whatsapp'), '919672999166'));
$$;
revoke all on function public.mini_public_settings() from public;
grant execute on function public.mini_public_settings() to anon, authenticated;

create or replace function public.mini_create(p_name text, p_slug text, p_phone text, p_email text, p_terms boolean, p_marketing boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text := lower(trim(coalesce(p_slug, ''))); ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); t text; i uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 80 then raise exception 'bad name'; end if;
  if s !~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$' then raise exception 'bad slug'; end if;
  if s in ('admin', 'api', 'create', 'edit', 'login', 'dashboard', 'l', 'e', 'm', 's', 'pos', 'group', 'jaipur', 'install', 'app', 'auth', 'taprizz', 'nbc', 'www', 'help', 'support', 'terms', 'privacy', 'demo') then raise exception 'slug taken'; end if;
  ph := regexp_replace(ph, '^(91|0)(?=[6-9][0-9]{9}$)', '');
  if ph !~ '^[6-9][0-9]{9}$' then raise exception 'bad phone'; end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'bad email'; end if;
  if not coalesce(p_terms, false) then raise exception 'terms needed'; end if;
  if exists (select 1 from link_pages where slug = s) then raise exception 'slug taken'; end if;
  if (select count(*) from mini_signups where created_at > now() - interval '1 hour') >= 60 then raise exception 'busy'; end if;
  if (select count(*) from mini_signups where phone = ph) >= 3 then raise exception 'too many pages'; end if;
  t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into link_pages (slug, name, published, plan, edit_token, edit_enabled, theme)
  values (s, left(trim(p_name), 80), false, 'mini', t, true, 'midnight') returning id into i;
  insert into mini_signups (link_id, name, phone, email, marketing_consent, consent_at)
  values (i, left(trim(p_name), 80), ph, nullif(lower(trim(coalesce(p_email, ''))), ''), coalesce(p_marketing, false), case when coalesce(p_marketing, false) then now() end);
  return jsonb_build_object('token', t, 'slug', s);
end $$;
revoke all on function public.mini_create(text, text, text, text, boolean, boolean) from public;
grant execute on function public.mini_create(text, text, text, text, boolean, boolean) to anon, authenticated;

create or replace function public.mini_slug_free(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(trim(coalesce(p_slug, ''))) ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'
    and not exists (select 1 from link_pages where slug = lower(trim(p_slug)));
$$;
revoke all on function public.mini_slug_free(text) from public;
grant execute on function public.mini_slug_free(text) to anon, authenticated;

-- What the builder sees about their own page: plan, live or not, and the latest payment.
create or replace function public.mini_state(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i uuid; pl text; pub boolean; pa timestamptz; pay record;
begin
  if not link_token_ok(p_token) then return null; end if;
  select id, plan, published, paid_at into i, pl, pub, pa from link_pages where edit_token = p_token;
  select status, note, created_at into pay from mini_payments where link_id = i order by created_at desc limit 1;
  return jsonb_build_object('plan', pl, 'published', pub, 'paid_at', pa,
    'payment', case when pay.status is null then null else jsonb_build_object('status', pay.status, 'note', pay.note, 'at', pay.created_at) end);
end $$;
revoke all on function public.mini_state(text) from public;
grant execute on function public.mini_state(text) to anon, authenticated;

-- A mini page keeps to its limits: 5 photos, no videos, 10 offers. Everything else is checked by _link_apply as before.
create or replace function public.link_edit_save(p_token text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i uuid; pl text; o jsonb;
begin
  if not link_token_ok(p_token) then raise exception 'not allowed'; end if;
  select id, plan into i, pl from link_pages where edit_token = p_token;
  if pl = 'mini' then
    if jsonb_array_length(coalesce(p_patch -> 'photos', '[]'::jsonb)) > 5 then raise exception 'too many photos'; end if;
    for o in select * from jsonb_array_elements(coalesce(p_patch -> 'photos', '[]'::jsonb)) loop
      if (o ->> 'kind') = 'video' or (o ->> 'url') ~* '\.(mp4|webm|mov|m4v)(\?|$)' then raise exception 'no videos'; end if;
    end loop;
    if jsonb_array_length(coalesce(p_patch -> 'offers', '[]'::jsonb)) > 10 then raise exception 'too many offers'; end if;
  end if;
  perform _link_apply(i, p_patch);
end $$;
revoke all on function public.link_edit_save(text, jsonb) from public;
grant execute on function public.link_edit_save(text, jsonb) to anon, authenticated;

create or replace function public.mini_submit_payment(p_token text, p_utr text, p_proof text) returns void
language plpgsql security definer set search_path = public as $$
declare i uuid; pl text; pub boolean; u text := upper(trim(coalesce(p_utr, '')));
begin
  if not link_token_ok(p_token) then raise exception 'not allowed'; end if;
  select id, plan, published into i, pl, pub from link_pages where edit_token = p_token;
  if pl <> 'mini' then raise exception 'not allowed'; end if;
  if pub then raise exception 'already live'; end if;
  if u !~ '^[A-Z0-9]{8,30}$' then raise exception 'bad utr'; end if;
  if p_proof is null or p_proof !~ ('^' || p_token || '/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$') then raise exception 'bad proof'; end if;
  if exists (select 1 from mini_payments where link_id = i and status = 'pending') then raise exception 'already pending'; end if;
  if (select count(*) from mini_payments where link_id = i) >= 6 then raise exception 'too many tries'; end if;
  if exists (select 1 from mini_payments where utr = u and status in ('pending', 'approved')) then raise exception 'utr used'; end if;
  insert into mini_payments (link_id, amount_inr, utr, proof_path)
  values (i, coalesce((select value::int from mini_settings where key = 'price_inr'), 150), u, p_proof);
end $$;
revoke all on function public.mini_submit_payment(text, text, text) from public;
grant execute on function public.mini_submit_payment(text, text, text) to anon, authenticated;

create or replace function public.link_report(p_slug text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare i uuid;
begin
  select id into i from link_pages where slug = lower(p_slug) and published;
  if i is null then return; end if;
  if length(trim(coalesce(p_reason, ''))) < 2 then raise exception 'bad reason'; end if;
  if (select count(*) from link_reports where created_at > now() - interval '1 hour') >= 100 then return; end if;
  insert into link_reports (link_id, reason) values (i, left(trim(p_reason), 300));
end $$;
revoke all on function public.link_report(text, text) from public;
grant execute on function public.link_report(text, text) to anon, authenticated;

-- The public page also says which plan it is, so a mini page shows its footer and report link.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if position($q$'id', l.id, 'slug', l.slug,$q$ in d) = 0 then raise exception 'public_link_page layout changed'; end if;
  if position($q$'plan', l.plan$q$ in d) = 0 then
    d := replace(d, $q$'id', l.id, 'slug', l.slug,$q$, $q$'id', l.id, 'plan', l.plan, 'slug', l.slug,$q$);
    execute d;
  end if;
end $$;

-- ---------- Taprizz team ----------
create or replace function public.mini_admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'payments', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select p.id, p.status, p.utr, p.amount_inr, p.proof_path, p.note, p.created_at, l.slug, l.name, s.phone, s.email
      from mini_payments p join link_pages l on l.id = p.link_id left join mini_signups s on s.link_id = l.id
      order by (p.status = 'pending') desc, p.created_at desc limit 200) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(y order by y.created_at desc) from (
      select l.id, l.slug, l.name, l.published, l.paid_at, l.created_at, l.edit_token, s.phone, s.email, s.marketing_consent,
        (select count(*) from link_reports r where r.link_id = l.id) as reports
      from link_pages l join mini_signups s on s.link_id = l.id order by l.created_at desc limit 500) y), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(z order by z.created_at desc) from (
      select r.id, r.reason, r.created_at, l.slug, l.name, l.published from link_reports r join link_pages l on l.id = r.link_id order by r.created_at desc limit 100) z), '[]'::jsonb),
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from mini_settings));
end $$;
revoke all on function public.mini_admin_overview() from public;
grant execute on function public.mini_admin_overview() to authenticated;

create or replace function public.mini_admin_review(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l uuid;
begin
  if not is_team('manager') then raise exception 'not allowed'; end if;
  select link_id into l from mini_payments where id = p_id and status = 'pending';
  if l is null then raise exception 'not pending'; end if;
  update mini_payments set status = case when p_approve then 'approved' else 'rejected' end, note = nullif(left(trim(coalesce(p_note, '')), 200), ''), reviewed_at = now() where id = p_id;
  if p_approve then update link_pages set published = true, paid_at = now() where id = l; end if;
end $$;
revoke all on function public.mini_admin_review(uuid, boolean, text) from public;
grant execute on function public.mini_admin_review(uuid, boolean, text) to authenticated;

create or replace function public.mini_admin_set_published(p_link uuid, p_pub boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'not allowed'; end if;
  update link_pages set published = p_pub where id = p_link and plan = 'mini';
end $$;
revoke all on function public.mini_admin_set_published(uuid, boolean) from public;
grant execute on function public.mini_admin_set_published(uuid, boolean) to authenticated;

create or replace function public.mini_admin_set_setting(p_key text, p_value text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'not allowed'; end if;
  if p_key not in ('price_inr', 'upi_id', 'upi_name', 'whatsapp') then raise exception 'bad key'; end if;
  if p_key = 'price_inr' and (p_value !~ '^[0-9]{1,5}$') then raise exception 'bad price'; end if;
  insert into mini_settings (key, value) values (p_key, left(trim(p_value), 120)) on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.mini_admin_set_setting(text, text) from public;
grant execute on function public.mini_admin_set_setting(text, text) to authenticated;
