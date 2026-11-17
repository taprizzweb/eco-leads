-- The audit log must outlive the things it describes. A foreign key to clients made deleting a client
-- fail (its own "client deleted" entry pointed at a row that was going away). Keep the id, drop the link.
alter table audit_log drop constraint if exists audit_log_client_id_fkey;
