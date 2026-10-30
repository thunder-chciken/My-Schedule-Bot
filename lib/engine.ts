import 'server-only'
import type { Store } from './store'
import { pushAll, type PushPayload } from './push'
import { staleLevel } from './status'
import type { Customer, Item, Settings } from './types'

const MIN = 60_000
const HOUR = 60 * MIN
const KEEP = 14 * 24 * 60 * 60 // remember sent alerts for 2 weeks

export function localParts(t: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

const clock = (t: number, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(t)

function untilText(ms: number) {
  const m = Math.round(ms / MIN)
  if (m <= 1) return 'now'
  if (m < 60) return `in ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `in ${h} hour${h > 1 ? 's' : ''}`
  const d = Math.round(h / 24)
  return d === 1 ? 'tomorrow' : `in ${d} days`
}

function lateText(ms: number) {
  const h = Math.floor(ms / HOUR)
  if (h < 1) return `${Math.max(1, Math.round(ms / MIN))} min overdue`
  if (h < 48) return `${h}h overdue`
  return `${Math.floor(h / 24)} days overdue`
}

const ICON: Record<Item['kind'], string> = { appointment: '📅', callback: '📞', email: '✉️', task: '✅' }

function inQuiet(hour: number, s: Settings) {
  return s.quietStart > s.quietEnd
    ? hour >= s.quietStart || hour < s.quietEnd
    : hour >= s.quietStart && hour < s.quietEnd
}

function describe(it: Item, who?: Customer) {
  const bits = [who?.name, who?.phone, it.location].filter(Boolean)
  return bits.length ? '\n' + bits.join(' · ') : ''
}

/**
 * Looks at every open reminder and sends the push alerts that are due.
 * Safe to call as often as you like (every minute is ideal): each alert is claimed once.
 */
export async function runReminders(store: Store, now = Date.now()) {
  const { customers, items, settings: s } = await store.getAll()
  const byId = new Map(customers.map((c) => [c.id, c]))
  const tz = s.timezone
  const { date: today, hour } = localParts(now, tz)
  const quiet = inQuiet(hour, s)
  const out: PushPayload[] = []

  for (const it of items) {
    if (it.done) continue
    const due = Date.parse(it.at)
    const who = it.customerId ? byId.get(it.customerId) : undefined
    const saved = Date.parse(it.updatedAt) - MIN

    // Alerts before / at the due time. If several are past (e.g. the server was asleep), send just one.
    let fresh = false
    for (const off of [...(it.alerts ?? [])].sort((a, b) => b - a)) {
      const fireAt = due - off * MIN
      if (now < fireAt) continue
      const stale = (off > 0 && now >= due) || (off === 0 && now - due > 2 * HOUR) || fireAt < saved
      const claimed = await store.claim(`a:${it.id}:${it.at}:${off}`, KEEP)
      if (claimed && !stale) fresh = true
    }
    if (fresh) {
      const left = due - now
      const when = left <= MIN ? `now (${clock(due, tz)})` : `${untilText(left)} · ${clock(due, tz)}`
      out.push({
        title: `${ICON[it.kind]} ${it.title}`,
        body: `${it.kind === 'appointment' ? 'Starts' : 'Due'} ${when}${describe(it, who)}`,
        url: `/?item=${it.id}`,
        tag: it.id,
      })
    }

    // Keep nagging about overdue callbacks / emails / to-dos (not during quiet hours).
    if (it.kind !== 'appointment' && s.nagHours > 0 && !quiet) {
      const late = now - due
      const n = Math.floor(late / (s.nagHours * HOUR))
      if (n >= 1 && n <= 10 && (await store.claim(`n:${it.id}:${it.at}:${n}`, KEEP))) {
        out.push({
          title: `🔴 Still waiting: ${it.title}`,
          body: `${lateText(late)}${describe(it, who)}`,
          url: `/?item=${it.id}`,
          tag: it.id,
        })
      }
    }
  }

  // Morning briefing, once a day.
  if (s.morningBriefing && hour >= s.briefingHour && hour < 12 && (await store.claim(`b:${today}`, 3 * 86400))) {
    const open = items.filter((i) => !i.done)
    const todays = open.filter((i) => localParts(Date.parse(i.at), tz).date === today)
    const appts = todays.filter((i) => i.kind === 'appointment').length
    const calls = todays.length - appts
    const overdue = open.filter((i) => Date.parse(i.at) < now).length
    const waiting = customers.filter(
      (c) => staleLevel(c, now, s) === 'red' && !open.some((i) => i.customerId === c.id),
    ).length
    const parts = [
      appts && `${appts} appointment${appts > 1 ? 's' : ''}`,
      calls && `${calls} callback${calls > 1 ? 's' : ''}`,
      overdue && `${overdue} overdue`,
      waiting && `${waiting} customer${waiting > 1 ? 's' : ''} waiting to hear from you`,
    ].filter(Boolean)
    out.push({
      title: `☀️ Good morning, ${s.ownerName || 'boss'}!`,
      body: parts.length ? `Today: ${parts.join(' · ')}` : 'Nothing on the books yet. Great day to call a few leads.',
      url: '/',
      tag: 'briefing',
    })
  }

  // Don't bury the lock screen: more than 3 at once becomes one summary.
  const batch: PushPayload[] =
    out.length > 3
      ? [{ title: `🔔 ${out.length} reminders need you`, body: out.map((p) => p.title).slice(0, 6).join('\n'), url: '/', tag: 'summary' }]
      : out
  let sent = 0
  for (const p of batch) sent += (await pushAll(store, p)).sent
  return { alerts: out.length, delivered: sent }
}
