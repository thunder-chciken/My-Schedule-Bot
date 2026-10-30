'use client'

import { useApp } from './AppContext'
import { Icon, KIND_ICON } from './ui'
import { countdown, itemLevel } from '@/lib/status'
import { fmtTime, fmtWhen } from '@/lib/dates'
import type { Customer, Item, ItemKind, LogType } from '@/lib/types'

export const telHref = (p?: string) => (p ? `tel:${p.replace(/[^\d+]/g, '')}` : undefined)
const isApple = () => typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/.test(navigator.userAgent)

/** Optional `body` pre-fills the message (iPhone wants "&body=", Android "?body="). */
export function smsHref(p?: string, body?: string) {
  if (!p) return undefined
  const n = p.replace(/[^\d+]/g, '')
  return body ? `sms:${n}${isApple() ? '&' : '?'}body=${encodeURIComponent(body)}` : `sms:${n}`
}

export function mailHref(e?: string, subject?: string, body?: string) {
  if (!e) return undefined
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean)
  return `mailto:${e}${q.length ? `?${q.join('&')}` : ''}`
}
export function mapHref(addr?: string) {
  if (!addr) return undefined
  return isApple()
    ? `https://maps.apple.com/?q=${encodeURIComponent(addr)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

/** Ready-made text/email to the customer. Appointments get a confirmation; anything else just the greeting. */
export function contactMessage(c: Customer, owner: string, kind?: ItemKind, at?: string, where?: string) {
  const hello = `Hi ${c.name.split(' ')[0]}, this is ${owner.trim() || 'Jason'} with Story Remodeling.`
  if (kind === 'appointment' && at) {
    const when = `${new Date(at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} at ${fmtTime(at)}`
    return {
      body: `${hello} Just confirming our appointment on ${when}${where ? ` at ${where}` : ''}. See you then!`,
      subject: `Appointment confirmation: ${when}`,
    }
  }
  return { body: `${hello} `, subject: 'Story Remodeling' }
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
  const msg = c ? contactMessage(c, settings.ownerName, item.kind, item.at, where) : undefined

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

      {/* Row 1: ways to reach the customer */}
      <div className="actions">
        {!c && (
          <button className="btn sm soft" onClick={() => open({ type: 'item', item, newCustomer: true })}>
            <Icon name="addperson" size={20} /> Customer
          </button>
        )}
        {c?.phone && (
          <a className="btn sm soft" href={telHref(c.phone)} onClick={() => contact(c, 'call')}>
            <Icon name="phone" size={20} /> Call
          </a>
        )}
        {c?.phone && (
          <a className="btn sm soft" href={smsHref(c.phone, msg?.body)} onClick={() => contact(c, 'text')}>
            <Icon name="text" size={20} /> Text
          </a>
        )}
        {c?.email && (
          <a className="btn sm soft" href={mailHref(c.email, msg?.subject, msg?.body)} onClick={() => contact(c, 'email')}>
            <Icon name="mail" size={20} /> Email
          </a>
        )}
        {where && item.kind === 'appointment' && (
          <a className="btn sm plain" href={mapHref(where)} target="_blank" rel="noreferrer">
            <Icon name="map" size={20} /> Map
          </a>
        )}
      </div>

      {/* Row 2: what to do with the reminder */}
      <div className="actions">
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
