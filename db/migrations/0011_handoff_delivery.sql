-- Task 14: backend delivery to the simulated receiver.
-- The exact approved payload text (byte for byte) and its SHA-256, frozen at approval.
alter table handoffs add column if not exists approved_payload_text text;
alter table handoffs add column if not exists approved_payload_sha256 text;
-- Delivery attempts and the last delivery error (shown with the Failed status; safe to retry).
alter table handoffs add column if not exists submit_attempts integer not null default 0;
alter table handoffs add column if not exists last_error text;
-- The receipt keeps the exact text it received, its hash, and its own receipt ID.
alter table receiver_records add column if not exists payload_text text;
alter table receiver_records add column if not exists payload_sha256 text;
alter table receiver_records add column if not exists receipt_code text unique;
