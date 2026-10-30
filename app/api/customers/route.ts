import { getStore, guarded, json } from '@/lib/auth'
import type { Customer } from '@/lib/types'

export const POST = guarded(async (req) => {
  const c = (await req.json()) as Customer
  if (!c?.id || !c.name?.trim()) return json({ error: 'A name is required' }, 400)
  c.log = (c.log ?? []).slice(0, 500)
  c.updatedAt = new Date().toISOString()
  await getStore().putCustomer(c)
  return json(c)
})

export const DELETE = guarded(async (req) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return json({ error: 'id required' }, 400)
  const store = getStore()
  const { items } = await store.getAll()
  // Remove this customer's reminders too so nothing nags about a deleted person.
  await Promise.all(items.filter((i) => i.customerId === id).map((i) => store.deleteItem(i.id)))
  await store.deleteCustomer(id)
  return json({ ok: true })
})
