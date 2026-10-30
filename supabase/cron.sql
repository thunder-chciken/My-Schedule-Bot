-- Every-minute reminder timer. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Replace APP_URL below with the app's Vercel address if it changes, then run again.
-- The timer reads its password from schedule_config, so no secret is ever pasted here.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('schedule-bot-reminders')
where exists (select 1 from cron.job where jobname = 'schedule-bot-reminders');

select cron.schedule(
  'schedule-bot-reminders',
  '* * * * *',
  $$
  select net.http_get(
    url := 'APP_URL/api/cron?key=' || (select value #>> '{}' from public.schedule_config where key = 'cron_token'),
    timeout_milliseconds := 25000
  );
  $$
);
