import { getStore, guarded, json } from '@/lib/auth'
import { getVapid } from '@/lib/push'

export const GET = guarded(async () => {
  const store = getStore()
  const [data, vapid, subs] = await Promise.all([store.getAll(), getVapid(store), store.listSubs()])
  return json({
    ...data,
    status: {
      storage: store.kind,
      push: true,
      vapidKey: vapid.publicKey,
      devices: subs.length,
    },
  })
})
