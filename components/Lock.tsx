'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from './ui'

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('')
  const [shake, setShake] = useState(false)
  const [msg, setMsg] = useState('Enter your passcode')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!code || busy) return
    setBusy(true)
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: code }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) return onUnlock()
    const body = await res?.json().catch(() => ({}))
    setMsg(body?.error ?? 'No connection')
    setShake(true)
    setCode('')
    setTimeout(() => setShake(false), 450)
  }, [busy, code, onUnlock])

  const press = (k: string) => setCode((c) => (c.length < 12 ? c + k : c))

  // Typing on a computer keyboard works too.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setCode((c) => c.slice(0, -1))
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [submit])

  return (
    <div className="lock">
      <img src="/icons/192" alt="" />
      <div>
        <h1 className="large-title" style={{ margin: 0 }}>
          My Schedule Bot
        </h1>
        <p className="muted" style={{ margin: '6px 0 0', fontWeight: 600 }}>
          {msg}
        </p>
      </div>
      <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-live="polite">
        {Array.from({ length: Math.max(4, code.length) }, (_, i) => (
          <i key={i} className={i < code.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button className="ghost" onClick={() => setCode((c) => c.slice(0, -1))} aria-label="Delete">
          Delete
        </button>
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={submit} aria-label="Unlock" disabled={busy}>
          <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 28, background: 'var(--blue)', color: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={28} stroke={2.8} />
          </span>
        </button>
      </div>
    </div>
  )
}
