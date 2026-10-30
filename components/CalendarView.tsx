'use client'

import { useMemo, useState } from 'react'
import { useApp } from './AppContext'
import { ItemCard } from './ItemCard'
import { Icon } from './ui'
import { itemLevel } from '@/lib/status'
import { dayKey, fromLocal } from '@/lib/dates'
import type { Item } from '@/lib/types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarView() {
  const { items, now, settings, open } = useApp()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => dayKey(Date.now()))

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of items) {
      const k = dayKey(i.at)
      m.set(k, [...(m.get(k) ?? []), i])
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.at) - +new Date(b.at))
    return m
  }, [items])

  const cells = useMemo(() => {
    const start = new Date(month)
    start.setDate(1 - start.getDay())
    return Array.from({ length: 42 }, (_, n) => {
      const d = new Date(start)
      d.setDate(start.getDate() + n)
      return d
    })
  }, [month])

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const goToday = () => {
    const d = new Date()
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelected(dayKey(d))
  }

  const dayItems = byDay.get(selected) ?? []
  const selDate = new Date(`${selected}T12:00`)
  const todayKey = dayKey(now)

  return (
    <>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <h1 className="large-title grow">Calendar</h1>
        <button className="btn sm soft" onClick={goToday}>
          Today
        </button>
      </div>
      <p className="subtitle">Tap a day to see what&apos;s planned.</p>

      <div className="cal-layout">
        <div className="card">
          <div className="cal-head">
            <h3>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3>
            <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
              <Icon name="left" />
            </button>
            <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
              <Icon name="right" />
            </button>
          </div>
          <div className="cal-grid">
            {DOW.map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const k = dayKey(d)
              const list = byDay.get(k) ?? []
              const open_ = list.filter((i) => !i.done)
              return (
                <button
                  key={k}
                  className={`cal-day ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${k === todayKey ? 'today' : ''} ${k === selected ? 'sel' : ''}`}
                  onClick={() => setSelected(k)}
                  aria-label={`${d.toDateString()}, ${list.length} items`}
                >
                  <span>{d.getDate()}</span>
                  <div className="cal-dots">
                    {open_.slice(0, 3).map((i) => (
                      <i key={i.id} className={`lvl-${itemLevel(i, now, settings)}`} />
                    ))}
                    {open_.length === 0 && list.length > 0 && <i className="lvl-done" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="row" style={{ margin: '4px 4px 12px' }}>
            <h2 className="section-title grow" style={{ margin: 0 }}>
              {selected === todayKey ? 'Today' : selDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <button
              className="btn sm primary"
              onClick={() => open({ type: 'item', item: { kind: 'appointment', at: fromLocal(selected, '09:00') } })}
            >
              <Icon name="plus" size={20} stroke={2.6} /> Add
            </button>
          </div>
          {dayItems.length ? (
            <div className="stack">
              {dayItems.map((i) => (
                <ItemCard key={i.id} item={i} />
              ))}
            </div>
          ) : (
            <div className="card pad muted" style={{ textAlign: 'center', padding: 28 }}>
              Nothing planned this day.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
