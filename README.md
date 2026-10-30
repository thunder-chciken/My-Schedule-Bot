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

## Put it online with Vercel (about 15 minutes)

### 1. Upload the app

Pick **one**:

- **Vercel CLI**: in this folder, run `npx vercel` and follow the prompts (it will ask you to log in). Then `npx vercel --prod`.
- **GitHub**: push this folder to a GitHub repo, then on vercel.com click **Add New → Project** and import it.

### 2. Connect the free database

In the Vercel dashboard, open the project → **Storage** → **Create** → **Upstash for Redis** (free plan) → connect it to this project.
This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

### 3. Add the settings (environment variables)

Project → **Settings → Environment Variables**. Copy these from the `.env.local` file in this folder
(Vercel lets you paste the whole file at once):

| Name | What it is |
| --- | --- |
| `APP_PASSCODE` | **Pick a new 6-digit number.** This is the code to open the app. Numbers only. |
| `AUTH_SECRET` | Random secret (already generated in `.env.local`) |
| `CRON_SECRET` | Random secret for the reminder timer |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push alert key (public) |
| `VAPID_PRIVATE_KEY` | Push alert key (private, keep secret) |
| `VAPID_SUBJECT` | `https://storyremodeling.com` (or `mailto:` an email) |

Then **Deployments → ⋯ → Redeploy** so the settings take effect.

> Never change the VAPID keys after phones have turned on alerts, or every device has to turn alerts on again.

### 4. Make alerts arrive on time (important)

Vercel's free plan only lets its built-in timer run **once a day** (that one sends the morning briefing).
For alerts to the minute, use a free pinger:

1. Make a free account at **cron-job.org**.
2. Create a cron job with the URL
   `https://YOUR-APP.vercel.app/api/cron?key=YOUR_CRON_SECRET`
3. Schedule: **every 1 minute**. Save.

_On Vercel Pro you can instead change `vercel.json` to `"schedule": "* * * * *"`._

While the app is open on any device it also checks every minute on its own.

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
Locally, data is saved in `.data/db.json`. Online, it lives in Upstash Redis.

## How it's built

- Next.js 16 (App Router) + React 19, plain CSS
- Upstash Redis for storage
- Web Push (VAPID) + a service worker for lock-screen alerts
- `lib/engine.ts` decides which alerts are due. It is safe to run every minute: every alert is sent once.
