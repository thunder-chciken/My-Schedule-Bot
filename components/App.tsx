'use client'

import { useEffect } from 'react'
import { AppProvider, useApp, type Tab } from './AppContext'
import { Today } from './Today'
import { CalendarView } from './CalendarView'
import { Customers } from './Customers'
import { SettingsView } from './SettingsView'
import { Lock } from './Lock'
import { Icon } from './ui'
import { ItemSheet } from './sheets/ItemSheet'
import { CustomerSheet } from './sheets/CustomerSheet'
import { AddMenu, FollowUpSheet, NoteSheet, SnoozeSheet } from './sheets/SmallSheets'
import { isOverdue } from '@/lib/status'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'customers', label: 'Customers', icon: 'people' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
]

export default function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    const keep = (e: Event) => {
      e.preventDefault()
      ;(window as unknown as { __bip?: Event }).__bip = e
    }
    window.addEventListener('beforeinstallprompt', keep)
    return () => window.removeEventListener('beforeinstallprompt', keep)
  }, [])

  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const app = useApp()
  const { tab, setTab, problem, loading, sheet, open, toastMsg, items, now, customers } = app

  if (problem === 'locked') return <Lock onUnlock={app.unlocked} />

  if (problem === 'storage') {
    return (
      <div className="center" style={{ padding: 24, textAlign: 'center' }}>
        <img src="/icons/192" alt="" width={84} height={84} style={{ borderRadius: 22 }} />
        <h1 className="large-title">Almost ready!</h1>
        <p className="muted" style={{ maxWidth: 460 }}>
          {app.problemText}
        </p>
      </div>
    )
  }

  if (loading && !customers.length && !items.length) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    )
  }

  const overdue = items.filter((i) => isOverdue(i, now)).length
  const badge = (t: Tab) => (t === 'today' && overdue > 0 ? <span className="dot">{overdue}</span> : null)

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <img src="/icons/192" alt="" />
          My Schedule Bot
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={`side-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={24} />
            {t.label}
            {badge(t.id)}
          </button>
        ))}
        <button className="btn primary xl side-add" onClick={() => open({ type: 'add' })}>
          <Icon name="plus" size={24} stroke={2.6} /> Add New
        </button>
      </nav>

      <main className="main">
        {problem === 'offline' && (
          <div className="banner warn" style={{ alignItems: 'center' }}>
            <Icon name="refresh" size={26} />
            <div className="grow">No internet right now. Showing what was saved last.</div>
          </div>
        )}
        {problem === 'server' && (
          <div className="banner warn" style={{ alignItems: 'center' }}>
            <div className="grow">Something went wrong: {app.problemText}</div>
          </div>
        )}
        {tab === 'today' && <Today />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'customers' && <Customers />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <button className="fab" aria-label="Add new" onClick={() => open({ type: 'add' })}>
        <Icon name="plus" size={34} stroke={2.6} />
      </button>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={28} stroke={tab === t.id ? 2.3 : 1.9} />
            {t.label}
            {badge(t.id)}
          </button>
        ))}
      </nav>

      {sheet?.type === 'add' && <AddMenu />}
      {sheet?.type === 'item' && <ItemSheet key={sheet.item?.id ?? 'new'} item={sheet.item} newCustomer={sheet.newCustomer} />}
      {sheet?.type === 'customer' && <CustomerSheet customer={sheet.customer} remind={sheet.remind} />}
      {sheet?.type === 'followup' && <FollowUpSheet customer={sheet.customer} action={sheet.action} />}
      {sheet?.type === 'snooze' && <SnoozeSheet item={sheet.item} />}
      {sheet?.type === 'note' && <NoteSheet customer={sheet.customer} />}

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  )
}
