import { getStore, guarded, json } from '@/lib/auth'
import type { PushSub } from '@/lib/types'

export const POST = guarded(async (req) => {
  const { subscription, device } = (await req.json()) as { subscription: PushSub; device?: string }
  if (!subscription?.endpoint || !subscription.keys?.p256dh) return json({ error: 'Bad subscription' }, 400)
  await getStore().putSub({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    device: device?.slice(0, 80),
    createdAt: new Date().toISOString(),
  })
  return json({ ok: true })
})

export const DELETE = guarded(async (req) => {
  const { endpoint } = (await req.json()) as { endpoint?: string }
  if (endpoint) await getStore().deleteSub(endpoint)
  return json({ ok: true })
})
