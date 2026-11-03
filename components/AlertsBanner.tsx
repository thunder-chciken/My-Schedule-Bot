'use client'

import { useState } from 'react'
import { useApp } from './AppContext'
import { ago, useAlertHealth } from './AlertSetup'
import { Icon } from './ui'
import { deviceName, isAndroid, isIOS } from '@/lib/pushClient'

/** Top of Today: what (if anything) he needs to do so alerts reach this device. */
export function AlertsBanner() {
  const { open, now } = useApp()
  const { health, device } = useAlertHealth()
  const [hidden, setHidden] = useState(false)
  const setup = () => open({ type: 'alerts' })
  const here = deviceName() === 'This device' ? 'this device' : `this ${deviceName()}`

  if (!health || health === 'unsupported') return null

  // All good: one quiet line, so he can trust it at a glance.
  if (health === 'ok') {
    return (
      <button className="alerts-ok" onClick={setup}>
        <Icon name="check" size={16} stroke={3} /> Alerts working{device?.lastAckAt ? ` · last one ${ago(device.lastAckAt, now)}` : ''}
      </button>
    )
  }

  // Alerts were sent but never arrived: always show, no "Not now".
  if (health === 'broken') {
    return (
      <div className="banner warn">
        <Icon name="bell" size={30} />
        <div className="grow">
          <b style={{ fontSize: 19 }}>Alerts may not be reaching {here}</b>
          <div style={{ margin: '4px 0 12px' }}>The last alert we sent never arrived. Let&apos;s check it.</div>
          <button className="btn" onClick={setup}>
            Fix Alerts
          </button>
        </div>
      </div>
    )
  }

  if (hidden) return null

  if (health === 'blocked') {
    return (
      <div className="banner warn">
        <Icon name="bell" size={30} />
        <div className="grow">
          <b style={{ fontSize: 19 }}>Alerts are blocked</b>
          <div style={{ margin: '4px 0 12px' }}>
            {isIOS() || isAndroid()
              ? "Tap Show Me How. It's 3 quick taps to switch them back on."
              : 'Click the lock icon next to the web address and allow Notifications.'}
          </div>
          <button className="btn" onClick={setup}>
            Show Me How
          </button>
        </div>
      </div>
    )
  }

  const copy = {
    'needs-install': { title: 'Put Schedule Bot on your Home Screen', text: 'Apple only sends alerts to apps on the Home Screen. It takes 30 seconds.', button: 'Show Me How' },
    off: { title: 'Turn on alerts', text: 'Get a buzz before appointments and when a callback is due.', button: 'Set Up Alerts' },
    untested: { title: 'Make sure alerts reach you', text: 'Send yourself a quick test so you know they’ll pop up.', button: 'Test Alerts' },
  }[health]

  return (
    <div className="banner">
      <Icon name={health === 'needs-install' ? 'share' : 'bell'} size={30} />
      <div className="grow">
        <b style={{ fontSize: 19 }}>{copy.title}</b>
        <div style={{ opacity: 0.95, margin: '4px 0 12px' }}>{copy.text}</div>
        <div className="row wrap">
          <button className="btn" onClick={setup}>
            {copy.button}
          </button>
          <button className="text-btn" style={{ color: '#fff' }} onClick={() => setHidden(true)}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
