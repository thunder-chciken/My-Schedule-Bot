'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from './AppContext'
import { AlertsBanner } from './AlertsBanner'
import { contactMessage, ItemCard, mailHref, smsHref, telHref, useContactAction } from './ItemCard'
import { Avatar, Empty, Icon } from './ui'
import { itemLevel, lastContactLabel, staleLevel } from '@/lib/status'
import { dayKey, greeting } from '@/lib/dates'
import type { Item } from '@/lib/types'

const byTime = (a: Item, b: Item) => +new Date(a.at) - +new Date(b.at)
type Meter = 'overdue' | 'today' | 'upcoming'

export function QuickActions() {
  const { open } = useApp()
  return (
    <div className="quick">
      <button onClick={() => open({ type: 'item', item: { kind: 'callback' } })}>
        <span className="q-icon" style={{ background: 'linear-gradient(160deg,#36A3FF,#0A72F5)' }}>
          <Icon name="phone" size={28} />
        </span>
        Call Back Reminder
      </button>
      <button onClick={() => open({ type: 'item', item: { kind: 'appointment' } })}>
        <span className="q-icon" style={{ background: 'linear-gradient(160deg,#7B8CFF,#4F5BEA)' }}>
          <Icon name="calendar" size={28} />
        </span>
        New Appointment
      </button>
      <button onClick={() => open({ type: 'customer', remind: true })}>
        <span className="q-icon" style={{ background: 'linear-gradient(160deg,#4AD6C8,#13A8B5)' }}>
          <Icon name="addperson" size={28} />
        </span>
        New Customer
      </button>
    </div>
  )
}

export function Today() {
  const { items, customers, now, settings, open, openCustomer } = useApp()
  const contact = useContactAction()
  const [picked, setPicked] = useState<Meter | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openItems = items.filter((i) => !i.done).sort(byTime)
  const today = dayKey(now)

  const urgent = openItems.filter((i) => itemLevel(i, now, settings) === 'red')
  const todayRest = openItems.filter((i) => !urgent.includes(i) && dayKey(i.at) === today)
  const upcoming = openItems.filter((i) => !urgent.includes(i) && !todayRest.includes(i)).slice(0, 12)
  const doneToday = items.filter((i) => i.done && i.doneAt && dayKey(i.doneAt) === today).length
  const waiting = customers
    .filter((c) => !openItems.some((i) => i.customerId === c.id))
    .map((c) => ({ c, lvl: staleLevel(c, now, settings) }))
    .filter((x) => x.lvl === 'red' || x.lvl === 'orange')
    .sort((a, b) => +new Date(a.c.lastContactAt ?? a.c.createdAt) - +new Date(b.c.lastContactAt ?? b.c.createdAt))

  // Tapping a counter shows exactly the items it counted, right under the counters
  const overdueList = openItems.filter((i) => new Date(i.at).getTime() < now)
  const groups: Record<Meter, { label: string; lvl: string; list: Item[] }> = {
    overdue: { label: 'Overdue', lvl: 'red', list: overdueList },
    today: { label: 'Due today', lvl: 'orange', list: [...urgent.filter((i) => !overdueList.includes(i)), ...todayRest] },
    upcoming: { label: 'Coming up', lvl: 'green', list: openItems.filter((i) => !urgent.includes(i) && !todayRest.includes(i)) },
  }
  const shown = picked && groups[picked].list.length ? groups[picked] : null
  const pick = (m: Meter) => {
    if (!groups[m].list.length) return
    setPicked((p) => (p === m ? null : m))
  }

  useEffect(() => {
    if (picked) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [picked])

  // Last item in the open list got done: close the panel instead of leaving it waiting
  useEffect(() => {
    if (picked && !shown) setPicked(null)
  }, [picked, shown])

  const name = settings.ownerName?.trim()

  return (
    <>
      <h1 className="large-title">
        {greeting(new Date(now))}
        {name ? `, ${name}` : ''} 👋
      </h1>
      <p className="subtitle">
        {new Date(now).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        {doneToday > 0 && ` · ${doneToday} done today 🎉`}
      </p>

      <AlertsBanner />

      <div className="meters">
        {(Object.keys(groups) as Meter[]).map((m) => {
          const g = groups[m]
          const empty = g.list.length === 0
          return (
            <button
              key={m}
              className={`meter lvl-${g.lvl} ${picked === m ? 'on' : ''}`}
              onClick={() => pick(m)}
              disabled={empty}
              aria-expanded={empty ? undefined : picked === m}
            >
              <b>{g.list.length}</b>
              <span>{g.label}</span>
              {!empty && <Icon name={picked === m ? 'up' : 'down'} size={18} />}
            </button>
          )
        })}
      </div>

      {shown && (
        <div ref={panelRef} className={`meter-panel lvl-${shown.lvl}`}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 className="section-title grow" style={{ margin: 0 }}>
              {shown.label} <span className="count">{shown.list.length}</span>
            </h2>
            <button className="btn sm plain" onClick={() => setPicked(null)}>
              Close
            </button>
          </div>
          <div className="stack">
            {shown.list.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        </div>
      )}

      <QuickActions />

      {openItems.length === 0 && waiting.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <Empty title="You're all caught up!" text="No callbacks or appointments waiting. Add one with the big buttons above." />
        </div>
      ) : (
        <div className="today-cols">
          <div>
            {urgent.length > 0 && (
              <>
                <h2 className="section-title">
                  🔴 Needs you now <span className="count">{urgent.length}</span>
                </h2>
                <div className="stack">
                  {urgent.map((i) => (
                    <ItemCard key={i.id} item={i} />
                  ))}
                </div>
              </>
            )}
            {todayRest.length > 0 && (
              <>
                <h2 className="section-title">
                  🟠 Later today <span className="count">{todayRest.length}</span>
                </h2>
                <div className="stack">
                  {todayRest.map((i) => (
                    <ItemCard key={i.id} item={i} />
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            {waiting.length > 0 && (
              <>
                <h2 className="section-title">
                  ⏳ Waiting to hear from you <span className="count">{waiting.length}</span>
                </h2>
                <div className="list">
                  {waiting.slice(0, 8).map(({ c, lvl }) => {
                    const { body, subject } = contactMessage(c, settings.ownerName)
                    const checkIn = `${body}Just checking in to see if you had any questions about your project.`
                    return (
                      <div key={c.id} className="list-row waiting-row">
                        <button className="row grow" style={{ textAlign: 'left', width: '100%' }} onClick={() => openCustomer(c.id)}>
                          <Avatar name={c.name} level={lvl} />
                          <div className="grow">
                            <div style={{ fontWeight: 650 }} className="ellipsis">
                              {c.name}
                            </div>
                            <div className={`small lvl-${lvl}`} style={{ color: 'var(--c)', fontWeight: 600 }}>
                              {lastContactLabel(c, now)}
                            </div>
                          </div>
                        </button>
                        <div className="row-actions">
                          {c.phone && (
                            <a className="btn sm soft" href={telHref(c.phone)} onClick={() => contact(c, 'call')}>
                              <Icon name="phone" size={20} /> Call
                            </a>
                          )}
                          {c.phone && (
                            <a className="btn sm soft" href={smsHref(c.phone, checkIn)} onClick={() => contact(c, 'text')}>
                              <Icon name="text" size={20} /> Text
                            </a>
                          )}
                          {c.email && (
                            <a className="btn sm soft" href={mailHref(c.email, subject, checkIn)} onClick={() => contact(c, 'email')}>
                              <Icon name="mail" size={20} /> Email
                            </a>
                          )}
                          <button className="btn sm plain" onClick={() => open({ type: 'item', item: { kind: 'callback', customerId: c.id } })}>
                            <Icon name="bell" size={20} /> Remind
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <h2 className="section-title">
                  🟢 Coming up <span className="count">{upcoming.length}</span>
                </h2>
                <div className="stack">
                  {upcoming.map((i) => (
                    <ItemCard key={i.id} item={i} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
