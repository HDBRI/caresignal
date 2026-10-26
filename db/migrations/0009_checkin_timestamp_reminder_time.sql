-- Task 11: when the caregiver last answered (updated on every change), and the in-app reminder time.
alter table checkins add column if not exists responded_at timestamptz not null default now();
update checkins set responded_at = created_at;

-- Optional in-app reminder: one daily time (HH:MM, 24h) in the caregiver's own time zone. Off by default.
alter table cases add column if not exists reminder_time text;
alter table cases add column if not exists reminder_tz text;
alter table cases drop constraint if exists cases_reminder_time_check;
alter table cases add constraint cases_reminder_time_check
  check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table cases drop constraint if exists cases_reminder_tz_check;
alter table cases add constraint cases_reminder_tz_check
  check (reminder_tz is null or (char_length(reminder_tz) between 1 and 64 and reminder_tz ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'));
alter table cases drop constraint if exists cases_reminder_consistent;
alter table cases add constraint cases_reminder_consistent
  check (reminder_pref = 'off' or reminder_time is not null);
