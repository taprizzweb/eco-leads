-- A mini link can show the Taprizz partners list (it is read from the Taprizz website, so the list stays the same in both places).
alter table public.link_pages add column if not exists show_partners boolean not null default false;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if position($q$'review_pos', l.ai_review_pos,$q$ in d) = 0 then raise exception 'public_link_page layout changed'; end if;
  if position($q$'show_partners'$q$ in d) = 0 then
    d := replace(d, $q$'review_pos', l.ai_review_pos,$q$, $q$'review_pos', l.ai_review_pos, 'show_partners', l.show_partners,$q$);
    execute d;
  end if;
end $$;
