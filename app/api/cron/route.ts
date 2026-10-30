import type { NextRequest } from 'next/server'
import { getStore, json } from '@/lib/auth'
import { runReminders } from '@/lib/engine'

export const maxDuration = 30

// Called every minute by Supabase pg_cron (supabase/cron.sql) with ?key=<cron_token from the database>.
// CRON_SECRET (env) also works, sent as "Authorization: Bearer ..." or ?key=.
export async function GET(req: NextRequest) {
  const given = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('key')
  if (!given) return json({ error: 'unauthorized' }, 401)
  const store = getStore()
  const token = process.env.CRON_SECRET === given ? given : await store.getConfig<string>('cron_token')
  if (!token || token !== given) return json({ error: 'unauthorized' }, 401)
  return json(await runReminders(store))
}
