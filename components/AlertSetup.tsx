'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from './AppContext'
import { Icon, Sheet } from './ui'
import {
  ALERTS_CHANGED,
  alertHealth,
  alertsChanged,
  confirmPush,
  currentSub,
  deviceName,
  disablePush,
  enablePush,
  getPushState,
  isIOS,
  listDevices,
  testPush,
  type AlertHealth,
  type DeviceInfo,
} from '@/lib/pushClient'

export function ago(iso: string | undefined, now = Date.now()) {
  if (!iso) return ''
  const m = Math.round((now - Date.parse(iso)) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/** Alert health for this device: browser permission + subscription, plus what the server saw. */
export function useAlertHealth() {
  const [health, setHealth] = useState<AlertHealth | null>(null)
  const [device, setDevice] = useState<DeviceInfo | undefined>()
  const check = useCallback(async () => {
    const state = await getPushState().catch(() => 'unsupported' as const)
    let d: DeviceInfo | undefined
    if (state === 'on') {
      const [sub, list] = await Promise.all([currentSub(), listDevices().catch(() => [])])
      d = list.find((x) => x.endpoint === sub?.endpoint)
    }
    setDevice(d)
    setHealth(alertHealth(state, d))
    return d
  }, [])
  useEffect(() => {
    check()
    const onVis = () => document.visibilityState === 'visible' && check()
    window.addEventListener(ALERTS_CHANGED, check)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener(ALERTS_CHANGED, check)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [check])
  return { health, device, check }
}

const FOCUS_TIP = 'Using Focus or Do Not Disturb? Open Settings → Focus → pick your Focus → Apps, and add Schedule Bot so its alerts still come through.'

function SettingsTips({ what }: { what: string }) {
  return (
    <ol className="steps">
      {isIOS() ? (
        <>
          <li>
            Open the <b>Settings</b> app → <b>Notifications</b> → <b>Schedule Bot</b>
          </li>
          <li>
            Turn on <b>Allow Notifications</b>, <b>Lock Screen</b>, <b>Banners</b> and <b>Sounds</b>
          </li>
          <li>{FOCUS_TIP}</li>
        </>
      ) : (
        <>
          <li>Check that notifications are allowed for this site (the lock icon by the web address)</li>
          <li>Check that your computer&apos;s Do Not Disturb / Focus is off</li>
        </>
      )}
      <li>Then come back and {what}</li>
    </ol>
  )
}

type Phase = 'idle' | 'waiting' | 'arrived' | 'missing' | 'unseen' | 'done'

/** Step-by-step: put on Home Screen → allow alerts → send a test → "did you see it?" */
export function AlertSetupSheet() {
  const { close, status, toast, refresh } = useApp()
  const { health, device, check } = useAlertHealth()
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])
  const here = deviceName() === 'This device' ? 'this device' : `this ${deviceName()}`

  const turnOn = async () => {
    if (!status?.vapidKey) return toast('Alerts are not set up on the server yet')
    setBusy(true)
    try {
      await enablePush(status.vapidKey)
      await check()
      alertsChanged()
      refresh()
    } catch (e) {
      toast((e as Error).message)
    }
    setBusy(false)
  }

  /** Send a test to this device only and watch for it to report back (up to 30 seconds). */
  const sendTest = async () => {
    const sub = await currentSub()
    if (!sub) return setPhase('missing')
    const started = Date.now()
    setPhase('waiting')
    const r = await testPush(sub.endpoint).catch(() => ({ sent: 0, failed: 1 }))
    if (!r.sent) return alive.current && setPhase('missing')
    while (alive.current && Date.now() - started < 30_000) {
      await new Promise((ok) => setTimeout(ok, 2000))
      const d = await check()
      if (d?.lastAckAt && Date.parse(d.lastAckAt) >= started - 5000) return alive.current && setPhase('arrived')
    }
    if (alive.current) setPhase('missing')
  }

  const saw = async () => {
    const sub = await currentSub()
    if (sub) await confirmPush(sub.endpoint).catch(() => {})
    await check()
    alertsChanged()
    setPhase('done')
  }

  /** Throw away this device's subscription and make a fresh one, then test again. */
  const repair = async () => {
    if (!status?.vapidKey) return
    setBusy(true)
    try {
      await disablePush().catch(() => {})
      await enablePush(status.vapidKey)
      await check()
      alertsChanged()
      setBusy(false)
      sendTest()
    } catch (e) {
      setBusy(false)
      toast((e as Error).message)
    }
  }

  const step = health === 'needs-install' ? 1 : health === 'off' || health === 'blocked' ? 2 : 3

  return (
    <Sheet title="Set up alerts" onClose={close}>
      <div className="stack" style={{ gap: 16 }}>
        {health && health !== 'unsupported' && (
          <div className="setup-steps" aria-label={`Step ${step} of 3`}>
            {['Home Screen', 'Allow alerts', 'Test'].map((s, i) => (
              <div key={s} className={`setup-step ${i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''}`}>
                <span>{i + 1 < step ? <Icon name="check" size={16} stroke={3} /> : i + 1}</span>
                {s}
              </div>
            ))}
          </div>
        )}

        {!health && <div className="muted">Checking…</div>}

        {health === 'unsupported' && (
          <div className="card pad">
            This browser can&apos;t show alerts. On iPhone or iPad use Safari; on a computer use Chrome or Edge.
          </div>
        )}

        {health === 'needs-install' && (
          <div className="card pad">
            <b style={{ fontSize: 19 }}>First, put Schedule Bot on your Home Screen</b>
            <div className="muted" style={{ marginTop: 4 }}>
              Apple only lets apps on the Home Screen send alerts.
            </div>
            <ol className="steps">
              <li>
                Tap the <b>Share</b> button <span aria-hidden>⬆︎</span> at the bottom of Safari
              </li>
              <li>
                Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>
              </li>
              <li>Open Schedule Bot from your Home Screen and come back to this screen</li>
            </ol>
          </div>
        )}

        {health === 'blocked' && (
          <div className="card pad">
            <b style={{ fontSize: 19 }}>Alerts are switched off for Schedule Bot</b>
            <SettingsTips what="tap Check Again" />
            <button className="btn primary full xl" onClick={() => check()}>
              Check Again
            </button>
          </div>
        )}

        {health === 'off' && (
          <div className="card pad stack" style={{ gap: 12 }}>
            <b style={{ fontSize: 19 }}>Allow alerts on {here}</b>
            <div className="muted">Tap the button, then tap <b>Allow</b> when your {isIOS() ? 'iPhone' : 'device'} asks.</div>
            <button className="btn primary full xl" onClick={turnOn} disabled={busy}>
              <Icon name="bell" /> {busy ? 'Turning on…' : 'Turn On Alerts'}
            </button>
          </div>
        )}

        {(health === 'untested' || health === 'broken' || health === 'ok') && (
          <div className="card pad stack" style={{ gap: 12 }}>
            {phase === 'idle' && (
              <>
                {health === 'broken' ? (
                  <>
                    <b style={{ fontSize: 19 }}>The last alert didn&apos;t reach {here}</b>
                    <div className="muted">Send a test to see whether alerts are getting through.</div>
                  </>
                ) : health === 'ok' ? (
                  <>
                    <div className="row">
                      <span className="status-dot lvl-green" />
                      <b className="grow" style={{ fontSize: 19 }}>
                        Alerts confirmed on {here}
                      </b>
                    </div>
                    {device?.lastAckAt && <div className="muted">Last alert arrived {ago(device.lastAckAt)}.</div>}
                  </>
                ) : (
                  <>
                    <b style={{ fontSize: 19 }}>Send yourself a test alert</b>
                    <div className="muted">It pops up at the top of the screen in a few seconds. Then tell us if you saw it.</div>
                  </>
                )}
                <button className="btn primary full xl" onClick={sendTest}>
                  <Icon name="bell" /> Send Test Alert
                </button>
              </>
            )}

            {phase === 'waiting' && (
              <>
                <b style={{ fontSize: 19 }}>Sending… watch the top of your screen</b>
                <div className="muted">Waiting for it to arrive on {here} (up to 30 seconds).</div>
              </>
            )}

            {phase === 'arrived' && (
              <>
                <b style={{ fontSize: 19 }}>It arrived on {here}. Did you see it pop up?</b>
                <div className="grid-2">
                  <button className="btn plain xl" onClick={() => setPhase('unseen')}>
                    No
                  </button>
                  <button className="btn primary xl" onClick={saw}>
                    <Icon name="check" stroke={2.6} /> Yes, I saw it
                  </button>
                </div>
              </>
            )}

            {phase === 'unseen' && (
              <>
                <b style={{ fontSize: 19 }}>It reached {here} but stayed quiet</b>
                <div className="muted">Usually a setting is hiding it:</div>
                <SettingsTips what="send another test" />
                <button className="btn primary full xl" onClick={sendTest}>
                  Send Another Test
                </button>
              </>
            )}

            {phase === 'missing' && (
              <>
                <b style={{ fontSize: 19 }}>The test didn&apos;t arrive</b>
                <div className="muted">Let&apos;s reconnect alerts on {here} and try again.</div>
                <button className="btn primary full xl" onClick={repair} disabled={busy}>
                  {busy ? 'Reconnecting…' : 'Fix & Try Again'}
                </button>
                <SettingsTips what="tap Fix & Try Again" />
              </>
            )}

            {phase === 'done' && (
              <>
                <div className="row">
                  <span className="status-dot lvl-green" />
                  <b className="grow" style={{ fontSize: 19 }}>
                    Alerts confirmed on {here} 🎉
                  </b>
                </div>
                {isIOS() && <div className="muted">{FOCUS_TIP}</div>}
                <div className="muted">Use Schedule Bot on another phone, tablet or computer? Run this setup there too.</div>
                <button className="btn primary full xl" onClick={close}>
                  Done
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
