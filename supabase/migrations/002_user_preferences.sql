-- User preferences: email opt-in + scheduling state
create table if not exists user_preferences (
  user_id              text        primary key,
  email                text,
  weekly_check_enabled boolean     default false,
  last_emailed_at      timestamptz,
  updated_at           timestamptz default now()
);
