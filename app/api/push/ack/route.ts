import type { NextRequest } from 'next/server'
import { getStore, json } from '@/lib/auth'

/**
 * The service worker calls this when an alert lands on the device. No passcode check: it runs in
 * the background, and the endpoint (a long secret URL only that device knows) is the proof.
 * All it can do is stamp "an alert arrived" on a device that is already registered.
 */
export async function POST(req: NextRequest) {
  try {
    const { endpoint } = (await req.json()) as { endpoint?: string }
    if (!endpoint || endpoint.length > 1000) return json({ ok: false }, 400)
    const store = getStore()
    const sub = (await store.listSubs()).find((s) => s.endpoint === endpoint)
    if (!sub) return json({ ok: false }, 404)
    await store.putSub({ ...sub, lastAckAt: new Date().toISOString() })
    return json({ ok: true })
  } catch {
    return json({ ok: false }, 500)
  }
}
