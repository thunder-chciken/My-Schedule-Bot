'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Lock } from './Lock'
import { InstallButton } from './Install'

type Mode = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset' | 'notapproved' | 'passcode'
type Info = { emailLogin: boolean; hasPasscode: boolean; notApproved: string | null }

const NOTES: Record<string, string> = {
  expired: 'That link has expired or was already used. Please try again.',
  'google-off': 'Google sign-in isn’t switched on yet. Use your email for now.',
  unavailable: 'Sign-in isn’t set up yet.',
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
  const data = (await res?.json().catch(() => ({}))) as { ok?: boolean; sent?: boolean; error?: string; email?: string }
  return { ok: Boolean(res?.ok), ...(res ? data : { error: 'No internet connection.' }) }
}

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * The front door: Google, or email + password (create account, verify by email, forgot password).
 * Only approved emails get in. The owner passcode stays as a backup way in.
 */
export function Login({ onUnlock }: { onUnlock: () => void }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [sentWhat, setSentWhat] = useState<'verify' | 'reset'>('verify')

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const auth = q.get('auth')
    if (auth) history.replaceState(null, '', location.pathname) // tidy the address bar
    fetch('/api/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: Info) => {
        setInfo(s)
        if (!s.emailLogin) return setMode('passcode')
        if (auth === 'reset') setMode('reset')
        else if (auth === 'notapproved' || s.notApproved) {
          setEmail(s.notApproved ?? '')
          setMode('notapproved')
        } else if (auth && NOTES[auth]) setNote(NOTES[auth])
      })
      .catch(() => setInfo({ emailLogin: false, hasPasscode: true, notApproved: null }))
  }, [])

  const go = (m: Mode) => {
    setError('')
    setNote('')
    setPassword('')
    setPassword2('')
    setMode(m)
  }

  const handle = (r: Awaited<ReturnType<typeof post>>) => {
    if (r.error === 'notapproved') {
      setEmail(r.email ?? email)
      return go('notapproved')
    }
    if (r.error) return setError(r.error)
    if (r.sent) return go('sent')
    if (r.ok) onUnlock()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (mode === 'reset' && password !== password2) return setError('The two passwords don’t match.')
    setBusy(true)
    if (mode === 'signin') handle(await post('/api/auth/signin', { email, password }))
    if (mode === 'signup') {
      setSentWhat('verify')
      handle(await post('/api/auth/signup', { email, password }))
    }
    if (mode === 'forgot') {
      setSentWhat('reset')
      handle(await post('/api/auth/forgot', { email }))
    }
    if (mode === 'reset') handle(await post('/api/auth/password', { password }))
    setBusy(false)
  }

  if (!info) return <div className="center"><div className="spinner" /></div>
  if (mode === 'passcode') return <Lock onUnlock={onUnlock} onBack={info.emailLogin ? () => go('signin') : undefined} />

  const pw = (value: string, set: (v: string) => void, label: string, auto: string) => (
    <label className="field">
      <span>{label}</span>
      <div className="pw-wrap">
        <input className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} required minLength={mode === 'signin' ? 1 : 8} />
        <button type="button" className="text-btn pw-show" onClick={() => setShow((s) => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  )

  const title = { signin: 'Sign in', signup: 'Create your account', forgot: 'Reset your password', sent: 'Check your email', reset: 'Choose a new password', notapproved: 'Not approved yet' }[mode]

  return (
    <div className="login">
      <img src="/icons/192" alt="" className="login-logo" />
      <h1 className="large-title" style={{ margin: 0 }}>
        My Schedule Bot
      </h1>
      <div className="card pad login-card">
        <h2 style={{ margin: '0 0 14px', fontSize: 22 }}>{title}</h2>

        {note && <div className="login-note">{note}</div>}

        {mode === 'signin' && (
          <>
            <a className="btn google full xl" href="/api/auth/google">
              <GoogleMark /> Continue with Google
            </a>
            <div className="login-or">or use your email</div>
          </>
        )}

        {(mode === 'signin' || mode === 'signup' || mode === 'forgot' || mode === 'reset') && (
          <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
            {mode !== 'reset' && (
              <label className="field">
                <span>Email</span>
                <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
            )}
            {(mode === 'signin' || mode === 'signup' || mode === 'reset') && pw(password, setPassword, mode === 'signin' ? 'Password' : 'New password (8+ characters)', mode === 'signin' ? 'current-password' : 'new-password')}
            {mode === 'reset' && pw(password2, setPassword2, 'Type it again', 'new-password')}
            {mode === 'signup' && <div className="small muted">Use the email address that was approved for this app.</div>}
            {mode === 'forgot' && <div className="small muted">We’ll email you a link to choose a new password.</div>}
            {error && <div className="login-error">{error}</div>}
            <button className="btn primary full xl" disabled={busy}>
              {busy ? 'One moment…' : { signin: 'Sign In', signup: 'Create Account', forgot: 'Send Reset Link', reset: 'Save Password' }[mode]}
            </button>
          </form>
        )}

        {mode === 'sent' && (
          <div className="stack" style={{ gap: 12 }}>
            <div style={{ fontSize: 44, textAlign: 'center' }}>📬</div>
            <div>
              {sentWhat === 'verify' ? (
                <>
                  We sent a link to <b>{email}</b>. Tap it to verify your email, and you&apos;re in.
                </>
              ) : (
                <>
                  If <b>{email}</b> has an account, a link to choose a new password is on its way.
                </>
              )}
            </div>
            <div className="small muted">Don&apos;t see it within a minute? Check your spam or junk folder. You can open the link on any device.</div>
            <button className="btn soft full" onClick={() => go('signin')}>
              Back to Sign In
            </button>
          </div>
        )}

        {mode === 'notapproved' && (
          <div className="stack" style={{ gap: 12 }}>
            <div>
              {email ? <b>{email}</b> : 'That email'} isn&apos;t on the list for this app yet.
            </div>
            <div className="muted">Ask whoever runs the app to add it in <b>Settings → People who can sign in</b>, then try again.</div>
            <button className="btn soft full" onClick={() => go('signin')}>
              Back to Sign In
            </button>
          </div>
        )}

        <div className="login-links">
          {mode === 'signin' && (
            <>
              <button className="text-btn" onClick={() => go('forgot')}>
                Forgot password?
              </button>
              <button className="text-btn" onClick={() => go('signup')}>
                New here? Create an account
              </button>
            </>
          )}
          {(mode === 'signup' || mode === 'forgot' || mode === 'reset') && (
            <button className="text-btn" onClick={() => go('signin')}>
              ← Back to Sign In
            </button>
          )}
        </div>
      </div>

      <div className="stack" style={{ width: '100%', maxWidth: 420, gap: 10 }}>
        <InstallButton className="btn soft full" label="Install the App" />
        {info.hasPasscode && mode === 'signin' && (
          <button className="text-btn small" onClick={() => go('passcode')}>
            Use owner passcode
          </button>
        )}
      </div>
    </div>
  )
}
