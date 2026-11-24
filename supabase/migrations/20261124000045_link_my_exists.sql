-- Does this business have a mini link its owner or manager may edit? Used to show the Mini link tab only when it applies.
create or replace function public.link_my_exists(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_client_role(p_client), '') in ('owner', 'manager') and exists (select 1 from link_pages where client_id = p_client);
$$;
revoke all on function public.link_my_exists(uuid) from public;
grant execute on function public.link_my_exists(uuid) to authenticated;
