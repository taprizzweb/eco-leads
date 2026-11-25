-- The AI review button can have its own name and sit above or below the other buttons.
alter table public.link_pages add column if not exists ai_review_label text;
alter table public.link_pages add column if not exists ai_review_pos text not null default 'top' check (ai_review_pos in ('top', 'bottom'));

do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if position($q$'review_code'$q$ in d) = 0 then raise exception 'public_link_page layout changed'; end if;
  if position($q$'review_label'$q$ in d) = 0 then
    d := replace(d, $q$'review_code',$q$, $q$'review_label', nullif(left(trim(coalesce(l.ai_review_label, '')), 30), ''), 'review_pos', l.ai_review_pos, 'review_code',$q$);
    execute d;
  end if;
end $$;
