'use client'

import { useApp } from './AppContext'
import { AlertsBanner } from './AlertsBanner'
import { ItemCard, telHref, useContactAction } from './ItemCard'
import { Avatar, Empty, Icon } from './ui'
import { itemLevel, lastContactLabel, staleLevel } from '@/lib/status'
import { dayKey, greeting } from '@/lib/dates'
import type { Item } from '@/lib/types'

const byTime = (a: Item, b: Item) => +new Date(a.at) - +new Date(b.at)

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
  const openItems = items.filter((i) => !i.done).sort(byTime)
  const today = dayKey(now)

  const urgent = openItems.filter((i) => itemLevel(i, now, settings) === 'red')
  const todayRest = openItems.filter((i) => !urgent.includes(i) && dayKey(i.at) === today)
  const upcoming = openItems.filter((i) => !urgent.includes(i) && !todayRest.includes(i)).slice(0, 12)
  const doneToday = items.filter((i) => i.done && i.doneAt && dayKey(i.doneAt) === today).length
  const overdue = openItems.filter((i) => new Date(i.at).getTime() < now).length
  const waiting = customers
    .filter((c) => !openItems.some((i) => i.customerId === c.id))
    .map((c) => ({ c, lvl: staleLevel(c, now, settings) }))
    .filter((x) => x.lvl === 'red' || x.lvl === 'orange')
    .sort((a, b) => +new Date(a.c.lastContactAt ?? a.c.createdAt) - +new Date(b.c.lastContactAt ?? b.c.createdAt))

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
        <div className="meter lvl-red">
          <b>{overdue}</b>
          <span>Overdue</span>
        </div>
        <div className="meter lvl-orange">
          <b>{urgent.length - overdue + todayRest.length}</b>
          <span>Due today</span>
        </div>
        <div className="meter lvl-green">
          <b>{openItems.length - urgent.length - todayRest.length}</b>
          <span>Coming up</span>
        </div>
      </div>

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
                  {waiting.slice(0, 8).map(({ c, lvl }) => (
                    <div key={c.id} className="list-row">
                      <button className="row grow" style={{ textAlign: 'left' }} onClick={() => openCustomer(c.id)}>
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
                      {c.phone ? (
                        <a className="btn sm soft" href={telHref(c.phone)} onClick={() => contact(c, 'call')}>
                          <Icon name="phone" size={20} /> Call
                        </a>
                      ) : (
                        <button className="btn sm soft" onClick={() => open({ type: 'item', item: { kind: 'callback', customerId: c.id } })}>
                          <Icon name="bell" size={20} /> Remind
                        </button>
                      )}
                    </div>
                  ))}
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
