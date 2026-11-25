-- Contact form on a mini link: a visitor sends name, email, phone and a message, and agrees to be contacted.
-- Only this form stores anything about a visitor, and only because they typed it and ticked the box.
create table if not exists public.link_contacts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.link_pages(id) on delete cascade,
  name text not null, email text not null, phone text not null, message text not null,
  consent boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.link_contacts enable row level security;
create index if not exists link_contacts_link_idx on public.link_contacts (link_id, created_at desc);

-- A page button may now open the contact form.
create or replace function public._link_url_ok(u text, allow_hash boolean default false) returns boolean
language sql immutable as $$
  select u is null or u = '' or (allow_hash and u in ('#offers', '#outlets', '#contact')) or u ~* '^(https?://|tel:|mailto:)[^\s]+$';
$$;

create or replace function public.link_contact_submit(p_id uuid, p_name text, p_email text, p_phone text, p_message text, p_consent boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not exists (select 1 from link_pages where id = p_id and published) then raise exception 'not found'; end if;
  if not coalesce(p_consent, false) then raise exception 'consent needed'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 80 then raise exception 'bad name'; end if;
  if coalesce(p_email, '') !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(p_email) > 120 then raise exception 'bad email'; end if;
  ph := regexp_replace(ph, '^(91|0)(?=[6-9][0-9]{9}$)', '');
  if ph !~ '^[6-9][0-9]{9}$' then raise exception 'bad phone'; end if;
  if length(trim(coalesce(p_message, ''))) < 3 or length(p_message) > 1000 then raise exception 'bad message'; end if;
  if (select count(*) from link_contacts where link_id = p_id and created_at > now() - interval '1 hour') >= 20 then raise exception 'busy'; end if;
  if exists (select 1 from link_contacts where link_id = p_id and phone = ph and message = left(trim(p_message), 1000) and created_at > now() - interval '1 day') then return; end if;
  delete from link_contacts where link_id = p_id and created_at < now() - interval '180 days';
  insert into link_contacts (link_id, name, email, phone, message) values (p_id, left(trim(p_name), 80), lower(trim(p_email)), ph, left(trim(p_message), 1000));
end $$;
revoke all on function public.link_contact_submit(uuid, text, text, text, text, boolean) from public;
grant execute on function public.link_contact_submit(uuid, text, text, text, text, boolean) to anon, authenticated;

-- The business owner or manager, and the Taprizz team, read the messages of one page.
create or replace function public.link_contacts_list(p_id uuid, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_team('manager') or _link_member_ok(p_id)) then return null; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select id, name, email, phone, message, created_at from link_contacts where link_id = p_id order by created_at desc limit least(greatest(p_limit, 1), 500)) c), '[]'::jsonb);
end $$;
revoke all on function public.link_contacts_list(uuid, int) from public;
grant execute on function public.link_contacts_list(uuid, int) to authenticated;
