import 'server-only'
import type { Store } from './store'

/** The emails allowed to sign in. Everyone on the list shares the same customers. */
const KEY = 'approved_emails'

export const normEmail = (e: string) => e.trim().toLowerCase()
export const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// Checked on every request, so keep it for a few seconds per server instance.
let cache: { at: number; list: string[] } | null = null

export async function getApproved(store: Store) {
  if (cache && Date.now() - cache.at < 15_000) return cache.list
  const list = ((await store.getConfig<string[]>(KEY)) ?? []).map(normEmail)
  cache = { at: Date.now(), list }
  return list
}

export async function setApproved(store: Store, list: string[]) {
  const clean = [...new Set(list.map(normEmail).filter(looksLikeEmail))].sort()
  await store.setConfig(KEY, clean)
  cache = { at: Date.now(), list: clean }
  return clean
}

export const isApproved = async (store: Store, email: string) => (await getApproved(store)).includes(normEmail(email))
