-- The Taprizz team can switch an AI Google review button on for a mini link that is tied to a registered business.
-- The page then shows "AI Review by Tap". It uses that business's review setup, Google link and feedback inbox.
alter table public.link_pages add column if not exists ai_review boolean not null default false;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if position($q$'premium', (l.paid_at is not null),$q$ in d) = 0 then raise exception 'public_link_page layout changed'; end if;
  if position($q$'review_code'$q$ in d) = 0 then
    d := replace(d, $q$'premium', (l.paid_at is not null),$q$, $q$'premium', (l.paid_at is not null), 'review_code', (select c.slug from clients c where c.id = l.client_id and l.ai_review and coalesce(c.google_review_url, '') <> '' and c.status = 'active'),$q$);
    execute d;
  end if;
end $$;
