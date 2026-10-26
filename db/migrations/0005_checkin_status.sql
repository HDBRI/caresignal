-- Daily check-in = one quick overall status per day (Task 8), plus an optional short note.
-- "No response recorded" is never stored: it is the absence of a row for that day.
alter table checkins add column if not exists status text;
alter table checkins add column if not exists note text;
update checkins set status = 'noticed_change' where status is null;
alter table checkins alter column status set not null;
alter table checkins drop constraint if exists checkins_status_check;
alter table checkins add constraint checkins_status_check
  check (status in ('no_change', 'noticed_change', 'concern', 'skipped'));
alter table checkins drop constraint if exists checkins_note_length;
alter table checkins add constraint checkins_note_length check (note is null or char_length(note) between 1 and 500);
alter table checkins alter column responses set default '{}'::jsonb;
