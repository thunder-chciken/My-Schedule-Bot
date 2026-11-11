import type { NextRequest } from 'next/server'
import { COOKIE, json } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const res = json({ ok: true })
  res.cookies.delete(COOKIE)
  // Also drop any half-finished Supabase sign-in (e.g. an unused password-reset link).
  for (const c of req.cookies.getAll()) if (c.name.startsWith('sb-')) res.cookies.delete(c.name)
  return res
}
