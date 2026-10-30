'use client'

import { useEffect, useState } from 'react'
import { useApp } from './AppContext'
import { Icon } from './ui'
import { enablePush, getPushState, isIOS, type PushState } from '@/lib/pushClient'

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null)
  const check = () => getPushState().then(setState).catch(() => setState('unsupported'))
  useEffect(() => {
    check()
  }, [])
  return [state, check] as const
}

export function AlertsBanner() {
  const { status, toast } = useApp()
  const [state, recheck] = usePushState()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (!state || state === 'on' || state === 'unsupported' || hidden) return null

  if (state === 'needs-install') {
    return (
      <div className="banner">
        <Icon name="share" size={30} />
        <div className="grow">
          <b style={{ fontSize: 19 }}>Put Schedule Bot on your Home Screen</b>
          <div style={{ opacity: 0.95, marginTop: 4 }}>
            {isIOS() ? 'Apple only allows alerts from apps on the Home Screen:' : 'Install the app to get alerts:'}
          </div>
          <ol className="steps">
            <li>
              Tap the <b>Share</b> button <span aria-hidden>⬆︎</span> in Safari
            </li>
            <li>
              Choose <b>Add to Home Screen</b>
            </li>
            <li>Open Schedule Bot from your Home Screen and turn on alerts</li>
          </ol>
        </div>
      </div>
    )
  }

  if (state === 'blocked') {
    return (
      <div className="banner warn">
        <Icon name="bell" size={30} />
        <div className="grow">
          <b style={{ fontSize: 19 }}>Alerts are blocked</b>
          <div style={{ marginTop: 4 }}>
            {isIOS()
              ? 'Open iPhone Settings → Notifications → Schedule Bot and turn on Allow Notifications.'
              : 'Click the lock icon next to the web address and allow Notifications.'}
          </div>
        </div>
      </div>
    )
  }

  const turnOn = async () => {
    if (!status?.vapidKey) return toast('Alerts are not set up on the server yet')
    setBusy(true)
    try {
      await enablePush(status.vapidKey)
      toast('Alerts are on for this device 🎉')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
      recheck()
    }
  }

  return (
    <div className="banner">
      <Icon name="bell" size={30} />
      <div className="grow">
        <b style={{ fontSize: 19 }}>Turn on alerts</b>
        <div style={{ opacity: 0.95, margin: '4px 0 12px' }}>Get a buzz before appointments and when a callback is due.</div>
        <div className="row wrap">
          <button className="btn" onClick={turnOn} disabled={busy}>
            {busy ? 'Turning on…' : 'Turn On Alerts'}
          </button>
          <button className="text-btn" style={{ color: '#fff' }} onClick={() => setHidden(true)}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
