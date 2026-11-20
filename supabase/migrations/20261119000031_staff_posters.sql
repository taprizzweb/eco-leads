-- Staff (thank or report), "New" posters carousel. Wi-Fi and the Instagram card need no tables: they use clients.socials.
-- Safe to run again. Thank-you notes lose their text after 45 days; the permanent count stays.

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  photo_url text,
  active boolean not null default true,
  sort int not null default 0,
  thanks_total int not null default 0,   -- permanent count; the notes below are kept 45 days
  created_at timestamptz not null default now()
);
create index if not exists staff_client_idx on staff (client_id, sort);
alter table staff enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff' and policyname='staff_member_all') then create policy staff_member_all on staff for all to authenticated using (is_member(client_id)) with check (is_member(client_id)); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff' and policyname='staff_team_all') then create policy staff_team_all on staff for all to authenticated using (is_team('manager')) with check (is_team('manager')); end if; end $$;

create table if not exists staff_thanks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  client_id uuid not null references clients on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists staff_thanks_client_idx on staff_thanks (client_id, created_at desc);
alter table staff_thanks enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff_thanks' and policyname='staff_thanks_read') then create policy staff_thanks_read on staff_thanks for select to authenticated using (is_member(client_id)); end if; end $$;

create table if not exists posters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  image_url text not null,
  caption text check (caption is null or char_length(caption) <= 80),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posters_client_idx on posters (client_id, sort);
alter table posters enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='posters' and policyname='posters_member_all') then create policy posters_member_all on posters for all to authenticated using (is_member(client_id)) with check (is_member(client_id)); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='posters' and policyname='posters_team_all') then create policy posters_team_all on posters for all to authenticated using (is_team('manager')) with check (is_team('manager')); end if; end $$;

-- What the guest page needs, in one call.
create or replace function public.guest_extras(p_client uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'photo_url', s.photo_url) order by s.sort, s.name)
                       from staff s where s.client_id = p_client and s.active), '[]'::jsonb),
    'posters', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'image_url', p.image_url, 'caption', p.caption) order by p.sort, p.created_at)
                         from posters p where p.client_id = p_client and p.active), '[]'::jsonb));
$$;
revoke execute on function public.guest_extras(uuid) from public, anon, authenticated;
grant execute on function public.guest_extras(uuid) to anon, authenticated;

-- A guest thanks a staff member. No name or number is stored; only the staff member, an optional short note and the time.
create or replace function public.guest_thank_staff(p_client uuid, p_staff uuid, p_note text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting messages'; end if;
  if not exists (select 1 from staff where id = p_staff and client_id = p_client and active) then raise exception 'Not available'; end if;
  if not guest_rate_ok(p_client, 'staff_thanks', 40, interval '1 hour') then raise exception 'Too many messages, try again shortly'; end if;
  insert into staff_thanks (staff_id, client_id, note) values (p_staff, p_client, nullif(left(btrim(coalesce(p_note, '')), 200), ''));
  update staff set thanks_total = thanks_total + 1 where id = p_staff;
  update staff_thanks set note = null where client_id = p_client and note is not null and created_at < now() - interval '45 days';
end $$;
revoke execute on function public.guest_thank_staff(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.guest_thank_staff(uuid, uuid, text) to anon, authenticated;
