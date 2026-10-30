import 'server-only'
import webpush from 'web-push'
import type { Store } from './store'

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

let ready = false
function init() {
  if (ready) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://storyremodeling.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  ready = true
}

/** Send to every phone/tablet/computer that turned alerts on. Dead subscriptions are cleaned up. */
export async function pushAll(store: Store, payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0, failed: 0 }
  init()
  const subs = await store.listSubs()
  let sent = 0
  let failed = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'high' })
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
