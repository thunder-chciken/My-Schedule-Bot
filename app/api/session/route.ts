import type { NextRequest } from 'next/server'
import { isAuthed, json } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return json({ authed: isAuthed(req), hasPasscode: Boolean(process.env.APP_PASSCODE) })
}
