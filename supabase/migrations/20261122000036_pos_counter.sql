-- Ordering from non-table plates (like "Counter") can be switched off by the owner. Table plates always order.
alter table pos_settings add column if not exists counter_orders boolean not null default true;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.guest_menu(uuid)'::regprocedure);
  if d not like '%counter_orders%' then
    d := replace(d, '''accepting'', coalesce(s.accepting, true),', '''accepting'', coalesce(s.accepting, true), ''counter_orders'', coalesce(s.counter_orders, true),');
    execute d;
  end if;
  d := pg_get_functiondef('public.guest_place_order(uuid,text,text,text,jsonb,text,double precision,double precision)'::regprocedure);
  if d not like '%Please order from your table%' then
    d := replace(d, 'raise exception ''Please scan the QR on your table to order''; end if;', 'raise exception ''Please scan the QR on your table to order''; end if;
  if not s.counter_orders and coalesce(pl.label, '''') !~* ''(table|room|booth|seat|cabin|[0-9])'' then raise exception ''Please order from your table''; end if;');
    execute d;
  end if;
end $$;
