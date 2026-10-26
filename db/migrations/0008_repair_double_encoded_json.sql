-- Repair: before this fix, the hosted driver stored JSON arrays/objects as JSON *strings*
-- (e.g. "[\"OBS-C3-06\"]" instead of ["OBS-C3-06"]). Convert any such values back. Safe to re-run:
-- only string values that themselves contain a JSON array/object are touched.
do $$
declare r record;
begin
  for r in
    select table_name, column_name from information_schema.columns
     where table_schema = 'public' and data_type = 'jsonb'
  loop
    execute format(
      $f$update %I set %I = (%I #>> '{}')::jsonb
          where jsonb_typeof(%I) = 'string' and (%I #>> '{}') ~ '^\s*[\[{]'$f$,
      r.table_name, r.column_name, r.column_name, r.column_name, r.column_name);
  end loop;
end $$;
