-- WhatsApp offers: the name and number form exists only for businesses that switched WhatsApp offers on (default off).
alter table clients disable trigger clients_guard;
update clients set review_setup = coalesce(review_setup, '{}'::jsonb) || '{"collect_contact": false}'::jsonb;
alter table clients enable trigger clients_guard;

create table if not exists wa_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  image_url text,
  audience_kind text not null default 'recent' check (audience_kind in ('recent', 'not_returned', 'all')),
  audience_days int not null default 30 check (audience_days between 1 and 365),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent')),
  admin_note text,
  recipient_count int,
  requested_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wa_requests_client_idx on wa_requests (client_id, created_at desc);
create index if not exists wa_requests_status_idx on wa_requests (status, created_at desc);
alter table wa_requests enable row level security;
revoke all on wa_requests from anon;

create policy wa_requests_member_read on wa_requests for select to authenticated using (is_member(client_id));
create policy wa_requests_member_insert on wa_requests for insert to authenticated
  with check (is_member(client_id) and status = 'pending' and reviewed_by is null
    and coalesce((select (review_setup->>'collect_contact')::boolean from clients where id = client_id), false));
create policy wa_requests_member_delete on wa_requests for delete to authenticated using (is_member(client_id) and status = 'pending');
create policy wa_requests_team_update on wa_requests for update to authenticated using (is_team('manager')) with check (is_team('manager'));
create trigger audit_wa_requests after insert or update or delete on wa_requests for each row execute function audit_row();

-- Who would receive a message: only guests who ticked WhatsApp offers and have not opted out.
create or replace function public.wa_audience_count(p_client uuid, p_kind text, p_days int)
returns integer language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if not (is_member(p_client) or is_team('manager')) then raise exception 'Not allowed'; end if;
  select count(*) into n from contacts c
   where c.client_id = p_client and c.whatsapp_consent and c.opted_out_at is null
     and case p_kind
       when 'recent' then c.last_seen_at >= now() - make_interval(days => p_days)
       when 'not_returned' then c.created_at < now() - make_interval(days => p_days) and c.last_seen_at < c.created_at + interval '1 day'
       else true end;
  return n;
end $$;
revoke execute on function public.wa_audience_count(uuid, text, int) from public, anon;
grant execute on function public.wa_audience_count(uuid, text, int) to authenticated;

-- The audience as rows (name, number), for the Taprizz team only.
create or replace function public.wa_audience(p_client uuid, p_kind text, p_days int)
returns table (name text, phone text, last_seen_at timestamptz) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'Only the Taprizz team can see this list'; end if;
  return query select c.name, c.phone, c.last_seen_at from contacts c
   where c.client_id = p_client and c.whatsapp_consent and c.opted_out_at is null
     and case p_kind
       when 'recent' then c.last_seen_at >= now() - make_interval(days => p_days)
       when 'not_returned' then c.created_at < now() - make_interval(days => p_days) and c.last_seen_at < c.created_at + interval '1 day'
       else true end
   order by c.last_seen_at desc;
end $$;
revoke execute on function public.wa_audience(uuid, text, int) from public, anon;
grant execute on function public.wa_audience(uuid, text, int) to authenticated;

-- Approve or reject a request. Approving freezes how many people it would reach.
create or replace function public.wa_review(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r wa_requests;
begin
  if not is_team('manager') then raise exception 'Only the Taprizz team can do this'; end if;
  if p_status not in ('approved', 'rejected', 'sent') then raise exception 'Bad status'; end if;
  select * into r from wa_requests where id = p_id;
  if r.id is null then raise exception 'Request not found'; end if;
  update wa_requests set status = p_status, admin_note = left(p_note, 500), reviewed_by = auth.uid(), reviewed_at = now(),
    recipient_count = case when p_status = 'rejected' then null else wa_audience_count(r.client_id, r.audience_kind, r.audience_days) end
   where id = p_id;
end $$;
revoke execute on function public.wa_review(uuid, text, text) from public, anon;
grant execute on function public.wa_review(uuid, text, text) to authenticated;

create or replace function public.guest_register_visitor(p_client uuid, p_name text, p_phone text, p_marketing boolean default false)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare c clients; ph text; nm text; cid uuid;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not available'; end if;
  if coalesce((c.review_setup->>'collect_contact')::boolean, false) = false then return null; end if;
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
      'collect_contact', coalesce((c.review_setup->>'collect_contact')::boolean, false))
  );
end $function$;

revoke execute on function guest_register_visitor(uuid, text, text, boolean) from public;
grant execute on function guest_register_visitor(uuid, text, text, boolean) to anon, authenticated;
