import 'server-only'
import webpush from 'web-push'
import type { Store } from './store'

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

type Vapid = { publicKey: string; privateKey: string }

/**
 * Push keys come from env vars if set; otherwise the app makes its own once and keeps
 * them in the database, so nobody has to generate or paste them.
 * Never replace them later: every device would have to turn alerts on again.
 */
export async function getVapid(store: Store): Promise<Vapid> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (publicKey && privateKey) return { publicKey, privateKey }
  return store.initConfig<Vapid>('vapid', webpush.generateVAPIDKeys())
}

/** Send to every phone/tablet/computer that turned alerts on (or just `only`). Dead subscriptions are cleaned up. */
export async function pushAll(store: Store, payload: PushPayload, only?: string) {
  const subs = (await store.listSubs()).filter((s) => !only || s.endpoint === only)
  if (!subs.length) return { sent: 0, failed: 0 }
  const { publicKey, privateKey } = await getVapid(store)
  const vapidDetails = { subject: process.env.VAPID_SUBJECT || 'https://storyremodeling.com', publicKey, privateKey }
  let sent = 0
  let failed = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        // Stamp the send first: the device reports back when it arrives (see /api/push/ack), and
        // a send with no report afterwards is how we spot alerts that silently stopped arriving.
        // Only the subscription itself goes to web-push; the health fields stay on our side.
        await store.putSub({ ...s, lastSentAt: new Date().toISOString() })
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'high', vapidDetails })
        sent++
      } catch (e) {
        failed++
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await store.deleteSub(s.endpoint)
        else console.error('push failed', code, (e as Error).message)
      }
    }),
  )
  return { sent, failed }
}
