import { getStore, guarded, json } from '@/lib/auth'
import { pushAll } from '@/lib/push'

export const POST = guarded(async () => {
  const r = await pushAll(getStore(), {
    title: '👋 Alerts are working!',
    body: 'This is how My Schedule Bot will remind you about callbacks and appointments.',
    url: '/',
    tag: 'test',
  })
  return json(r)
})
