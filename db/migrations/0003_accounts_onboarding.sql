-- Accounts: unique username (case-insensitive). Onboarding: optional case details.
-- Blank optional fields stay NULL and are shown as "Not provided" — never as normal.

alter table profiles add column if not exists username text;
create unique index if not exists profiles_username_lower on profiles (lower(username));
alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$');

alter table cases add column if not exists age_range text;
alter table cases add column if not exists primary_condition text;
alter table cases add column if not exists care_phase text;
alter table cases add column if not exists care_setting text;
alter table cases add column if not exists milestones text;

alter table cases drop constraint if exists cases_age_range_check;
alter table cases add constraint cases_age_range_check
  check (age_range is null or age_range in ('under_18', '18_39', '40_64', '65_79', '80_plus'));
alter table cases drop constraint if exists cases_care_phase_check;
alter table cases add constraint cases_care_phase_check
  check (care_phase is null or care_phase in ('active_treatment', 'recovering', 'ongoing_condition', 'comfort_focused', 'not_sure'));
alter table cases drop constraint if exists cases_care_setting_check;
alter table cases add constraint cases_care_setting_check
  check (care_setting is null or care_setting in ('home', 'home_with_visiting_care', 'assisted_living', 'other', 'not_sure'));
alter table cases drop constraint if exists cases_text_lengths;
alter table cases add constraint cases_text_lengths
  check (coalesce(char_length(primary_condition), 0) <= 80 and coalesce(char_length(milestones), 0) <= 1000
         and coalesce(char_length(care_context), 0) <= 1000);

-- Baseline domains (caregiver-reported). Missing domain = not provided.
alter table baselines drop constraint if exists baselines_category_check;
alter table baselines add constraint baselines_category_check
  check (category in ('mobility_function', 'eating_drinking', 'energy_sleep', 'mood_communication', 'memory_attention', 'other'));
alter table baselines drop constraint if exists baselines_description_length;
alter table baselines add constraint baselines_description_length check (char_length(description) between 1 and 500);
