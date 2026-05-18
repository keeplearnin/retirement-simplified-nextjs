-- Plan snapshots: one row per user per calendar day (max 90)
-- user_id = Cognito sub claim. Auth handled server-side via Cognito JWT.
-- RLS is disabled — rows are filtered by user_id in API routes.

create table if not exists plan_snapshots (
  id           uuid        default gen_random_uuid() primary key,
  user_id      text        not null,
  saved_at     date        not null,
  data         jsonb       not null,
  created_at   timestamptz default now(),

  constraint plan_snapshots_user_day unique (user_id, saved_at)
);

create index if not exists idx_plan_snapshots_user
  on plan_snapshots (user_id, saved_at desc);

-- Current plan: one row per user, full plan JSON
create table if not exists user_plans (
  user_id      text        primary key,
  plan         jsonb       not null,
  updated_at   timestamptz default now()
);
