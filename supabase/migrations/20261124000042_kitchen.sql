-- The owner can give the kitchen role, and choose whether accepting an order also prints the kitchen slip (off by default).
alter table pos_settings add column if not exists auto_kot boolean not null default false;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.client_staff_invite(uuid,text,text)'::regprocedure);
  if d not like '%''kitchen''%' then
    d := replace(d, 'p_role not in (''manager'', ''reception'', ''waiter'')', 'p_role not in (''manager'', ''reception'', ''waiter'', ''kitchen'')');
    d := replace(d, 'Choose manager, reception or waiter', 'Choose manager, reception, waiter or kitchen');
    execute d;
  end if;
  d := pg_get_functiondef('public.client_member_set(uuid,uuid,text)'::regprocedure);
  if d not like '%''kitchen''%' then
    d := replace(d, 'p_role in (''manager'', ''reception'', ''waiter'')', 'p_role in (''manager'', ''reception'', ''waiter'', ''kitchen'')');
    execute d;
  end if;
end $$;
