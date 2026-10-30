-- My Schedule Bot tables. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again. Row Level Security is on with no policies, so only the server
-- (using the secret / service_role key) can read or write. The public anon key sees nothing.

create table if not exists schedule_customers (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists schedule_items (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists schedule_push_subs (
  endpoint text primary key,
  data jsonb not null
);

create table if not exists schedule_settings (
  id int primary key default 1,
  data jsonb not null
);

-- Short-lived markers: "this alert was already sent", login attempt counters.
create table if not exists schedule_keys (
  key text primary key,
  value int not null default 1,
  expires_at timestamptz not null
);

alter table schedule_customers enable row level security;
alter table schedule_items enable row level security;
alter table schedule_push_subs enable row level security;
alter table schedule_settings enable row level security;
alter table schedule_keys enable row level security;

-- Settings the app makes for itself (push keys, timer token). Nobody has to paste these.
create table if not exists schedule_config (
  key text primary key,
  value jsonb not null
);
alter table schedule_config enable row level security;

-- Random password the every-minute timer uses to call the app. Generated here, never typed.
insert into schedule_config (key, value)
values ('cron_token', to_jsonb(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
on conflict (key) do nothing;
