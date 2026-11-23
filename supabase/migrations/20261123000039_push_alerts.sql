-- Push alerts: a staff phone or Chrome gets a notification for a new order, a table request or a chat message, even when the app is closed.
-- A person turns it on (or off) per device. The database tells our server, our server sends the push.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  endpoint text not null unique,
  p256dh text not null, auth text not null,
  label text, created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_client_idx on push_subscriptions (client_id);
alter table push_subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='push_subscriptions' and policyname='push_own_read') then
    create policy push_own_read on push_subscriptions for select to authenticated using (user_id = auth.uid()); end if;
end $$;

create or replace function public.push_subscribe(p_client uuid, p_endpoint text, p_p256dh text, p_auth text, p_label text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or my_client_role(p_client) is null then raise exception 'Not allowed'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'Bad address'; end if;
  insert into push_subscriptions (user_id, client_id, endpoint, p256dh, auth, label) values (auth.uid(), p_client, p_endpoint, p_p256dh, p_auth, left(p_label, 60))
  on conflict (endpoint) do update set user_id = auth.uid(), client_id = p_client, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label;
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql volatile security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Only our server (with the server key) can read who to notify.
create or replace function public.push_targets(p_client uuid, p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'role', coalesce((select m.role::text from client_members m where m.client_id = s.client_id and m.user_id = s.user_id), 'owner')))
    from push_subscriptions s where s.client_id = p_client), '[]'::jsonb);
end $$;

create or replace function public.push_drop(p_endpoint text, p_key text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end $$;

create or replace function public.push_fire(p_client uuid, p_kind text, p_title text, p_body text, p_url text) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k text;
begin
  if not exists (select 1 from push_subscriptions where client_id = p_client) then return; end if;
  select value #>> '{}' into k from app_settings where key = 'review_server_key';
  if k is null then return; end if;
  perform net.http_post(url := 'https://app.taprizz.in/api/push/notify',
    body := jsonb_build_object('client_id', p_client, 'kind', p_kind, 'title', p_title, 'body', p_body, 'url', p_url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-key', k), timeout_milliseconds := 5000);
exception when others then null;   -- a failed notification must never stop an order
end $$;

create or replace function public.push_on_order() returns trigger language plpgsql security definer set search_path = public as $$
declare slug text;
begin
  if new.status <> 'new' then return new; end if;
  select c.slug into slug from clients c where c.id = new.client_id;
  perform push_fire(new.client_id, 'order', 'New order #' || new.order_no || ' · ' || coalesce(new.table_label, 'table'),
    coalesce((select string_agg((l->>'qty') || ' × ' || (l->>'name'), ', ') from jsonb_array_elements(new.items) l), ''), '/pos/' || slug);
  return new;
end $$;
create or replace function public.push_on_request() returns trigger language plpgsql security definer set search_path = public as $$
declare slug text;
begin
  select c.slug into slug from clients c where c.id = new.client_id;
  perform push_fire(new.client_id, 'request', coalesce(new.label, 'A table') || ' · ' || case new.kind when 'bill' then 'wants the bill' when 'clean' then 'clean the table' when 'other' then 'needs help' else 'call waiter' end,
    coalesce(new.note, 'Please go to the table.'), '/pos/' || slug);
  return new;
end $$;
create or replace function public.push_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
declare slug text; tl text;
begin
  if new.sender <> 'customer' then return new; end if;
  select c.slug into slug from clients c where c.id = new.client_id;
  select t.table_label into tl from chat_threads t where t.id = new.thread_id;
  perform push_fire(new.client_id, 'chat', 'Chat · ' || coalesce(tl, 'guest'), left(new.body, 140), '/pos/' || slug || '/chat');
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_push') then create trigger orders_push after insert on orders for each row execute function push_on_order(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'server_calls_push') then create trigger server_calls_push after insert on server_calls for each row execute function push_on_request(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'chat_messages_push') then create trigger chat_messages_push after insert on chat_messages for each row execute function push_on_chat(); end if;
end $$;

revoke execute on function public.push_subscribe(uuid, text, text, text, text), public.push_unsubscribe(text), public.push_targets(uuid, text), public.push_drop(text, text), public.push_fire(uuid, text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(uuid, text, text, text, text), public.push_unsubscribe(text) to authenticated;
grant execute on function public.push_targets(uuid, text), public.push_drop(text, text) to anon, authenticated;
