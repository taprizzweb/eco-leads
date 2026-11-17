-- Owners ask for an upgrade from the Plan screen; it lands in the admin Alerts (audit_log).
create or replace function request_upgrade(p_client uuid, p_package text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_member(p_client) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from packages where id = p_package) then raise exception 'Unknown plan'; end if;
  if exists (select 1 from audit_log where client_id = p_client and action = 'upgrade.requested'
             and created_at > now() - interval '1 day') then return; end if;
  insert into audit_log (actor, client_id, action, detail)
  values (auth.uid(), p_client, 'upgrade.requested', jsonb_build_object('package', p_package));
end $$;
revoke execute on function request_upgrade(uuid, text) from public, anon;
grant execute on function request_upgrade(uuid, text) to authenticated;
