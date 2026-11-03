import { getStore, guarded, json } from '@/lib/auth'

/** Jason tapped "Yes, I saw it" for this device's test alert. */
export const POST = guarded(async (req) => {
  const { endpoint } = (await req.json()) as { endpoint?: string }
  const store = getStore()
  const sub = (await store.listSubs()).find((s) => s.endpoint === endpoint)
  if (!sub) return json({ error: 'This device is not getting alerts yet' }, 404)
  await store.putSub({ ...sub, confirmedAt: new Date().toISOString() })
  return json({ ok: true })
})
