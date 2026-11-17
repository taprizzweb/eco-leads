-- Cost control for AI drafts: a business can have at most p_max drafts an hour (checked before the AI is called).
create or replace function review_budget_ok(p_client uuid, p_max int default 120)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from review_drafts where client_id = p_client and created_at > now() - interval '1 hour') < p_max;
$$;
revoke execute on function review_budget_ok(uuid, int) from public;
grant execute on function review_budget_ok(uuid, int) to anon, authenticated;
