import { getStore, guarded, json, readSession } from '@/lib/auth'
import { getApproved, looksLikeEmail, normEmail, setApproved } from '@/lib/people'

/** The approved-people list, plus who's asking (so Settings can say "you"). */
export const GET = guarded(async (req) => {
  return json({ people: await getApproved(getStore()), me: readSession(req)?.email ?? null })
})

export const POST = guarded(async (req) => {
  const { email } = (await req.json()) as { email?: string }
  const e = normEmail(email ?? '')
  if (!looksLikeEmail(e)) return json({ error: 'That doesn’t look like an email address.' }, 400)
  const store = getStore()
  return json({ people: await setApproved(store, [...(await getApproved(store)), e]) })
})

export const DELETE = guarded(async (req) => {
  const { email } = (await req.json()) as { email?: string }
  const e = normEmail(email ?? '')
  const me = readSession(req)?.email
  // Signed in by email? Don't let them remove themselves and lock themselves out by accident.
  if (me && e === me) return json({ error: 'You can’t remove yourself. Ask another approved person to do it.' }, 400)
  const store = getStore()
  return json({ people: await setApproved(store, (await getApproved(store)).filter((x) => x !== e)) })
})
