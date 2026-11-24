-- Any background, accent and button colour for the guest app (hex only, checked in the database).
create or replace function public._colors_ok(c jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(c) = 'object'
    and not exists (select 1 from jsonb_each(c) e where e.key not in ('bg', 'accent', 'button') or jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') !~* '^#[0-9a-f]{6}$');
$$;

alter table public.clients add column if not exists colors jsonb not null default '{}'::jsonb;
alter table public.clients drop constraint if exists clients_colors_ok;
alter table public.clients add constraint clients_colors_ok check (public._colors_ok(colors));

-- guest_page() now also returns the colours. The existing definition is patched in place so nothing else in it changes.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.guest_page(text)'::regprocedure);
  if position($q$'logo_url', c.logo_url, 'theme', c.theme,$q$ in d) = 0 then raise exception 'guest_page layout changed'; end if;
  d := replace(d, $q$'logo_url', c.logo_url, 'theme', c.theme,$q$, $q$'logo_url', c.logo_url, 'theme', c.theme, 'colors', coalesce(c.colors, '{}'::jsonb),$q$);
  execute d;
end $$;
