'use client'

import { useState } from 'react'
import { useApp } from '../AppContext'
import { Avatar, Field, Icon } from '../ui'

export type NewPerson = { name: string; phone: string; email: string; address: string }

/** Pick an existing customer, or type a new customer right here. */
export function CustomerPicker({
  value,
  onChange,
  newPerson,
  onNewPerson,
  startNew,
}: {
  value?: string
  onChange: (id?: string) => void
  newPerson: NewPerson | null
  onNewPerson: (p: NewPerson | null) => void
  /** Opens the new-customer form (with any address already on the reminder filled in). */
  startNew: (p?: Partial<NewPerson>) => void
}) {
  const { customers, customerById } = useApp()
  const [q, setQ] = useState('')
  const chosen = customerById(value)

  if (chosen) {
    return (
      <Field group label="Customer">
        <div className="card row" style={{ padding: '10px 10px 10px 14px' }}>
          <Avatar name={chosen.name} />
          <div className="grow">
            <div style={{ fontWeight: 650 }}>{chosen.name}</div>
            <div className="small muted">{chosen.phone || chosen.email || 'No phone saved'}</div>
          </div>
          <button className="text-btn" onClick={() => onChange(undefined)}>
            Change
          </button>
        </div>
      </Field>
    )
  }

  if (newPerson) {
    const set = (k: keyof NewPerson) => (e: React.ChangeEvent<HTMLInputElement>) => onNewPerson({ ...newPerson, [k]: e.target.value })
    return (
      <Field group label="New customer">
        <div className="card pad stack" style={{ gap: 10, background: 'var(--blue-softer)' }}>
          <input className="input" placeholder="Name" autoFocus value={newPerson.name} onChange={set('name')} />
          <input className="input" placeholder="Phone number" type="tel" inputMode="tel" value={newPerson.phone} onChange={set('phone')} />
          <input className="input" placeholder="Email (optional)" type="email" inputMode="email" value={newPerson.email} onChange={set('email')} />
          <input className="input" placeholder="Address (optional)" value={newPerson.address} onChange={set('address')} />
          <button className="text-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onNewPerson(null)}>
            Pick an existing customer instead
          </button>
        </div>
      </Field>
    )
  }

  const term = q.trim().toLowerCase()
  const digits = term.replace(/\D/g, '')
  const matches = term
    ? customers.filter((c) => c.name.toLowerCase().includes(term) || (digits.length > 2 && c.phone?.replace(/\D/g, '').includes(digits))).slice(0, 5)
    : [...customers].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 4)

  // Carry over whatever he already typed in the search box.
  const addTyped = () => {
    const t = q.trim()
    startNew(/\d{3}/.test(t) ? { phone: t } : t ? { name: t } : {})
  }

  return (
    <Field group label="Customer">
      <button type="button" className="btn soft full" onClick={addTyped}>
        <Icon name="addperson" /> {q.trim() ? `New Customer: “${q.trim()}”` : 'New Customer'}
      </button>
      {customers.length > 0 && (
        <>
          <div className="search" style={{ marginTop: 6 }}>
            <Icon name="search" size={20} />
            <input className="input" placeholder="…or find an existing customer" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {matches.length > 0 && (
            <div className="list" style={{ marginTop: 6 }}>
              {matches.map((c) => (
                <button key={c.id} type="button" className="list-row" onClick={() => onChange(c.id)}>
                  <Avatar name={c.name} />
                  <div className="grow">
                    <div style={{ fontWeight: 650 }}>{c.name}</div>
                    <div className="small muted">{c.phone || c.email || ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Field>
  )
}
