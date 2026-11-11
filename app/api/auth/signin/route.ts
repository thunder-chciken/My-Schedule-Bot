import type { NextRequest } from 'next/server'
import { authConfigured, getStore, json, startSession } from '@/lib/auth'
import { isApproved, normEmail } from '@/lib/people'
import { authMessage, supaAuth } from '@/lib/supaAuth'

/** Sign in with email + password. Only verified, approved emails get in. */
export async function POST(req: NextRequest) {
  if (!authConfigured()) return json({ error: 'Email sign-in isn’t set up yet.' }, 503)
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
  if (!email || !password) return json({ error: 'Enter your email and password.' }, 400)
  const sb = await supaAuth()
  const { data, error } = await sb.auth.signInWithPassword({ email: normEmail(email), password })
  if (error || !data.user?.email) return json({ error: authMessage(error) }, 401)
  await sb.auth.signOut({ scope: 'local' }) // we only needed Supabase to check the password
  if (!(await isApproved(getStore(), data.user.email))) return json({ error: 'notapproved', email: data.user.email }, 403)
  return startSession(json({ ok: true }), data.user.email)
}
