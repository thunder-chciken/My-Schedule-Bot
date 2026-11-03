import { getStore, guarded, json } from '@/lib/auth'
import type { PushSub } from '@/lib/types'

/** Every device getting alerts, with when we last sent it one and when it last said one arrived. */
export const GET = guarded(async () => {
  const subs = await getStore().listSubs()
  return json({
    devices: subs.map(({ endpoint, device, createdAt, lastSentAt, lastAckAt, confirmedAt }) => ({ endpoint, device, createdAt, lastSentAt, lastAckAt, confirmedAt })),
  })
})

/** Turn alerts on for a device. Safe to repeat: the app re-sends it on every launch to self-heal. */
export const POST = guarded(async (req) => {
  const { subscription, device } = (await req.json()) as { subscription: PushSub; device?: string }
  if (!subscription?.endpoint || !subscription.keys?.p256dh) return json({ error: 'Bad subscription' }, 400)
  const store = getStore()
  const old = (await store.listSubs()).find((s) => s.endpoint === subscription.endpoint)
  await store.putSub({
    ...old,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    device: device?.slice(0, 80) ?? old?.device,
    createdAt: old?.createdAt ?? new Date().toISOString(),
  })
  return json({ ok: true, known: Boolean(old) })
})

export const DELETE = guarded(async (req) => {
  const { endpoint } = (await req.json()) as { endpoint?: string }
  if (endpoint) await getStore().deleteSub(endpoint)
  return json({ ok: true })
})
