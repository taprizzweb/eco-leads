-- The Taprizz team chooses which owner dashboard buttons a business sees. Home always shows.
alter table public.clients add column if not exists hidden_sections text[] not null default '{}';
alter table public.clients drop constraint if exists clients_hidden_sections_ok;
alter table public.clients add constraint clients_hidden_sections_ok check (
  hidden_sections <@ array['inbox','reviews','pos','calls','announce','moments','mypage','minilink','staff','offers','jaipur','tables','access','plan']::text[]);

-- Owners can never change it: it joins the plan, status, expiry and link in the guard.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.guard_client_billing_fields()'::regprocedure);
  if position('or new.slug is distinct from old.slug then' in d) = 0 then raise exception 'guard layout changed'; end if;
  if position('hidden_sections' in d) = 0 then
    d := replace(d, 'or new.slug is distinct from old.slug then', E'or new.slug is distinct from old.slug\n      or new.hidden_sections is distinct from old.hidden_sections then');
    execute d;
  end if;
end $$;
