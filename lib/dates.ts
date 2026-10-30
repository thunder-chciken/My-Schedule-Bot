export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).replace(/-/g, '')

export const pad = (n: number) => String(n).padStart(2, '0')

/** yyyy-mm-dd in the device's local time */
export const dayKey = (d: Date | number | string) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

export const timeValue = (d: Date | string) => {
  const x = new Date(d)
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export const fromLocal = (date: string, time: string) => new Date(`${date}T${time || '09:00'}`).toISOString()

export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function fmtWhen(iso: string, now = Date.now()) {
  const d = new Date(iso)
  const today = dayKey(now)
  const tomorrow = dayKey(now + 86400000)
  const yesterday = dayKey(now - 86400000)
  const k = dayKey(d)
  const day =
    k === today
      ? 'Today'
      : k === tomorrow
        ? 'Tomorrow'
        : k === yesterday
          ? 'Yesterday'
          : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return `${day} · ${fmtTime(d)}`
}

const at = (base: Date, days: number, h: number, m = 0) => {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d
}

const roundUp = (t: number, mins = 5) => Math.ceil(t / (mins * 60000)) * mins * 60000

/** The quick-pick buttons: "In 1 hour", "Tomorrow 9 AM", ... */
export function quickTimes(now = new Date()) {
  const t = now.getTime()
  const list: { label: string; date: Date }[] = [
    { label: 'In 1 hour', date: new Date(roundUp(t + 3600000)) },
    { label: 'In 3 hours', date: new Date(roundUp(t + 3 * 3600000)) },
  ]
  if (now.getHours() < 17) list.push({ label: 'Tonight 6 PM', date: at(now, 0, 18) })
  list.push({ label: 'Tomorrow 9 AM', date: at(now, 1, 9) })
  list.push({ label: 'In 3 days', date: at(now, 3, 9) })
  const toMonday = ((8 - now.getDay()) % 7) || 7
  list.push({ label: 'Next Monday', date: at(now, toMonday, 9) })
  list.push({ label: 'In 2 weeks', date: at(now, 14, 9) })
  return list
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const ALERT_OPTIONS = [
  { min: 0, label: 'On time' },
  { min: 15, label: '15 min before' },
  { min: 60, label: '1 hour before' },
  { min: 120, label: '2 hours before' },
  { min: 1440, label: '1 day before' },
]

export const DEFAULT_ALERTS: Record<string, number[]> = {
  appointment: [1440, 60, 15],
  callback: [0],
  email: [0],
  task: [0],
}
