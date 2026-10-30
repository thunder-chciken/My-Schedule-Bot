import { getStore, guarded, json } from '@/lib/auth'
import { runReminders } from '@/lib/engine'

// While the app is open on any device it nudges the reminder check every minute.
export const POST = guarded(async () => json(await runReminders(getStore())))
