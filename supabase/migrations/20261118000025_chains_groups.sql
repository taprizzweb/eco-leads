-- Chains: a group head sees and controls every branch of a company from one place.
-- NOT YET APPLIED to the database (waiting for the owner to approve it).
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  logo_url text,
  created_at timestamptz not null default now()
);
create table if not exists group_members (
  group_id uuid not null references groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'head' check (role in ('head')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on group_members (user_id);
alter table clients add column if not exists group_id uuid references groups on delete set null;
create index if not exists clients_group_idx on clients (group_id);

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_aal2() and (exists (select 1 from group_members m where m.group_id = gid and m.user_id = auth.uid()) or is_team('rep'));
$$;
revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- A group head is a member of every branch of the group, so each branch dashboard opens for them too.
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_aal2() and (
    exists (select 1 from client_members m where m.client_id = cid and m.user_id = auth.uid())
    or exists (select 1 from clients c join group_members g on g.group_id = c.group_id where c.id = cid and g.user_id = auth.uid())
    or is_team('rep'));
$$;

alter table groups enable row level security;
alter table group_members enable row level security;
revoke all on groups, group_members from anon;
create policy groups_read on groups for select to authenticated using (is_group_member(id));
create policy groups_team on groups for all to authenticated using (is_team('manager')) with check (is_team('manager'));
create policy group_members_read on group_members for select to authenticated using (user_id = auth.uid() or is_team('manager'));
create policy group_members_team on group_members for all to authenticated using (is_team('manager')) with check (is_team('manager'));
create trigger audit_groups after insert or update or delete on groups for each row execute function audit_row();

-- Invites for a group head
alter table invites add column if not exists group_id uuid references groups on delete cascade;
alter table invites drop constraint if exists invites_check;
alter table invites drop constraint if exists invites_kind_check;
alter table invites add constraint invites_kind_check check (kind in ('client', 'team', 'group'));
alter table invites add constraint invites_check check (
  (kind = 'client' and client_id is not null and group_id is null)
  or (kind = 'team' and client_id is null and group_id is null)
  or (kind = 'group' and group_id is not null and client_id is null));

create or replace function public.claim_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text; confirmed timestamptz; i invites; n int := 0;
begin
  if uid is null then return 0; end if;
  select lower(email), email_confirmed_at into mail, confirmed from auth.users where id = uid;
  if mail is null or confirmed is null then return 0; end if;
  for i in select * from invites where email = mail and claimed_at is null loop
    if i.kind = 'client' then
      insert into client_members (client_id, user_id, role) values (i.client_id, uid, i.member_role) on conflict do nothing;
    elsif i.kind = 'group' then
      insert into group_members (group_id, user_id, role) values (i.group_id, uid, 'head') on conflict do nothing;
    else
      insert into team_members (user_id, role) values (uid, i.team_role) on conflict (user_id) do nothing;
    end if;
    update invites set claimed_at = now(), claimed_by = uid where id = i.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- The group's unique customers who said yes to WhatsApp offers at any branch (one row per phone number, never twice).
create or replace function public.group_audience_rows(p_group uuid, p_kind text, p_days int)
returns table (name text, phone text, last_seen timestamptz) language sql stable security definer set search_path = public as $$
  with c as (
    select x.phone, (array_agg(x.name order by x.last_seen_at desc))[1] as name, max(x.last_seen_at) as last_seen, min(x.created_at) as first_seen,
           bool_or(x.whatsapp_consent) as consent, bool_or(x.opted_out_at is not null) as opted
      from contacts x join clients cl on cl.id = x.client_id where cl.group_id = p_group group by x.phone)
  select c.name, c.phone, c.last_seen from c
   where c.consent and not c.opted and case p_kind
     when 'recent' then c.last_seen >= now() - make_interval(days => p_days)
     when 'not_returned' then c.first_seen < now() - make_interval(days => p_days) and c.last_seen < c.first_seen + interval '1 day'
     else true end;
$$;
revoke execute on function public.group_audience_rows(uuid, text, int) from public, anon, authenticated;

create or replace function public.group_audience_count(p_group uuid, p_kind text, p_days int) returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_group_member(p_group) or is_team('manager')) then raise exception 'Not allowed'; end if;
  return (select count(*) from group_audience_rows(p_group, p_kind, p_days))::int;
end $$;
revoke execute on function public.group_audience_count(uuid, text, int) from public, anon;
grant execute on function public.group_audience_count(uuid, text, int) to authenticated;

create or replace function public.group_audience(p_group uuid, p_kind text, p_days int)
returns table (name text, phone text, last_seen_at timestamptz) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'Only the Taprizz team can see this list'; end if;
  return query select a.name, a.phone, a.last_seen from group_audience_rows(p_group, p_kind, p_days) a order by a.last_seen desc;
end $$;
revoke execute on function public.group_audience(uuid, text, int) from public, anon;
grant execute on function public.group_audience(uuid, text, int) to authenticated;

-- WhatsApp requests can now belong to a whole group instead of one branch.
alter table wa_requests alter column client_id drop not null;
alter table wa_requests add column if not exists group_id uuid references groups on delete cascade;
alter table wa_requests add constraint wa_requests_target_check check ((client_id is not null) <> (group_id is not null));
alter table wa_outbox alter column client_id drop not null;
alter table wa_outbox add column if not exists group_id uuid references groups on delete cascade;

drop policy if exists wa_requests_member_read on wa_requests;
drop policy if exists wa_requests_member_insert on wa_requests;
drop policy if exists wa_requests_member_delete on wa_requests;
create policy wa_requests_member_read on wa_requests for select to authenticated
  using (case when client_id is not null then is_member(client_id) else is_group_member(group_id) end);
create policy wa_requests_member_insert on wa_requests for insert to authenticated
  with check (status = 'pending' and reviewed_by is null and (
    (client_id is not null and is_member(client_id) and coalesce((select (review_setup->>'collect_contact')::boolean from clients where id = wa_requests.client_id), false))
    or (group_id is not null and is_group_member(group_id) and exists (select 1 from clients c where c.group_id = wa_requests.group_id and coalesce((c.review_setup->>'collect_contact')::boolean, false)))));
create policy wa_requests_member_delete on wa_requests for delete to authenticated
  using (status = 'pending' and case when client_id is not null then is_member(client_id) else is_group_member(group_id) end);

create or replace function public.wa_review(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r wa_requests; acc wa_accounts; cnt int;
begin
  if not is_team('manager') then raise exception 'Only the Taprizz team can do this'; end if;
  if p_status not in ('approved', 'rejected', 'sent') then raise exception 'Bad status'; end if;
  select * into r from wa_requests where id = p_id;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.group_id is not null then
    cnt := (select count(*) from group_audience_rows(r.group_id, r.audience_kind, r.audience_days))::int;
  else
    select * into acc from wa_accounts where client_id = r.client_id;
    if p_status = 'approved' and coalesce(acc.sender, 'taprizz') = 'own' and acc.setup_status <> 'ready' then
      raise exception 'This business sends from its own WhatsApp number, but that number is not set up yet';
    end if;
    cnt := wa_audience_count(r.client_id, r.audience_kind, r.audience_days);
  end if;
  update wa_requests set status = p_status, admin_note = left(p_note, 500), reviewed_by = auth.uid(), reviewed_at = now(),
    sender = case when r.group_id is not null then 'taprizz' else coalesce(acc.sender, 'taprizz') end,
    recipient_count = case when p_status = 'rejected' then null else cnt end
   where id = p_id;
  if p_status = 'approved' then
    if r.group_id is not null then
      insert into wa_outbox (request_id, group_id, phone, name)
      select p_id, r.group_id, a.phone, a.name from group_audience_rows(r.group_id, r.audience_kind, r.audience_days) a
      on conflict (request_id, phone) do nothing;
    else
      insert into wa_outbox (request_id, client_id, phone, name)
      select p_id, r.client_id, a.phone, a.name from wa_audience(r.client_id, r.audience_kind, r.audience_days) a
      on conflict (request_id, phone) do nothing;
    end if;
  end if;
end $$;
revoke execute on function public.wa_review(uuid, text, text) from public, anon;
grant execute on function public.wa_review(uuid, text, text) to authenticated;

-- One call gives the whole picture of a group: totals for the last p_days days across every branch.
create or replace function public.group_overview(p_group uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365))); ids uuid[];
begin
  if not is_group_member(p_group) then raise exception 'Not allowed'; end if;
  select coalesce(array_agg(id), '{}') into ids from clients where group_id = p_group;
  return jsonb_build_object(
    'branches', cardinality(ids),
    'taps', (select count(*) from taps t where t.client_id = any(ids) and t.created_at >= since),
    'drafts', (select count(*) from review_drafts d where d.client_id = any(ids) and d.created_at >= since),
    'copied', (select count(*) from review_drafts d where d.client_id = any(ids) and d.created_at >= since and d.copied),
    'feedback_open', (select count(*) from feedback f where f.client_id = any(ids) and f.status = 'new'),
    'customers', (select count(distinct phone) from contacts c where c.client_id = any(ids)),
    'whatsapp_ready', (select count(*) from group_audience_rows(p_group, 'all', 30)),
    'reviews', (select count(*) from google_reviews g where g.client_id = any(ids) and g.created_at >= since),
    'avg_rating', (select round(avg(rating)::numeric, 2) from google_reviews g where g.client_id = any(ids) and g.created_at >= since));
end $$;
revoke execute on function public.group_overview(uuid, int) from public, anon;
grant execute on function public.group_overview(uuid, int) to authenticated;

-- The branch table: searchable, sortable and paged, so 20 or 150 branches open just as fast.
create or replace function public.group_branches(p_group uuid, p_days int default 30, p_search text default '', p_sort text default 'name', p_limit int default 25, p_offset int default 0)
returns table (client_id uuid, slug text, name text, status text, taps bigint, drafts bigint, copied bigint, feedback_open bigint, customers bigint, avg_rating numeric, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not is_group_member(p_group) then raise exception 'Not allowed'; end if;
  return query
  with b as (select cl.id, cl.slug, cl.name, cl.status::text as st from clients cl
              where cl.group_id = p_group and (coalesce(p_search, '') = '' or cl.name ilike '%' || p_search || '%')),
  t as (select x.client_id as cid, count(*) as n from taps x where x.client_id in (select id from b) and x.created_at >= since group by 1),
  d as (select x.client_id as cid, count(*) as n, count(*) filter (where x.copied) as c from review_drafts x where x.client_id in (select id from b) and x.created_at >= since group by 1),
  f as (select x.client_id as cid, count(*) as n from feedback x where x.client_id in (select id from b) and x.status = 'new' group by 1),
  c as (select x.client_id as cid, count(*) as n from contacts x where x.client_id in (select id from b) group by 1),
  r as (select x.client_id as cid, round(avg(x.rating)::numeric, 2) as a from google_reviews x where x.client_id in (select id from b) and x.created_at >= since group by 1)
  select b.id, b.slug, b.name, b.st, coalesce(t.n, 0), coalesce(d.n, 0), coalesce(d.c, 0), coalesce(f.n, 0), coalesce(c.n, 0), r.a, count(*) over ()
    from b left join t on t.cid = b.id left join d on d.cid = b.id left join f on f.cid = b.id left join c on c.cid = b.id left join r on r.cid = b.id
   order by (case p_sort when 'taps' then coalesce(t.n, 0) when 'drafts' then coalesce(d.n, 0) when 'feedback' then coalesce(f.n, 0) when 'customers' then coalesce(c.n, 0) else 0 end) desc, b.name
   limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
end $$;
revoke execute on function public.group_branches(uuid, int, text, text, int, int) from public, anon;
grant execute on function public.group_branches(uuid, int, text, text, int, int) to authenticated;

create or replace function public.admin_group_heads(p_group uuid) returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team('manager') then raise exception 'Not allowed'; end if;
  return query select m.user_id, u.email::text from group_members m join auth.users u on u.id = m.user_id where m.group_id = p_group order by u.email;
end $$;
revoke execute on function public.admin_group_heads(uuid) from public, anon;
grant execute on function public.admin_group_heads(uuid) to authenticated;
