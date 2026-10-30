import type { Customer, Item, Settings } from './types'

export type Level = 'green' | 'orange' | 'red' | 'done' | 'none'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const LEVEL_RANK: Record<Level, number> = { red: 3, orange: 2, green: 1, none: 0, done: -1 }

/** Green = plenty of time, orange = coming up soon, red = right now or overdue. */
export function itemLevel(item: Item, now: number, s: Settings): Level {
  if (item.done) return 'done'
  const left = new Date(item.at).getTime() - now
  if (left <= s.urgentMinutes * MIN) return 'red'
  if (left <= s.warnHours * HOUR) return 'orange'
  return 'green'
}

export function isOverdue(item: Item, now: number) {
  return !item.done && new Date(item.at).getTime() < now
}

/** "in 2d 4h", "in 14m 05s", "3h overdue" */
export function countdown(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  const late = diff < 0
  const ms = Math.abs(diff)
  const d = Math.floor(ms / DAY)
  const h = Math.floor((ms % DAY) / HOUR)
  const m = Math.floor((ms % HOUR) / MIN)
  const sec = Math.floor((ms % MIN) / 1000)
  let t: string
  if (d >= 1) t = `${d}d ${h}h`
  else if (h >= 1) t = `${h}h ${m}m`
  else t = `${m}m ${String(sec).padStart(2, '0')}s`
  return late ? `${t} late` : `in ${t}`
}

export function daysSince(iso: string | undefined, now: number) {
  if (!iso) return Infinity
  return (now - new Date(iso).getTime()) / DAY
}

/** Leads and estimates go stale if he has not talked to them in a while. */
export function staleLevel(c: Customer, now: number, s: Settings): Level {
  if (c.stage !== 'lead' && c.stage !== 'estimate') return 'none'
  const days = daysSince(c.lastContactAt ?? c.createdAt, now)
  if (days >= s.staleLeadDays) return 'red'
  if (days >= Math.max(1, s.staleLeadDays - 1)) return 'orange'
  return 'green'
}

export function customerLevel(c: Customer, items: Item[], now: number, s: Settings): Level {
  const open = items.filter((i) => i.customerId === c.id && !i.done)
  // An open reminder means he has a plan for this customer; its clock wins.
  if (open.length) {
    return open.reduce<Level>((worst, i) => {
      const l = itemLevel(i, now, s)
      return LEVEL_RANK[l] > LEVEL_RANK[worst] ? l : worst
    }, 'none')
  }
  return staleLevel(c, now, s)
}

export function lastContactLabel(c: Customer, now: number) {
  const days = daysSince(c.lastContactAt, now)
  if (days === Infinity) return 'Never contacted'
  if (days < 1 / 24) return 'Talked just now'
  if (days < 1) return `Talked ${Math.floor(days * 24)}h ago`
  if (days < 2) return 'Talked yesterday'
  return `Talked ${Math.floor(days)} days ago`
}
