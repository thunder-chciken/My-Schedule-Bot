import type { NextRequest } from 'next/server'
import { authConfigured, json } from '@/lib/auth'
import { looksLikeEmail, normEmail } from '@/lib/people'
import { authMessage, siteUrl, supaAuth } from '@/lib/supaAuth'

/** Email a "set a new password" link. Always answers the same way so it can't be used to test addresses. */
export async function POST(req: NextRequest) {
  if (!authConfigured()) return json({ error: 'Email sign-in isn’t set up yet.' }, 503)
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || !looksLikeEmail(normEmail(email))) return json({ error: 'Enter the email you signed up with.' }, 400)
  const sb = await supaAuth()
  const { error } = await sb.auth.resetPasswordForEmail(normEmail(email), { redirectTo: `${siteUrl(req)}/auth/confirm?next=reset` })
  if (error && /rate limit|too many/i.test(error.message)) return json({ error: authMessage(error) }, 429)
  return json({ sent: true })
}
