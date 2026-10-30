# My Schedule Bot

A simple, Apple-style schedule and customer tracker for **Story Remodeling**.
It runs on iPhone, iPad, Android and computers, and buzzes your phone so you never forget a callback, an email or an appointment.

## What it does

- **Today screen**: what's overdue (red), due soon (orange) and coming up (green), each with a live countdown.
- **Big quick buttons**: Call Back Reminder, New Appointment, New Customer.
- **Customers**: every name, number, email and address in one place. Tap to call, text, email or get directions.
- **After every call/text/email** the app asks "Follow up again?" so nothing slips.
- **"Waiting to hear from you"**: leads and estimates you haven't talked to in a few days.
- **Push alerts** on the lock screen before appointments, when callbacks are due, and repeat nags for overdue ones.
- **Morning briefing** at 7 AM: "Today: 2 appointments · 3 callbacks · 1 overdue".
- **Calendar** month view with colored dots.
- **Red badge** on the app icon with the number of overdue items.
- **Save to phone contacts**, Excel export and full backups.
- **Passcode lock** so customer info stays private.
- Syncs between phone, tablet and computer.

## The colors

| Color | Means | Default |
| --- | --- | --- |
| 🟢 Green | Plenty of time | more than 24 hours away |
| 🟠 Orange | Coming up soon | within 24 hours |
| 🔴 Red (pulsing when late) | Do it now | within 1 hour, or overdue |

All of these can be changed in **Settings → Countdown colors**.

---

## Put it online (GitHub → Vercel + Supabase, all free plans)

The code lives at github.com/thunder-chciken/My-Schedule-Bot. Vercel redeploys every push to `main`.

### 1. Supabase project (the database)

1. In Supabase, create a project (Free plan, region **East US**).
2. **SQL Editor → New query**: paste [supabase/schema.sql](supabase/schema.sql) → **Run**. This makes the tables.
3. **SQL Editor → New query**: paste [supabase/cron.sql](supabase/cron.sql), change `APP_URL` to the app address
   (e.g. `https://my-schedule-bot.vercel.app`) → **Run**. This is the every-minute alert timer.

The timer runs inside Supabase and uses a password Supabase makes for itself, so there is no outside
cron service and nothing secret to copy.

### 2. Vercel settings (environment variables)

Project → **Settings → Environment Variables**:

| Name | Where it comes from |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → Data API (looks like `https://xxxx.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **Secret key** (or the legacy `service_role` key). Keep it private. |
| `APP_PASSCODE` | **Pick a 6-digit number.** The code to open the app. Numbers only. |

Then **Deployments → ⋯ → Redeploy**.

Push alert keys are created automatically the first time the app runs and are saved in Supabase.
Never delete the `vapid` row in `schedule_config`, or every device has to turn alerts on again.

While the app is open on any device it also checks for due alerts every minute on its own.

---

## Install it on each device

**iPhone / iPad** (iOS 16.4 or newer):
1. Open the app's web address in **Safari**.
2. Tap **Share ⬆︎ → Add to Home Screen**.
3. Open **Schedule Bot** from the Home Screen, enter the passcode, and tap **Turn On Alerts**.

Apple only allows alerts for apps added to the Home Screen, so step 2 is required.

**Android**: open in Chrome → menu → **Install app** → open it → **Turn On Alerts**.

**Computer**: open in Chrome or Edge → click the install icon in the address bar → **Turn On Alerts** and allow notifications.

Use **Settings → Send Test Alert** to check that every device buzzes.

---

## Run it on this computer (for changes)

```bash
npm install
npm run dev
```

Open http://localhost:3000. The local passcode is in `.env.local`.
Locally, data is saved in `.data/db.json`. Online, it lives in Supabase.

## How it's built

- Next.js 16 (App Router) + React 19, plain CSS
- Supabase (Postgres) for storage, with pg_cron as the every-minute alert timer (Upstash Redis also works)
- Web Push (VAPID) + a service worker for lock-screen alerts
- `lib/engine.ts` decides which alerts are due. It is safe to run every minute: every alert is sent once.
