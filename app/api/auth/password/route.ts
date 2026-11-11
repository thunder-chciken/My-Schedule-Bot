import type { NextRequest } from 'next/server'
import { authConfigured, getStore, json, startSession } from '@/lib/auth'
import { isApproved } from '@/lib/people'
import { authMessage, supaAuth } from '@/lib/supaAuth'

/** Save a new password. Only works right after opening a "reset password" email link. */
export async function POST(req: NextRequest) {
  if (!authConfigured()) return json({ error: 'Email sign-in isn’t set up yet.' }, 503)
  const { password } = (await req.json().catch(() => ({}))) as { password?: string }
  if (!password || password.length < 8) return json({ error: 'Use a password with at least 8 characters.' }, 400)
  const sb = await supaAuth()
  const { data: who } = await sb.auth.getUser()
  if (!who.user?.email) return json({ error: 'That reset link has expired. Tap Forgot password to get a new one.' }, 401)
  const { error } = await sb.auth.updateUser({ password })
  if (error) return json({ error: authMessage(error) }, 400)
  const email = who.user.email
  await sb.auth.signOut({ scope: 'local' })
  if (!(await isApproved(getStore(), email))) return json({ error: 'notapproved', email }, 403)
  return startSession(json({ ok: true }), email)
}
