-- Every-minute reminder timer. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- If the app's Vercel address ever changes, update the URL below and run this again.
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
    url := 'https://my-schedule-bot.vercel.app/api/cron?key=' || (select value #>> '{}' from public.schedule_config where key = 'cron_token'),
    timeout_milliseconds := 25000
  );
  $$
);
