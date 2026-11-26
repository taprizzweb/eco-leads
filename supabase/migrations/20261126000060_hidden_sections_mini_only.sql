-- "Mini link only" is saved as 'mini_only' in clients.hidden_sections, but the check from 051 did not allow it, so the admin switch never saved.
alter table public.clients drop constraint if exists clients_hidden_sections_ok;
alter table public.clients add constraint clients_hidden_sections_ok check (
  hidden_sections <@ array['inbox','reviews','pos','calls','announce','moments','mypage','minilink','staff','offers','jaipur','tables','access','plan','mini_only']::text[]);
