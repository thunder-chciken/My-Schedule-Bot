'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type AppData, type Customer, type Item, type LogType, type Settings } from '@/lib/types'
import { isOverdue } from '@/lib/status'
import { uid } from '@/lib/dates'

export type Tab = 'today' | 'calendar' | 'customers' | 'settings'

export type SheetState =
  | { type: 'add' }
  | { type: 'item'; item?: Partial<Item> }
  | { type: 'customer'; customer?: Customer; remind?: boolean }
  | { type: 'followup'; customer: Customer; action: LogType }
  | { type: 'snooze'; item: Item }
  | { type: 'note'; customer: Customer }

type Status = { storage: 'redis' | 'file'; push: boolean; vapidKey: string | null; devices: number }

type Ctx = AppData & {
  now: number
  status: Status | null
  loading: boolean
  problem: null | 'locked' | 'storage' | 'offline' | 'server'
  problemText: string
  tab: Tab
  setTab: (t: Tab) => void
  customerId: string | null
  openCustomer: (id: string | null) => void
  sheet: SheetState | null
  open: (s: SheetState) => void
  close: () => void
  toast: (msg: string) => void
  toastMsg: string | null
  refresh: () => Promise<void>
  saveCustomer: (c: Customer) => Promise<Customer>
  removeCustomer: (id: string) => Promise<void>
  saveItem: (i: Item) => Promise<Item>
  removeItem: (id: string) => Promise<void>
  completeItem: (i: Item) => Promise<void>
  saveSettings: (s: Settings) => Promise<void>
  logContact: (c: Customer, type: LogType, text?: string) => Promise<Customer>
  customerById: (id?: string) => Customer | undefined
  unlocked: () => void
}

const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => useContext(AppCtx)!

const CACHE_KEY = 'schedule-bot-cache'

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.message || body.error || 'Request failed'), { status: res.status, code: body.error })
  return body as T
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<Ctx['problem']>(null)
  const [problemText, setProblemText] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [tab, setTabState] = useState<Tab>('today')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tzSynced = useRef(false)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }, [])

  const apply = useCallback((d: AppData) => {
    setCustomers(d.customers)
    setItems(d.items)
    setSettingsState(d.settings)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const d = await api<AppData & { status: Status }>('/api/data')
      apply(d)
      setStatus(d.status)
      setProblem(null)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ customers: d.customers, items: d.items, settings: d.settings }))
      } catch {}
      // Keep the server's clock for morning briefings in his real time zone.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!tzSynced.current && tz && tz !== d.settings.timezone) {
        tzSynced.current = true
        api('/api/settings', { method: 'POST', body: JSON.stringify({ ...d.settings, timezone: tz }) }).catch(() => {})
      }
    } catch (e) {
      const err = e as Error & { status?: number; code?: string }
      if (err.status === 401) setProblem('locked')
      else if (err.code === 'storage') {
        setProblem('storage')
        setProblemText(err.message)
      } else if (!err.status) setProblem('offline')
      else {
        setProblem('server')
        setProblemText(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [apply])

  // Show cached data instantly, then fetch fresh.
  useEffect(() => {
    try {
      const c = localStorage.getItem(CACHE_KEY)
      if (c) apply(JSON.parse(c))
    } catch {}
    refresh()
  }, [apply, refresh])

  // The ticking clock that drives every countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Sync across phone/tablet/desktop + nudge the reminder engine while the app is open.
  useEffect(() => {
    if (problem === 'locked' || problem === 'storage') return
    const beat = () => {
      if (document.visibilityState !== 'visible') return
      refresh()
      fetch('/api/tick', { method: 'POST' }).catch(() => {})
    }
    const t = setInterval(beat, 60_000)
    const onVis = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [problem, refresh])

  // Red badge on the home-screen icon = number of overdue things.
  const overdue = useMemo(() => items.filter((i) => isOverdue(i, now)).length, [items, now])
  useEffect(() => {
    const n = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (overdue > 0) n.setAppBadge?.(overdue).catch(() => {})
    else n.clearAppBadge?.().catch(() => {})
  }, [overdue])

  const saveCustomer = useCallback(
    async (c: Customer) => {
      setCustomers((list) => [...list.filter((x) => x.id !== c.id), c])
      try {
        return await api<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(c) })
      } catch (e) {
        toast(`Couldn't save: ${(e as Error).message}`)
        refresh()
        throw e
      }
    },
    [refresh, toast],
  )

  const removeCustomer = useCallback(
    async (id: string) => {
      setCustomers((list) => list.filter((x) => x.id !== id))
      setItems((list) => list.filter((x) => x.customerId !== id))
      await api(`/api/customers?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => refresh())
    },
    [refresh],
  )

  const saveItem = useCallback(
    async (i: Item) => {
      setItems((list) => [...list.filter((x) => x.id !== i.id), i])
      try {
        return await api<Item>('/api/items', { method: 'POST', body: JSON.stringify(i) })
      } catch (e) {
        toast(`Couldn't save: ${(e as Error).message}`)
        refresh()
        throw e
      }
    },
    [refresh, toast],
  )

  const removeItem = useCallback(
    async (id: string) => {
      setItems((list) => list.filter((x) => x.id !== id))
      await api(`/api/items?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => refresh())
    },
    [refresh],
  )

  const close = useCallback(() => setSheet(null), [])

  const customerById = useCallback((id?: string) => (id ? customers.find((c) => c.id === id) : undefined), [customers])

  const logContact = useCallback(
    async (c: Customer, type: LogType, text?: string) => {
      const at = new Date().toISOString()
      const next: Customer = {
        ...c,
        lastContactAt: type === 'note' ? c.lastContactAt : at,
        log: [{ id: uid(), at, type, text }, ...(c.log ?? [])],
        updatedAt: at,
      }
      saveCustomer(next).catch(() => {})
      return next
    },
    [saveCustomer],
  )

  const completeItem = useCallback(
    async (i: Item) => {
      const at = new Date().toISOString()
      await saveItem({ ...i, done: !i.done, doneAt: i.done ? undefined : at, updatedAt: at })
      if (!i.done) {
        toast('Nice! Marked done ✓')
        const c = customerById(i.customerId)
        if (c && (i.kind === 'callback' || i.kind === 'email' || i.kind === 'appointment')) {
          logContact(c, i.kind === 'callback' ? 'call' : i.kind === 'email' ? 'email' : 'visit', i.title)
        }
      }
    },
    [customerById, logContact, saveItem, toast],
  )

  const saveSettings = useCallback(
    async (s: Settings) => {
      setSettingsState(s)
      await api('/api/settings', { method: 'POST', body: JSON.stringify(s) }).catch(() => toast("Couldn't save settings"))
    },
    [toast],
  )

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0 })
  }, [])

  const openCustomer = useCallback(
    (id: string | null) => {
      setCustomerId(id)
      if (id) setTabState('customers')
      setSheet(null)
      window.scrollTo({ top: 0 })
    },
    [],
  )

  // Opening the app from a notification jumps straight to that reminder.
  useEffect(() => {
    const openUrl = (url: string) => {
      const id = new URL(url, location.origin).searchParams.get('item')
      if (!id) return setTabState('today')
      const it = items.find((x) => x.id === id)
      if (it) setSheet({ type: 'item', item: it })
    }
    const params = new URLSearchParams(location.search)
    if (params.get('item') && items.length) {
      openUrl(location.href)
      history.replaceState(null, '', '/')
    }
    const onMsg = (e: MessageEvent) => e.data?.type === 'open' && openUrl(e.data.url)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [items])

  const value: Ctx = {
    customers,
    items,
    settings,
    now,
    status,
    loading,
    problem,
    problemText,
    tab,
    setTab,
    customerId,
    openCustomer,
    sheet,
    open: setSheet,
    close,
    toast,
    toastMsg,
    refresh,
    saveCustomer,
    removeCustomer,
    saveItem,
    removeItem,
    completeItem,
    saveSettings,
    logContact,
    customerById,
    unlocked: () => {
      setProblem(null)
      setLoading(true)
      refresh()
    },
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export { api }
