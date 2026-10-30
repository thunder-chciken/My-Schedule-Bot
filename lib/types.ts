export type Stage = 'lead' | 'estimate' | 'active' | 'done'

export type LogType = 'call' | 'text' | 'email' | 'note' | 'visit'

export type LogEntry = {
  id: string
  at: string
  type: LogType
  text?: string
}

export type Customer = {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  stage: Stage
  createdAt: string
  updatedAt: string
  lastContactAt?: string
  log: LogEntry[]
}

export type ItemKind = 'appointment' | 'callback' | 'email' | 'task'

export type Item = {
  id: string
  kind: ItemKind
  title: string
  customerId?: string
  /** When it is due / starts (ISO string) */
  at: string
  durationMin?: number
  location?: string
  notes?: string
  done: boolean
  doneAt?: string
  createdAt: string
  updatedAt: string
  /** Minutes before `at` to send an alert. 0 = right on time. */
  alerts: number[]
}

export type Settings = {
  ownerName: string
  timezone: string
  /** Turn orange when something is due within this many hours */
  warnHours: number
  /** Turn red when something is due within this many minutes */
  urgentMinutes: number
  /** Warn about leads/estimates you have not contacted in this many days */
  staleLeadDays: number
  /** Re-alert about overdue callbacks every N hours (0 = never) */
  nagHours: number
  morningBriefing: boolean
  briefingHour: number
  /** No nagging between these hours (appointment alerts still come through) */
  quietStart: number
  quietEnd: number
}

export type AppData = {
  customers: Customer[]
  items: Item[]
  settings: Settings
}

export type PushSub = {
  endpoint: string
  keys: { p256dh: string; auth: string }
  device?: string
  createdAt: string
}

export const DEFAULT_SETTINGS: Settings = {
  ownerName: 'Jason',
  timezone: 'America/Chicago',
  warnHours: 24,
  urgentMinutes: 60,
  staleLeadDays: 3,
  nagHours: 3,
  morningBriefing: true,
  briefingHour: 7,
  quietStart: 21,
  quietEnd: 7,
}

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'lead', label: 'New Lead' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'active', label: 'Active Job' },
  { id: 'done', label: 'Finished' },
]

export const KINDS: { id: ItemKind; label: string; verb: string }[] = [
  { id: 'callback', label: 'Call Back', verb: 'Call back' },
  { id: 'appointment', label: 'Appointment', verb: 'Meet' },
  { id: 'email', label: 'Email', verb: 'Email' },
  { id: 'task', label: 'To-Do', verb: 'Do' },
]
