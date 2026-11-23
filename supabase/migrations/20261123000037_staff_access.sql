-- A business owner adds their own people with a role. owner/manager: everything. reception: food orders, calls, chat, announcements. waiter: live orders and table requests only.
-- The screens enforce what each role sees; the database enforces who may change business settings and who may manage access.

create or replace function public.my_client_role(cid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not has_aal2() then null
    when is_team('rep') then 'owner'
    when exists (select 1 from clients c join group_members g on g.group_id = c.group_id where c.id = cid and g.user_id = auth.uid()) then 'owner'
    else (select m.role::text from client_members m where m.client_id = cid and m.user_id = auth.uid())
  end;
$$;

-- Only owners and managers change business settings. Reception and waiters can still do their own jobs in other tables.
alter policy clients_update on clients
  using (is_member(id) and coalesce(my_client_role(id), 'owner') in ('owner', 'manager'))
  with check (is_member(id) and coalesce(my_client_role(id), 'owner') in ('owner', 'manager'));

create or replace function public.client_access_list(p_client uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(my_client_role(p_client), '') not in ('owner', 'manager') then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'role', m.role, 'last_seen', u.last_sign_in_at) order by m.created_at)
                         from client_members m join auth.users u on u.id = m.user_id where m.client_id = p_client), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.member_role) order by i.created_at)
                         from invites i where i.client_id = p_client and i.kind = 'client' and i.claimed_at is null), '[]'::jsonb));
end $$;

create or replace function public.client_staff_invite(p_client uuid, p_email text, p_role text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare me text := my_client_role(p_client); mail text := lower(btrim(coalesce(p_email, ''))); uid uuid; r member_role;
begin
  if coalesce(me, '') not in ('owner', 'manager') then raise exception 'Not allowed'; end if;
  if p_role not in ('manager', 'reception', 'waiter') then raise exception 'Choose manager, reception or waiter'; end if;
  if p_role = 'manager' and me <> 'owner' then raise exception 'Only the owner can add a manager'; end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if (select count(*) from client_members where client_id = p_client) + (select count(*) from invites where client_id = p_client and kind = 'client' and claimed_at is null) >= 25 then raise exception 'That is the limit of 25 people'; end if;
  r := p_role::member_role;
  select id into uid from auth.users where lower(email) = mail and email_confirmed_at is not null limit 1;
  if uid is not null then
    insert into client_members (client_id, user_id, role) values (p_client, uid, r) on conflict (client_id, user_id) do update set role = excluded.role where client_members.role <> 'owner';
    return jsonb_build_object('added', true);
  end if;
  delete from invites where client_id = p_client and kind = 'client' and email = mail and claimed_at is null;
  insert into invites (email, kind, client_id, member_role, created_by) values (mail, 'client', p_client, r, auth.uid());
  return jsonb_build_object('added', false, 'invited', true);
end $$;

create or replace function public.client_member_set(p_client uuid, p_user uuid, p_role text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me text := my_client_role(p_client); cur member_role;
begin
  if coalesce(me, '') not in ('owner', 'manager') then raise exception 'Not allowed'; end if;
  select role into cur from client_members where client_id = p_client and user_id = p_user;
  if cur is null then raise exception 'Not found'; end if;
  if cur = 'owner' then raise exception 'The owner cannot be changed here'; end if;
  if (cur = 'manager' or p_role = 'manager') and me <> 'owner' then raise exception 'Only the owner can change a manager'; end if;
  if p_role = 'remove' then delete from client_members where client_id = p_client and user_id = p_user;
  elsif p_role in ('manager', 'reception', 'waiter') then update client_members set role = p_role::member_role where client_id = p_client and user_id = p_user;
  else raise exception 'Unknown role'; end if;
end $$;

create or replace function public.client_invite_cancel(p_client uuid, p_invite uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if coalesce(my_client_role(p_client), '') not in ('owner', 'manager') then raise exception 'Not allowed'; end if;
  delete from invites where id = p_invite and client_id = p_client and claimed_at is null;
end $$;

revoke execute on function public.my_client_role(uuid), public.client_access_list(uuid), public.client_staff_invite(uuid, text, text), public.client_member_set(uuid, uuid, text), public.client_invite_cancel(uuid, uuid) from public, anon;
grant execute on function public.my_client_role(uuid), public.client_access_list(uuid), public.client_staff_invite(uuid, text, text), public.client_member_set(uuid, uuid, text), public.client_invite_cancel(uuid, uuid) to authenticated;
