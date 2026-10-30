import { getStore, guarded, json } from '@/lib/auth'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/types'

export const POST = guarded(async (req) => {
  const body = (await req.json()) as Partial<Settings>
  const s = { ...DEFAULT_SETTINGS, ...body } as Settings
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: s.timezone })
  } catch {
    s.timezone = DEFAULT_SETTINGS.timezone
  }
  await getStore().putSettings(s)
  return json(s)
})
