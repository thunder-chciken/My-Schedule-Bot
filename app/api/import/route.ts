import { getStore, guarded, json } from '@/lib/auth'
import type { AppData } from '@/lib/types'

// Restore from a backup file. Adds/overwrites by id; never deletes anything.
export const POST = guarded(async (req) => {
  const data = (await req.json()) as Partial<AppData>
  const store = getStore()
  const customers = (data.customers ?? []).filter((c) => c?.id && c.name)
  const items = (data.items ?? []).filter((i) => i?.id && i.title && i.at)
  for (const c of customers) await store.putCustomer(c)
  for (const i of items) await store.putItem(i)
  if (data.settings) await store.putSettings(data.settings)
  return json({ customers: customers.length, items: items.length })
})
