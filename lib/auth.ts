import 'server-only'
import crypto from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getStore, StorageNotConfigured } from './store'

export const COOKIE = 'sb_session'
const MAX_AGE = 60 * 60 * 24 * 180 // stay unlocked for 6 months on a device

function secret() {
  const s = process.env.AUTH_SECRET || process.env.VAPID_PRIVATE_KEY || process.env.CRON_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

const sign = (v: string) => crypto.createHmac('sha256', secret()).update(v).digest('base64url')

export function makeSession() {
  const exp = String(Date.now() + MAX_AGE * 1000)
  return { value: `${exp}.${sign(exp)}`, maxAge: MAX_AGE }
}

export function isAuthed(req: NextRequest) {
  if (!process.env.APP_PASSCODE) return !process.env.VERCEL // no passcode = open, but only locally
  const raw = req.cookies.get(COOKIE)?.value
  if (!raw) return false
  const [exp, sig] = raw.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const good = sign(exp)
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))
}

export function passcodeMatches(input: string) {
  const want = process.env.APP_PASSCODE ?? ''
  const a = crypto.createHash('sha256').update(input).digest()
  const b = crypto.createHash('sha256').update(want).digest()
  return want.length > 0 && crypto.timingSafeEqual(a, b)
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Wrap a route so it requires the passcode cookie and reports storage problems nicely. */
export function guarded(fn: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    if (!isAuthed(req)) return json({ error: 'locked' }, 401)
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof StorageNotConfigured) return json({ error: 'storage', message: e.message }, 503)
      console.error(e)
      return json({ error: 'server', message: e instanceof Error ? e.message : 'Something went wrong' }, 500)
    }
  }
}

export { getStore }
