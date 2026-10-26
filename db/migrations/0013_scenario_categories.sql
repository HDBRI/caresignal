-- Monthly synthetic dataset import (2026-10-26): categories that come from the synthetic scenario dataset itself
-- are stored with their own source, so they are never shown as AI output or as a caregiver correction.
alter table observation_analyses drop constraint if exists observation_analyses_source_check;
alter table observation_analyses add constraint observation_analyses_source_check check (source in ('ai', 'caregiver', 'scenario'));
