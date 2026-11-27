-- When AI review is off on a mini link page, the same review button can open a plain link chosen by the team.
alter table public.link_pages add column if not exists ai_review_url text check (ai_review_url is null or (ai_review_url ~* '^https://' and length(ai_review_url) <= 500));

do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if position($q$'review_pos', l.ai_review_pos,$q$ in d) = 0 then raise exception 'public_link_page layout changed'; end if;
  if position($q$'review_link'$q$ in d) = 0 then
    d := replace(d, $q$'review_pos', l.ai_review_pos,$q$, $q$'review_pos', l.ai_review_pos, 'review_link', nullif(trim(coalesce(l.ai_review_url, '')), ''),$q$);
    execute d;
  end if;
end $$;
