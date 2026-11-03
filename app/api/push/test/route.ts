import { getStore, guarded, json } from '@/lib/auth'
import { pushAll } from '@/lib/push'

/** Send a test alert to one device (`endpoint`) or, without one, to all of them. */
export const POST = guarded(async (req) => {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string }
  const r = await pushAll(
    getStore(),
    {
      title: '👋 Test alert from Schedule Bot',
      body: 'If you can see this, alerts are working on this device.',
      url: '/',
      tag: 'test',
    },
    endpoint,
  )
  return json(r)
})
