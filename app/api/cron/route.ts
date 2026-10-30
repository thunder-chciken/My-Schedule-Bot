import type { NextRequest } from 'next/server'
import { getStore, json } from '@/lib/auth'
import { runReminders } from '@/lib/engine'

export const maxDuration = 30

// Called by Vercel Cron (sends "Authorization: Bearer CRON_SECRET") or an outside
// pinger such as cron-job.org using /api/cron?key=CRON_SECRET, ideally every minute.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('key')
  if (!secret || given !== secret) return json({ error: 'unauthorized' }, 401)
  return json(await runReminders(getStore()))
}
