'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from './AppContext'
import { Icon, Sheet } from './ui'
import {
  ALERTS_CHANGED,
  alertHealth,
  alertsChanged,
  confirmPush,
  currentSub,
  deviceKind,
  deviceName,
  disablePush,
  enablePush,
  getPushState,
  isAndroid,
  isIOS,
  isStandalone,
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
      ) : isAndroid() ? (
        isStandalone() ? (
          <>
            <li>
              Press and hold the <b>Schedule Bot</b> icon on your Home Screen → <b>App info</b> → <b>Notifications</b>
            </li>
            <li>
              Turn on <b>Allow notifications</b>
            </li>
            <li>
              Swipe down from the top of the screen and make sure <b>Do not disturb</b> is off
            </li>
          </>
        ) : (
          <>
            <li>
              Tap the icon just left of the web address at the top (it looks like a lock or two sliders)
            </li>
            <li>
              Tap <b>Permissions</b> (or <b>Site settings</b>) → <b>Notifications</b> → <b>Allow</b>
            </li>
            <li>
              Not there? Open your phone&apos;s <b>Settings</b> → <b>Apps</b> → <b>Chrome</b> (or Samsung Internet) → <b>Notifications</b> and turn them on
            </li>
            <li>
              Swipe down from the top of the screen and make sure <b>Do not disturb</b> is off
            </li>
          </>
        )
      ) : (
        <>
          <li>Click the lock icon next to the web address → Notifications → Allow, then reload the page</li>
          <li>Check that your computer&apos;s Do Not Disturb / Focus is off</li>
        </>
      )}
      <li>Then come back and {what}</li>
    </ol>
  )
}

/** One picture step: a drawn look-alike of the screen with the spot to tap glowing. */
function GuideStep({ n, text, children }: { n: number; text: ReactNode; children: ReactNode }) {
  return (
    <div className="guide-step">
      <div className="guide-text">
        <span className="guide-n">{n}</span>
        <div>{text}</div>
      </div>
      <div className="mock">{children}</div>
    </div>
  )
}

const Toggle3 = () => <span className="mock-toggle" aria-hidden />

/** Where to switch alerts back on, drawn for the device he's holding. */
function BlockedGuide() {
  const host = typeof location !== 'undefined' ? location.host : 'my-schedule-bot.vercel.app'
  if (isIOS()) {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <GuideStep n={1} text={<>Open the <b>Settings</b> app, tap <b>Notifications</b></>}>
          <div className="mock-row hl">🔔 Notifications <span className="chev">›</span></div>
        </GuideStep>
        <GuideStep n={2} text={<>Scroll to <b>Schedule Bot</b> and tap it</>}>
          <div className="mock-row hl">📅 Schedule Bot <span className="chev">›</span></div>
        </GuideStep>
        <GuideStep n={3} text={<>Turn on <b>Allow Notifications</b></>}>
          <div className="mock-row">Allow Notifications <span className="hl-ring"><Toggle3 /></span></div>
        </GuideStep>
      </div>
    )
  }
  if (isAndroid() && isStandalone()) {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <GuideStep n={1} text={<>On your Home Screen, <b>press and hold</b> the Schedule Bot icon, tap <b>App info</b> (ⓘ)</>}>
          <div className="mock-menu">
            <div className="mock-app">📅</div>
            <div className="mock-row hl">ⓘ App info</div>
          </div>
        </GuideStep>
        <GuideStep n={2} text={<>Tap <b>Notifications</b></>}>
          <div className="mock-row hl">🔔 Notifications <span className="chev">›</span></div>
        </GuideStep>
        <GuideStep n={3} text={<>Turn on <b>Allow notifications</b></>}>
          <div className="mock-row">Allow notifications <span className="hl-ring"><Toggle3 /></span></div>
        </GuideStep>
      </div>
    )
  }
  if (isAndroid()) {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <GuideStep n={1} text={<>Tap the little icon at the very top, <b>just left of the web address</b></>}>
          <div className="mock-bar">
            <span className="hl-ring mock-icon">⚙︎</span>
            <span className="ellipsis">{host}</span>
          </div>
        </GuideStep>
        <GuideStep n={2} text={<>Tap <b>Permissions</b> (some phones say <b>Site settings</b>)</>}>
          <div className="mock-row hl">🔒 Permissions <span className="chev">›</span></div>
        </GuideStep>
        <GuideStep n={3} text={<>Switch <b>Notifications</b> on</>}>
          <div className="mock-row">🔔 Notifications <span className="hl-ring"><Toggle3 /></span></div>
        </GuideStep>
        <div className="small muted">
          Still no alerts after that? Open your phone&apos;s <b>Settings → Apps → Chrome → Notifications</b> and make sure they&apos;re on.
        </div>
      </div>
    )
  }
  return <SettingsTips what="tap I Turned It On" />
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

  // Blocked: some browsers still let us ask again; if not, show the picture guide.
  const [refused, setRefused] = useState(false)
  const askAgain = async () => {
    if (!status?.vapidKey) return toast('Alerts are not set up on the server yet')
    setBusy(true)
    try {
      await enablePush(status.vapidKey)
      await check()
      alertsChanged()
      refresh()
    } catch {
      setRefused(true)
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

  // Only iPhone/iPad need the Home Screen step; Android and computers get alerts straight from the browser.
  const steps = isIOS() ? ['Home Screen', 'Allow alerts', 'Test'] : ['Allow alerts', 'Test']
  const step = (health === 'needs-install' ? 1 : health === 'off' || health === 'blocked' ? 2 : 3) - (3 - steps.length)

  return (
    <Sheet title="Set up alerts" onClose={close}>
      <div className="stack" style={{ gap: 16 }}>
        {health && health !== 'unsupported' && (
          <div className="setup-steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={`Step ${step} of ${steps.length}`}>
            {steps.map((s, i) => (
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
          <div className="card pad stack" style={{ gap: 14 }}>
            <b style={{ fontSize: 19 }}>Alerts are switched off for Schedule Bot</b>
            {!refused ? (
              <>
                <div className="muted">Tap the button and choose <b>Allow</b>.</div>
                <button className="btn primary full xl" onClick={askAgain} disabled={busy}>
                  <Icon name="bell" /> {busy ? 'Asking…' : 'Turn On Alerts'}
                </button>
              </>
            ) : (
              <>
                <div className="muted">
                  Your {deviceKind()} won&apos;t let apps ask again once alerts were blocked, so it takes 3 quick taps in its settings. Here&apos;s exactly where:
                </div>
                <BlockedGuide />
                <div className="small muted" style={{ textAlign: 'center' }}>
                  Come back here when you&apos;re done. Schedule Bot notices on its own.
                </div>
                <button className="btn primary full xl" onClick={() => check()}>
                  I Turned It On
                </button>
              </>
            )}
          </div>
        )}

        {health === 'off' && (
          <div className="card pad stack" style={{ gap: 12 }}>
            <b style={{ fontSize: 19 }}>Allow alerts on {here}</b>
            <div className="muted">Tap the button, then tap <b>Allow</b> when your {deviceKind()} asks.</div>
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
