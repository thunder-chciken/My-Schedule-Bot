import { COOKIE, json } from '@/lib/auth'

export async function POST() {
  const res = json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}
