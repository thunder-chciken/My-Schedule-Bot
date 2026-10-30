'use client'

import { useMemo, useState } from 'react'
import { useApp } from './AppContext'
import { ItemCard, mailHref, mapHref, smsHref, telHref, useContactAction } from './ItemCard'
import { Avatar, Empty, Icon, Segmented } from './ui'
import { customerLevel, lastContactLabel } from '@/lib/status'
import { fmtWhen } from '@/lib/dates'
import { STAGES, type Customer, type Stage } from '@/lib/types'
import { downloadVCard } from '@/lib/exporters'

type Filter = 'all' | Stage

const LOG_ICON: Record<string, string> = { call: 'phone', text: 'text', email: 'mail', note: 'note', visit: 'map' }
const LOG_LABEL: Record<string, string> = { call: 'Called', text: 'Texted', email: 'Emailed', note: 'Note', visit: 'Visited' }

export function Customers() {
  const { customers, items, now, settings, customerId, openCustomer, open } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    return customers
      .filter((c) => filter === 'all' || c.stage === filter)
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.address?.toLowerCase().includes(term) ||
          (digits.length > 2 && c.phone?.replace(/\D/g, '').includes(digits)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [customers, q, filter])

  const selected = customers.find((c) => c.id === customerId)

  return (
    <div className="split">
      <div className={selected ? 'list-pane hide-on-phone' : 'list-pane'}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <h1 className="large-title grow">Customers</h1>
          <button className="btn sm primary" onClick={() => open({ type: 'customer', remind: true })}>
            <Icon name="plus" size={20} stroke={2.6} /> Add
          </button>
        </div>
        <p className="subtitle">
          {customers.length} {customers.length === 1 ? 'person' : 'people'} · never lose a number again
        </p>
        <div className="stack" style={{ marginBottom: 14 }}>
          <div className="search">
            <Icon name="search" size={20} />
            <input className="input" placeholder="Search name, phone, address…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
          </div>
          <Segmented<Filter>
            scroll
            value={filter}
            onChange={setFilter}
            options={[{ id: 'all', label: 'All' }, ...STAGES.map((s) => ({ id: s.id as Filter, label: s.label }))]}
          />
        </div>
        {list.length ? (
          <div className="list">
            {list.map((c) => {
              const lvl = customerLevel(c, items, now, settings)
              return (
                <button key={c.id} className={`list-row ${c.id === customerId ? 'sel' : ''}`} onClick={() => openCustomer(c.id)}>
                  <Avatar name={c.name} level={lvl} />
                  <div className="grow">
                    <div className="ellipsis" style={{ fontWeight: 650, fontSize: 18 }}>
                      {c.name}
                    </div>
                    <div className="small muted ellipsis">
                      {STAGES.find((s) => s.id === c.stage)?.label} · {lastContactLabel(c, now)}
                    </div>
                  </div>
                  <span className="chev">
                    <Icon name="right" size={20} />
                  </span>
                </button>
              )
            })}
          </div>
        ) : customers.length ? (
          <div className="card pad muted" style={{ textAlign: 'center' }}>
            No one matches that search.
          </div>
        ) : (
          <Empty title="No customers yet" text="Add the next person who calls you. Their number will be safe here forever.">
            <button className="btn primary" onClick={() => open({ type: 'customer', remind: true })}>
              <Icon name="addperson" /> Add First Customer
            </button>
          </Empty>
        )}
      </div>
      <div className="detail-pane">
        {selected ? (
          <CustomerDetail c={selected} />
        ) : (
          customers.length > 0 && (
            <div className="card pad muted hide-on-phone" style={{ textAlign: 'center', padding: 48, marginTop: 70 }}>
              Pick a customer to see their info.
            </div>
          )
        )}
      </div>
    </div>
  )
}

function CustomerDetail({ c }: { c: Customer }) {
  const { items, now, settings, openCustomer, open, saveCustomer, removeCustomer, toast } = useApp()
  const contact = useContactAction()
  const theirs = items.filter((i) => i.customerId === c.id).sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const openOnes = theirs.filter((i) => !i.done)
  const lvl = customerLevel(c, items, now, settings)

  const setStage = (stage: Stage) => saveCustomer({ ...c, stage, updatedAt: new Date().toISOString() })

  const del = async () => {
    if (!confirm(`Delete ${c.name} and their reminders? This can't be undone.`)) return
    await removeCustomer(c.id)
    openCustomer(null)
    toast(`${c.name} deleted`)
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <button className="text-btn back-btn row" style={{ gap: 4, alignSelf: 'flex-start' }} onClick={() => openCustomer(null)}>
        <Icon name="left" size={22} /> Customers
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-block' }}>
          <Avatar name={c.name} level={lvl} lg />
        </div>
        <h1 className="large-title" style={{ marginTop: 12 }}>
          {c.name}
        </h1>
        <div className={`lvl-${lvl}`} style={{ color: lvl === 'none' ? 'var(--muted)' : 'var(--c)', fontWeight: 650 }}>
          {lastContactLabel(c, now)}
        </div>
      </div>

      <div className="contact-actions">
        <a className={c.phone ? '' : 'disabled'} href={telHref(c.phone)} onClick={() => contact(c, 'call')}>
          <Icon name="phone" size={26} />
          Call
        </a>
        <a className={c.phone ? '' : 'disabled'} href={smsHref(c.phone)} onClick={() => contact(c, 'text')}>
          <Icon name="text" size={26} />
          Text
        </a>
        <a className={c.email ? '' : 'disabled'} href={mailHref(c.email)} onClick={() => contact(c, 'email')}>
          <Icon name="mail" size={26} />
          Email
        </a>
        <a className={c.address ? '' : 'disabled'} href={mapHref(c.address)} target="_blank" rel="noreferrer">
          <Icon name="map" size={26} />
          Map
        </a>
      </div>

      <Segmented<Stage> value={c.stage} onChange={setStage} options={STAGES.map((s) => ({ id: s.id, label: s.label }))} />

      <div className="list">
        <Info label="Phone" value={c.phone} href={telHref(c.phone)} />
        <Info label="Email" value={c.email} href={mailHref(c.email)} />
        <Info label="Address" value={c.address} href={mapHref(c.address)} />
        {c.notes && (
          <div className="info-row">
            <div className="grow">
              <label>Notes</label>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid-2">
        <button className="btn soft" onClick={() => open({ type: 'item', item: { kind: 'callback', customerId: c.id } })}>
          <Icon name="bell" /> Remind Me
        </button>
        <button className="btn soft" onClick={() => open({ type: 'item', item: { kind: 'appointment', customerId: c.id, location: c.address } })}>
          <Icon name="calendar" /> Appointment
        </button>
      </div>

      {openOnes.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 8, marginBottom: 0 }}>
            Coming up <span className="count">{openOnes.length}</span>
          </h2>
          {openOnes.map((i) => (
            <ItemCard key={i.id} item={i} />
          ))}
        </>
      )}

      <div className="row" style={{ marginTop: 8 }}>
        <h2 className="section-title grow" style={{ margin: 0 }}>
          History
        </h2>
        <button className="btn sm plain" onClick={() => open({ type: 'note', customer: c })}>
          <Icon name="note" size={20} /> Add Note
        </button>
      </div>
      <div className="list">
        {(c.log ?? []).slice(0, 30).map((l) => (
          <div key={l.id} className="log-row">
            <span className="log-icon">
              <Icon name={LOG_ICON[l.type]} size={18} />
            </span>
            <div className="grow">
              <div style={{ fontWeight: 650 }}>
                {LOG_LABEL[l.type]}
                <span className="muted small" style={{ fontWeight: 500 }}>
                  {' '}
                  · {fmtWhen(l.at, now)}
                </span>
              </div>
              {l.text && <div style={{ whiteSpace: 'pre-wrap' }}>{l.text}</div>}
            </div>
          </div>
        ))}
        <div className="log-row">
          <span className="log-icon">
            <Icon name="person" size={18} />
          </span>
          <div className="grow">
            <div style={{ fontWeight: 650 }}>
              Added
              <span className="muted small" style={{ fontWeight: 500 }}>
                {' '}
                · {fmtWhen(c.createdAt, now)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 6 }}>
        <button className="btn plain" onClick={() => open({ type: 'customer', customer: c })}>
          <Icon name="pencil" /> Edit Info
        </button>
        <button className="btn plain" onClick={() => downloadVCard(c)}>
          <Icon name="download" /> Save to Phone Contacts
        </button>
      </div>
      <button className="btn danger" onClick={del}>
        <Icon name="trash" /> Delete Customer
      </button>
    </div>
  )
}

function Info({ label, value, href }: { label: string; value?: string; href?: string }) {
  if (!value) return null
  return (
    <a className="info-row" href={href} target={label === 'Address' ? '_blank' : undefined} rel="noreferrer">
      <div className="grow">
        <label>{label}</label>
        <div className="val">{value}</div>
      </div>
    </a>
  )
}
