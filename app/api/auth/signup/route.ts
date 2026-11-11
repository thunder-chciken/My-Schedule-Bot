import type { NextRequest } from 'next/server'
import { authConfigured, getStore, json, startSession } from '@/lib/auth'
import { isApproved, looksLikeEmail, normEmail } from '@/lib/people'
import { authMessage, siteUrl, supaAuth } from '@/lib/supaAuth'

/** Create an account. Supabase emails a link; clicking it verifies the email and signs them in. */
export async function POST(req: NextRequest) {
  if (!authConfigured()) return json({ error: 'Email sign-in isn’t set up yet.' }, 503)
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
  const email = normEmail(body.email ?? '')
  const password = body.password ?? ''
  if (!looksLikeEmail(email)) return json({ error: 'That doesn’t look like an email address.' }, 400)
  if (password.length < 8) return json({ error: 'Use a password with at least 8 characters.' }, 400)
  // Private app: don't let strangers make accounts at all.
  if (!(await isApproved(getStore(), email))) return json({ error: 'notapproved', email }, 403)
  const sb = await supaAuth()
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl(req)}/auth/confirm` } })
  if (error) return json({ error: authMessage(error) }, 400)
  // Supabase hides "already registered" by returning a user with no identities.
  if (data.user && !data.user.identities?.length) return json({ error: authMessage({ message: 'already registered' }) }, 409)
  if (data.session) {
    // Email confirmation is switched off in Supabase: they're in straight away.
    await sb.auth.signOut({ scope: 'local' })
    return startSession(json({ ok: true }), email)
  }
  return json({ sent: true })
}
