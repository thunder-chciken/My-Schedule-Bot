import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

/**
 * Supabase Auth, used only to prove who someone is (Google, or an email they verified). Once it
 * has, we give them our own session cookie and the rest of the app works exactly as before.
 * Runs only on the server; the browser never talks to Supabase directly.
 */
export async function supaAuth() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
  const jar = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
    auth: { flowType: 'pkce' },
  })
}

/** Cookie holding the email that just tried to sign in but isn't approved, shown once on the login screen. */
export const NOTICE = 'sb_notice'

/** This site's own address, for the links in emails and the Google redirect. */
export const siteUrl = (req: NextRequest) => process.env.SITE_URL || req.nextUrl.origin

/** Friendly words for Supabase's error messages. */
export function authMessage(e: { message?: string; code?: string } | null | undefined) {
  const m = (e?.message ?? '').toLowerCase()
  if (m.includes('email not confirmed')) return 'Please verify your email first. Check your inbox for the link we sent.'
  if (m.includes('invalid login')) return 'That email and password don’t match.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'There’s already an account with that email. Try signing in, or tap Forgot password.'
  if (m.includes('password') && m.includes('characters')) return 'Use a password with at least 8 characters.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a few minutes and try again.'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Google sign-in isn’t switched on yet.'
  if (m.includes('fetch failed') || m.includes('network')) return 'Can’t reach the sign-in service right now. Please try again in a minute.'
  if (m.includes('error sending') || m.includes('smtp')) return 'We couldn’t send the email just now. Please try again in a few minutes.'
  return e?.message || 'Something went wrong. Please try again.'
}
