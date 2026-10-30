import type { NextRequest } from 'next/server'
import { COOKIE, getStore, json, makeSession, passcodeMatches } from '@/lib/auth'
import { StorageNotConfigured } from '@/lib/store'

const LOCKOUT = 15 * 60

export async function POST(req: NextRequest) {
  if (!process.env.APP_PASSCODE) return json({ error: 'Set APP_PASSCODE in Vercel first.' }, 500)
  let store
  try {
    store = getStore()
  } catch (e) {
    if (e instanceof StorageNotConfigured) return json({ error: e.message }, 503)
    throw e
  }
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string }
  const fails = await store.incr(`fail:${ip}`, LOCKOUT)
  if (fails > 8) return json({ error: 'Too many tries. Wait 15 minutes.' }, 429)
  if (!passcode || !passcodeMatches(String(passcode))) return json({ error: 'Wrong passcode' }, 401)
  await store.del(`fail:${ip}`)
  const s = makeSession()
  const res = json({ ok: true })
  res.cookies.set(COOKIE, s.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: s.maxAge,
  })
  return res
}
