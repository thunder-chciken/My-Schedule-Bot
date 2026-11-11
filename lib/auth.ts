import 'server-only'
import crypto from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getStore, StorageNotConfigured } from './store'
import { isApproved } from './people'

export const COOKIE = 'sb_session'
const MAX_AGE = 60 * 60 * 24 * 180 // stay unlocked for 6 months on a device

function secret() {
  const s =
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VAPID_PRIVATE_KEY ||
    process.env.CRON_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

const sign = (v: string) => crypto.createHmac('sha256', secret()).update(v).digest('base64url')

/**
 * The session cookie is `expiry.email.signature` (email is base64url, empty for the owner passcode).
 * Cookies from before sign-in existed are `expiry.signature` and still count as the owner.
 */
export function makeSession(email = '') {
  const exp = String(Date.now() + MAX_AGE * 1000)
  const who = Buffer.from(email.toLowerCase()).toString('base64url')
  return { value: `${exp}.${who}.${sign(`${exp}.${who}`)}`, maxAge: MAX_AGE }
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
})

/** Set our session cookie on a response (after the passcode, a verified email or Google). */
export function startSession(res: NextResponse, email = '') {
  const s = makeSession(email)
  res.cookies.set(COOKIE, s.value, cookieOptions(s.maxAge))
  return res
}

const sameSig = (good: string, sig: string) => good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))

export type Session = { email: string | null }

/** Who this request belongs to: `{ email }` for a signed-in person, `{ email: null }` for the owner passcode. */
export function readSession(req: NextRequest): Session | null {
  const raw = req.cookies.get(COOKIE)?.value
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length === 2) {
    const [exp, sig] = parts
    return Number(exp) > Date.now() && sameSig(sign(exp), sig) ? { email: null } : null
  }
  const [exp, who, sig] = parts
  if (!exp || who === undefined || !sig || Number(exp) < Date.now() || !sameSig(sign(`${exp}.${who}`), sig)) return null
  return { email: Buffer.from(who, 'base64url').toString() || null }
}

export function isAuthed(req: NextRequest) {
  if (!process.env.APP_PASSCODE && !authConfigured()) return !process.env.VERCEL // nothing set up = open, but only locally
  return readSession(req) !== null
}

/** Email sign-in / Google need Supabase (the same project that stores the data). */
export const authConfigured = () =>
  Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))

export function passcodeMatches(input: string) {
  const want = process.env.APP_PASSCODE ?? ''
  const a = crypto.createHash('sha256').update(input).digest()
  const b = crypto.createHash('sha256').update(want).digest()
  return want.length > 0 && crypto.timingSafeEqual(a, b)
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Wrap a route so it requires a signed-in, still-approved person and reports storage problems nicely. */
export function guarded(fn: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    if (!isAuthed(req)) return json({ error: 'locked' }, 401)
    try {
      // Someone taken off the approved list is locked out on their next request.
      const s = readSession(req)
      if (s?.email && !(await isApproved(getStore(), s.email))) return json({ error: 'locked' }, 401)
      return await fn(req)
    } catch (e) {
      if (e instanceof StorageNotConfigured) return json({ error: 'storage', message: e.message }, 503)
      console.error(e)
      return json({ error: 'server', message: e instanceof Error ? e.message : 'Something went wrong' }, 500)
    }
  }
}

export { getStore }
