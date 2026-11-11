import type { NextRequest } from 'next/server'
import { authConfigured, isAuthed, json, readSession } from '@/lib/auth'
import { NOTICE } from '@/lib/supaAuth'

/** What the login screen needs: who's signed in, and which ways in are switched on. */
export async function GET(req: NextRequest) {
  const notApproved = req.cookies.get(NOTICE)?.value ?? null
  const res = json({
    authed: isAuthed(req),
    email: readSession(req)?.email ?? null,
    hasPasscode: Boolean(process.env.APP_PASSCODE),
    emailLogin: authConfigured(),
    notApproved,
  })
  if (notApproved) res.cookies.delete(NOTICE)
  return res
}
