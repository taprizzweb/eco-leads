-- Deleting an account must not be blocked by its audit history; the entry stays, the actor link clears.
alter table audit_log drop constraint audit_log_actor_fkey;
alter table audit_log add constraint audit_log_actor_fkey foreign key (actor) references auth.users on delete set null;
