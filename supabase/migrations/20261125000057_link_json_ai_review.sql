-- The owner's Mini link screen needs to know if AI Review by Tap is on for the page.
do $$
declare d text;
begin
  d := pg_get_functiondef('public._link_json(uuid)'::regprocedure);
  if position($q$'published', l.published,$q$ in d) = 0 then raise exception '_link_json layout changed'; end if;
  if position($q$'ai_review'$q$ in d) = 0 then
    d := replace(d, $q$'published', l.published,$q$, $q$'published', l.published, 'ai_review', l.ai_review,$q$);
    execute d;
  end if;
end $$;
