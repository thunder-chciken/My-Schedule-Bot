import { getStore, guarded, json } from '@/lib/auth'
import type { Item } from '@/lib/types'

export const POST = guarded(async (req) => {
  const i = (await req.json()) as Item
  if (!i?.id || !i.title?.trim() || Number.isNaN(Date.parse(i.at))) return json({ error: 'Title and time are required' }, 400)
  i.alerts = (i.alerts ?? []).filter((n) => Number.isFinite(n) && n >= 0).slice(0, 6)
  i.updatedAt = new Date().toISOString()
  await getStore().putItem(i)
  return json(i)
})

export const DELETE = guarded(async (req) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return json({ error: 'id required' }, 400)
  await getStore().deleteItem(id)
  return json({ ok: true })
})
