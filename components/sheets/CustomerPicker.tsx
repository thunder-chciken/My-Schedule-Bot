'use client'

import { useState } from 'react'
import { useApp } from '../AppContext'
import { Avatar, Field, Icon } from '../ui'

export type NewPerson = { name: string; phone: string }

/** Pick an existing customer, or type a new name + number right here. */
export function CustomerPicker({
  value,
  onChange,
  newPerson,
  onNewPerson,
}: {
  value?: string
  onChange: (id?: string) => void
  newPerson: NewPerson | null
  onNewPerson: (p: NewPerson | null) => void
}) {
  const { customers, customerById } = useApp()
  const [q, setQ] = useState('')
  const chosen = customerById(value)

  if (chosen) {
    return (
      <Field label="Customer">
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
    return (
      <Field label="New customer">
        <div className="stack" style={{ gap: 10 }}>
          <input className="input" placeholder="Name" value={newPerson.name} onChange={(e) => onNewPerson({ ...newPerson, name: e.target.value })} />
          <input
            className="input"
            placeholder="Phone number"
            type="tel"
            inputMode="tel"
            value={newPerson.phone}
            onChange={(e) => onNewPerson({ ...newPerson, phone: e.target.value })}
          />
          <button className="text-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onNewPerson(null)}>
            Pick an existing customer instead
          </button>
        </div>
      </Field>
    )
  }

  const term = q.trim().toLowerCase()
  const matches = term
    ? customers.filter((c) => c.name.toLowerCase().includes(term) || c.phone?.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§')).slice(0, 5)
    : [...customers].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 4)

  return (
    <Field label="Customer">
      <div className="search">
        <Icon name="search" size={20} />
        <input className="input" placeholder="Type a name or number…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
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
        <button
          type="button"
          className="list-row"
          style={{ color: 'var(--blue)', fontWeight: 650 }}
          onClick={() => onNewPerson({ name: q.replace(/[\d()+\-\s]{7,}/, '').trim(), phone: /\d{3}/.test(q) ? q.replace(/[^\d()+\-\s]/g, '').trim() : '' })}
        >
          <span className="avatar" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
            <Icon name="plus" size={22} stroke={2.6} />
          </span>
          {q.trim() ? `Add new: “${q.trim()}”` : 'Add a new customer'}
        </button>
      </div>
    </Field>
  )
}
