import { getStore, guarded, json } from '@/lib/auth'
import { pushConfigured } from '@/lib/push'

export const GET = guarded(async () => {
  const store = getStore()
  const data = await store.getAll()
  return json({
    ...data,
    status: {
      storage: store.kind,
      push: pushConfigured(),
      vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
      devices: (await store.listSubs()).length,
    },
  })
})
