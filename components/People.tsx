'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { api, useApp } from './AppContext'
import { Icon } from './ui'

/** Settings card: who's signed in here, and the emails allowed to sign in. */
export function PeopleCard() {
  const { toast } = useApp()
  const [people, setPeople] = useState<string[] | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [emailLogin, setEmailLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ people: string[]; me: string | null }>('/api/people')
      .then((r) => {
        setPeople(r.people)
        setMe(r.me)
      })
      .catch(() => setPeople([]))
    fetch('/api/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: { emailLogin: boolean }) => setEmailLogin(s.emailLogin))
      .catch(() => {})
  }, [])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || busy) return
    setBusy(true)
    try {
      const r = await api<{ people: string[] }>('/api/people', { method: 'POST', body: JSON.stringify({ email }) })
      setPeople(r.people)
      toast(`${email.trim()} can now sign in`)
      setEmail('')
    } catch (err) {
      toast((err as Error).message)
    }
    setBusy(false)
  }

  const remove = async (who: string) => {
    if (!confirm(`Remove ${who}? They'll be signed out and won't be able to get back in.`)) return
    try {
      const r = await api<{ people: string[] }>('/api/people', { method: 'DELETE', body: JSON.stringify({ email: who }) })
      setPeople(r.people)
      toast(`${who} removed`)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <div className="card pad stack">
      <div className="small muted">
        {me ? (
          <>
            You&apos;re signed in as <b>{me}</b>.
          </>
        ) : (
          <>You&apos;re signed in with the owner passcode.</>
        )}
      </div>
      <div className="muted">These people can sign in with Google or their email. Everyone shares the same customers.</div>
      {people === null ? (
        <div className="muted">Loading…</div>
      ) : people.length === 0 ? (
        <div className="card pad small" style={{ background: 'var(--orange-soft)' }}>
          Nobody yet. Add your own email first, then Jason&apos;s.
        </div>
      ) : (
        <div className="list">
          {people.map((p) => (
            <div key={p} className="info-row">
              <div className="grow ellipsis">
                {p}
                {p === me && <span className="muted small"> · you</span>}
              </div>
              {p !== me && (
                <button className="icon-btn" aria-label={`Remove ${p}`} onClick={() => remove(p)}>
                  <Icon name="x" size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <form className="row" style={{ gap: 8 }} onSubmit={add}>
        <input className="input grow" type="email" inputMode="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn primary" disabled={busy || !email.trim()}>
          <Icon name="plus" size={20} stroke={2.6} /> Add
        </button>
      </form>
      {!emailLogin && <div className="small muted">Google and email sign-in switch on once they&apos;re set up in Supabase. Until then everyone uses the passcode.</div>}
    </div>
  )
}
