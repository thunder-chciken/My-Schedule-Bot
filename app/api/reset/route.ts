import { getStore, guarded, json } from '@/lib/auth'
import { DEFAULT_SETTINGS } from '@/lib/types'

/**
 * "Start Fresh": erase every customer and reminder and put settings back to defaults, so the
 * app is like new. The screen downloads a backup file first. Devices getting alerts are kept,
 * so nobody has to set alerts up again, and the time zone is kept so briefings stay on time.
 */
export const POST = guarded(async (req) => {
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string }
  if (confirm !== 'START FRESH') return json({ error: 'Not confirmed' }, 400)
  const store = getStore()
  const { customers, items, settings } = await store.getAll()
  await Promise.all(items.map((i) => store.deleteItem(i.id)))
  await Promise.all(customers.map((c) => store.deleteCustomer(c.id)))
  await store.putSettings({ ...DEFAULT_SETTINGS, timezone: settings.timezone })
  return json({ customers: customers.length, items: items.length })
})
