-- "Call server": a guest taps a bell on a table plate, the owner sees the table on the Calls screen. No guest details are stored.
-- Switched on per client with the feature "call_server" (admin, Plan features).

create table if not exists server_calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  plate_code text,
  label text,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists server_calls_client_idx on server_calls (client_id, created_at desc);
alter table server_calls enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='server_calls' and policyname='server_calls_member_read') then create policy server_calls_member_read on server_calls for select to authenticated using (is_member(client_id)); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='server_calls' and policyname='server_calls_member_update') then create policy server_calls_member_update on server_calls for update to authenticated using (is_member(client_id)) with check (is_member(client_id)); end if; end $$;

create or replace function public.guest_call_server(p_client uuid, p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c clients; pl plates;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting requests'; end if;
  if not coalesce((client_features(p_client)->>'call_server')::boolean, false) then raise exception 'Not available'; end if;
  select * into pl from plates where code = p_code and client_id = p_client and active;
  if pl.code is null then raise exception 'Not available'; end if;
  -- one open call per table; a second tap just reassures the guest
  if exists (select 1 from server_calls where client_id = p_client and plate_code = pl.code and status = 'new' and created_at > now() - interval '15 minutes') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if not guest_rate_ok(p_client, 'server_calls', 80, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into server_calls (client_id, plate_code, label) values (p_client, pl.code, pl.label);
  return jsonb_build_object('ok', true, 'already', false);
end $$;
revoke execute on function public.guest_call_server(uuid, text) from public, anon, authenticated;
grant execute on function public.guest_call_server(uuid, text) to anon, authenticated;
