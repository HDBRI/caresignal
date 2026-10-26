-- Task 10: the seven categories are now the ones specified in the prompt.
-- Remap any labels already stored (AI suggestions and caregiver corrections). Original notes are untouched.
update observation_analyses set primary_category = case primary_category
      when 'eating_drinking' then 'sleep_nutrition_hydration'
      when 'energy_sleep' then 'sleep_nutrition_hydration'
      when 'mobility_function' then 'mobility_daily_functioning'
      when 'symptoms_comfort' then 'physical_symptoms_comfort'
      when 'mood_cognition' then 'emotional_wellbeing_behavior'
      when 'medications_treatment' then 'treatment_care_coordination'
      when 'care_coordination' then 'treatment_care_coordination'
      else primary_category end;

update observation_analyses a set secondary_categories = coalesce((
  select jsonb_agg(distinct m.v) from (
    select case e.value
      when 'eating_drinking' then 'sleep_nutrition_hydration'
      when 'energy_sleep' then 'sleep_nutrition_hydration'
      when 'mobility_function' then 'mobility_daily_functioning'
      when 'symptoms_comfort' then 'physical_symptoms_comfort'
      when 'mood_cognition' then 'emotional_wellbeing_behavior'
      when 'medications_treatment' then 'treatment_care_coordination'
      when 'care_coordination' then 'treatment_care_coordination'
      else e.value end as v
    from jsonb_array_elements_text(a.secondary_categories) e
  ) m where m.v <> a.primary_category
), '[]'::jsonb);

-- Facts extracted by the AI from one note (each with an exact quote).
alter table observation_analyses add column if not exists facts jsonb not null default '[]'::jsonb;
alter table observation_analyses add column if not exists prompt_version text;

-- Insight runs: period summary, unknowns/missing context, how many AI statements were removed by validation.
alter table insight_runs add column if not exists summary text;
alter table insight_runs add column if not exists unknowns jsonb not null default '[]'::jsonb;
alter table insight_runs add column if not exists questions jsonb not null default '[]'::jsonb;
alter table insight_runs add column if not exists input_source_ids jsonb not null default '[]'::jsonb;
alter table insight_runs add column if not exists rejected_items integer not null default 0;
alter table insight_runs add column if not exists prompt_version text;
alter table insights add column if not exists compares_to_baseline boolean not null default false;
