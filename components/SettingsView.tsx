'use client'

import { useEffect, useRef, useState } from 'react'
import { api, useApp } from './AppContext'
import { usePushState } from './AlertsBanner'
import { Icon, Stepper, Toggle } from './ui'
import { disablePush, enablePush, isIOS, testPush } from '@/lib/pushClient'
import { downloadAllVCards, downloadBackup, downloadCsv } from '@/lib/exporters'
import type { Settings } from '@/lib/types'

const hourLabel = (h: number) => {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric' })
}

type InstallEvent = Event & { prompt: () => Promise<void> }

export function SettingsView() {
  const { settings, saveSettings, status, customers, items, toast, refresh } = useApp()
  const [push, recheck] = usePushState()
  const [busy, setBusy] = useState(false)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [name, setName] = useState(settings.ownerName)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setName(settings.ownerName), [settings.ownerName])
  useEffect(() => {
    setInstall((window as unknown as { __bip?: InstallEvent }).__bip ?? null)
    const h = (e: Event) => {
      e.preventDefault()
      setInstall(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => saveSettings({ ...settings, [k]: v })

  const turnOn = async () => {
    if (!status?.vapidKey) return toast('Push keys are missing on the server')
    setBusy(true)
    try {
      await enablePush(status.vapidKey)
      toast('Alerts are on for this device 🎉')
      refresh()
    } catch (e) {
      toast((e as Error).message)
    }
    setBusy(false)
    recheck()
  }

  const turnOff = async () => {
    setBusy(true)
    await disablePush().catch(() => {})
    setBusy(false)
    recheck()
    refresh()
    toast('Alerts off for this device')
  }

  const test = async () => {
    const r = await testPush()
    toast(r.sent ? `Sent to ${r.sent} device${r.sent > 1 ? 's' : ''} — check your screen!` : 'No devices have alerts turned on yet')
  }

  const restore = async (f?: File) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      const r = await api<{ customers: number; items: number }>('/api/import', { method: 'POST', body: JSON.stringify(data) })
      toast(`Restored ${r.customers} customers and ${r.items} reminders`)
      refresh()
    } catch {
      toast("That file didn't look like a Schedule Bot backup")
    }
  }

  const lock = async () => {
    await fetch('/api/logout', { method: 'POST' })
    location.reload()
  }

  return (
    <>
      <h1 className="large-title">Settings</h1>
      <p className="subtitle">Make Schedule Bot work the way you do.</p>

      <h2 className="section-title">🔔 Alerts on this device</h2>
      <div className="card pad stack">
        {push === 'on' && (
          <>
            <div className="row">
              <span className="status-dot lvl-green" />
              <b className="grow">Alerts are ON</b>
            </div>
            <div className="grid-2">
              <button className="btn soft" onClick={test}>
                <Icon name="bell" /> Send Test Alert
              </button>
              <button className="btn plain" onClick={turnOff} disabled={busy}>
                Turn Off Here
              </button>
            </div>
          </>
        )}
        {push === 'off' && (
          <>
            <div className="muted">Turn this on for every device you use: phone, tablet and computer.</div>
            <button className="btn primary xl" onClick={turnOn} disabled={busy}>
              <Icon name="bell" /> {busy ? 'Turning on…' : 'Turn On Alerts'}
            </button>
          </>
        )}
        {push === 'needs-install' && (
          <div>
            <b>First, add this app to your Home Screen.</b>
            <ol className="steps">
              <li>Tap the Share button ⬆︎ in Safari</li>
              <li>Tap “Add to Home Screen”</li>
              <li>Open Schedule Bot from the Home Screen, come back here and tap Turn On Alerts</li>
            </ol>
          </div>
        )}
        {push === 'blocked' && (
          <div>
            <b>Alerts are blocked for this app.</b>
            <div className="muted" style={{ marginTop: 4 }}>
              {isIOS()
                ? 'Open the iPhone Settings app → Notifications → Schedule Bot → Allow Notifications.'
                : 'Click the lock icon by the web address → Notifications → Allow, then reload.'}
            </div>
          </div>
        )}
        {push === 'unsupported' && <div className="muted">This browser can&apos;t do push alerts. Try Safari on iPhone/iPad or Chrome/Edge on a computer.</div>}
        <div className="small muted">
          {status?.devices ?? 0} device{status?.devices === 1 ? '' : 's'} getting alerts
          {status && !status.push && ' · ⚠️ push keys not set on the server'}
        </div>
        {install && (
          <button className="btn soft" onClick={() => install.prompt().then(() => setInstall(null))}>
            <Icon name="download" /> Install App on This Device
          </button>
        )}
      </div>

      <h2 className="section-title">🙂 You</h2>
      <div className="card pad">
        <label className="field">
          <span>Your first name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== settings.ownerName && set('ownerName', name.trim())} />
        </label>
      </div>

      <h2 className="section-title">🚦 Countdown colors</h2>
      <div className="list">
        <div className="info-row">
          <span className="status-dot lvl-orange" />
          <div className="grow">
            <b>Turn orange</b>
            <div className="small muted">when it&apos;s due within</div>
          </div>
          <Stepper value={settings.warnHours} min={1} max={72} onChange={(v) => set('warnHours', v)} format={(v) => `${v} hr`} />
        </div>
        <div className="info-row">
          <span className="status-dot lvl-red" />
          <div className="grow">
            <b>Turn red</b>
            <div className="small muted">when it&apos;s due within</div>
          </div>
          <Stepper value={settings.urgentMinutes} min={15} max={240} step={15} onChange={(v) => set('urgentMinutes', v)} format={(v) => (v < 60 ? `${v} min` : `${v / 60} hr`)} />
        </div>
        <div className="info-row">
          <span className="status-dot lvl-orange" />
          <div className="grow">
            <b>Quiet leads warning</b>
            <div className="small muted">if I haven&apos;t talked to a lead in</div>
          </div>
          <Stepper value={settings.staleLeadDays} min={1} max={30} onChange={(v) => set('staleLeadDays', v)} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
        </div>
        <div className="info-row">
          <span className="status-dot lvl-red" />
          <div className="grow">
            <b>Keep nagging me</b>
            <div className="small muted">about overdue callbacks every</div>
          </div>
          <Stepper value={settings.nagHours} min={0} max={24} onChange={(v) => set('nagHours', v)} format={(v) => (v ? `${v} hr` : 'Off')} />
        </div>
      </div>

      <h2 className="section-title">☀️ Daily briefing & quiet time</h2>
      <div className="list">
        <div className="info-row">
          <div className="grow">
            <b>Morning briefing</b>
            <div className="small muted">A summary of your day on your lock screen</div>
          </div>
          <Toggle on={settings.morningBriefing} onChange={(v) => set('morningBriefing', v)} label="Morning briefing" />
        </div>
        {settings.morningBriefing && (
          <div className="info-row">
            <div className="grow">
              <b>Briefing time</b>
            </div>
            <Stepper value={settings.briefingHour} min={4} max={11} onChange={(v) => set('briefingHour', v)} format={hourLabel} />
          </div>
        )}
        <div className="info-row">
          <div className="grow">
            <b>Quiet time starts</b>
            <div className="small muted">No nagging (appointments still alert)</div>
          </div>
          <Stepper value={settings.quietStart} min={17} max={23} onChange={(v) => set('quietStart', v)} format={hourLabel} />
        </div>
        <div className="info-row">
          <div className="grow">
            <b>Quiet time ends</b>
          </div>
          <Stepper value={settings.quietEnd} min={4} max={10} onChange={(v) => set('quietEnd', v)} format={hourLabel} />
        </div>
      </div>

      <h2 className="section-title">💾 Backup & export</h2>
      <div className="card pad stack">
        <div className="grid-2">
          <button className="btn soft" onClick={() => downloadCsv(customers)}>
            <Icon name="download" /> Customers (Excel)
          </button>
          <button className="btn soft" onClick={() => downloadAllVCards(customers)}>
            <Icon name="person" /> All to Phone Contacts
          </button>
          <button className="btn soft" onClick={() => downloadBackup({ customers, items, settings })}>
            <Icon name="download" /> Full Backup File
          </button>
          <button className="btn plain" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Restore Backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        <div className="small muted">Tip: save a full backup once a month to your email or Files.</div>
      </div>

      <h2 className="section-title">🔒 Security</h2>
      <div className="card pad stack">
        <button className="btn plain" onClick={lock}>
          <Icon name="lock" /> Lock App on This Device
        </button>
        <div className="small muted">
          Time zone: {settings.timezone} · Storage: {status?.storage === 'file' ? 'This computer only (dev)' : 'Cloud (synced)'}
        </div>
      </div>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 28 }}>
        My Schedule Bot · made for Story Remodeling 💙
      </p>
    </>
  )
}
