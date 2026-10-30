'use client'

import { useApp } from './AppContext'
import { Icon, KIND_ICON } from './ui'
import { countdown, itemLevel } from '@/lib/status'
import { fmtWhen } from '@/lib/dates'
import type { Customer, Item, LogType } from '@/lib/types'

export const telHref = (p?: string) => (p ? `tel:${p.replace(/[^\d+]/g, '')}` : undefined)
export const smsHref = (p?: string) => (p ? `sms:${p.replace(/[^\d+]/g, '')}` : undefined)
export const mailHref = (e?: string) => (e ? `mailto:${e}` : undefined)
export function mapHref(addr?: string) {
  if (!addr) return undefined
  const apple = typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?q=${encodeURIComponent(addr)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

/** Tap to call/text/email: logs it and asks "follow up again?" right after. */
export function useContactAction() {
  const { logContact, open } = useApp()
  return (c: Customer, type: LogType) => {
    setTimeout(async () => {
      const next = await logContact(c, type)
      open({ type: 'followup', customer: next, action: type })
    }, 400)
  }
}

export function ItemCard({ item }: { item: Item }) {
  const { now, settings, customerById, completeItem, open } = useApp()
  const contact = useContactAction()
  const c = customerById(item.customerId)
  const lvl = itemLevel(item, now, settings)
  const late = !item.done && new Date(item.at).getTime() < now
  const where = item.location || (item.kind === 'appointment' ? c?.address : undefined)

  return (
    <div className={`card rcard lvl-${lvl} ${item.done ? 'is-done' : ''}`}>
      <button className="row" style={{ width: '100%', textAlign: 'left', alignItems: 'flex-start' }} onClick={() => open({ type: 'item', item })}>
        <div className="kind">
          <Icon name={KIND_ICON[item.kind]} size={24} />
        </div>
        <div className="grow">
          <div className="title">{item.title}</div>
          <div className="meta ellipsis">
            {[c && !item.title.includes(c.name) ? c.name : null, fmtWhen(item.at, now)].filter(Boolean).join(' · ')}
          </div>
          {where && <div className="meta ellipsis">📍 {where}</div>}
          {!item.done && (
            <div className="when">
              <span className={`pill ${late ? 'late' : ''}`}>
                <i className="bulb" />
                {countdown(item.at, now)}
              </span>
            </div>
          )}
        </div>
      </button>

      <div className="actions">
        {!c && (
          <button className="btn sm soft" onClick={() => open({ type: 'item', item, newCustomer: true })}>
            <Icon name="addperson" size={20} /> Customer
          </button>
        )}
        {c?.phone && item.kind !== 'email' && (
          <a className="btn sm soft" href={telHref(c.phone)} onClick={() => contact(c, 'call')}>
            <Icon name="phone" size={20} /> Call
          </a>
        )}
        {c?.email && item.kind === 'email' && (
          <a className="btn sm soft" href={mailHref(c.email)} onClick={() => contact(c, 'email')}>
            <Icon name="mail" size={20} /> Email
          </a>
        )}
        {where && item.kind === 'appointment' && (
          <a className="btn sm plain" href={mapHref(where)} target="_blank" rel="noreferrer">
            <Icon name="map" size={20} /> Map
          </a>
        )}
        {!item.done && (
          <button className="btn sm plain" onClick={() => open({ type: 'snooze', item })}>
            <Icon name="snooze" size={20} /> Later
          </button>
        )}
        <button className="btn sm green" onClick={() => completeItem(item)}>
          <Icon name="check" size={20} stroke={2.6} /> {item.done ? 'Undo' : 'Done'}
        </button>
      </div>
    </div>
  )
}
