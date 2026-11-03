'use client'

import { useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import { Field, Icon, Sheet, Toggle } from '../ui'
import { DEFAULT_ALERTS, fmtWhen, quickTimes, uid } from '@/lib/dates'
import type { Customer, Item, LogType } from '@/lib/types'

/** How each contact type asks "did it happen?" */
const OUTCOME: Partial<Record<LogType, { ask: string; yes: string; no: string; noLog: string }>> = {
  call: { ask: 'Did you reach', yes: 'Talked to them', no: 'No answer', noLog: 'No answer' },
  text: { ask: 'Did you text', yes: 'Sent it', no: "Didn't send", noLog: "Didn't send" },
  email: { ask: 'Did you email', yes: 'Sent it', no: "Didn't send", noLog: "Didn't send" },
}

/**
 * Shown right after he taps Call / Text / Email. Nothing counts as contact until he says it happened:
 * "No answer" keeps the callback open and moves it to the next try, so a missed call can't get lost.
 */
export function FollowUpSheet({ customer, action }: { customer: Customer; action: LogType }) {
  const { close, items, saveItem, logContact, customerById, open, toast, now } = useApp()
  const o = OUTCOME[action] ?? OUTCOME.call!
  const first = customer.name.split(' ')[0]
  const openOnes = items.filter((i) => i.customerId === customer.id && !i.done && i.kind !== 'appointment').sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const [markDone, setMarkDone] = useState(true)
  const [note, setNote] = useState('')
  const quick = useMemo(() => quickTimes(new Date()).filter((q) => ['In 1 hour', 'Tomorrow 9 AM', 'In 3 days', 'Next Monday', 'In 2 weeks'].includes(q.label)), [])
  const [pick, setPick] = useState<string>('none')
  const kind = action === 'email' ? 'email' : 'callback'

  const newFollowUp = async (at: Date) => {
    const stamp = new Date().toISOString()
    await saveItem({
      id: uid(),
      kind,
      title: `${kind === 'email' ? 'Email' : 'Call back'} ${customer.name}`,
      customerId: customer.id,
      at: at.toISOString(),
      done: false,
      createdAt: stamp,
      updatedAt: stamp,
      alerts: DEFAULT_ALERTS.callback,
    })
  }

  const reached = async () => {
    await logContact(customerById(customer.id) ?? customer, action, note.trim() || undefined)
    // Mark handled directly (completeItem would log a second "Called" entry).
    const doneAt = new Date().toISOString()
    if (markDone) for (const i of openOnes) await saveItem({ ...i, done: true, doneAt, updatedAt: doneAt })
    if (pick === 'custom') return open({ type: 'item', item: { kind, customerId: customer.id } })
    const q = quick.find((x) => x.label === pick)
    if (q) {
      await newFollowUp(q.date)
      toast(`Follow-up set · ${fmtWhen(q.date.toISOString(), now)}`)
    } else toast('Logged ✓')
    close()
  }

  const missed = async () => {
    const isCall = action === 'call'
    // A missed call is worth remembering in their history; an unsent text isn't.
    if (isCall) await logContact(customerById(customer.id) ?? customer, action, note.trim() ? `${o.noLog}: ${note.trim()}` : o.noLog, true)
    const next = openOnes[0]
    if (pick === 'custom') return open({ type: 'item', item: next ?? { kind, customerId: customer.id } })
    // Unanswered calls always get a next try (tomorrow morning unless he picked a time).
    const q = quick.find((x) => x.label === pick) ?? (isCall ? quick.find((x) => x.label === 'Tomorrow 9 AM') : undefined)
    if (q) {
      if (next) await saveItem({ ...next, at: q.date.toISOString(), updatedAt: new Date().toISOString() })
      else await newFollowUp(q.date)
      toast(`Try again ${fmtWhen(q.date.toISOString(), now)}`)
    } else toast(openOnes.length ? 'Reminder stays open' : 'Nothing logged')
    close()
  }

  return (
    <Sheet title={`${o.ask} ${first}?`} onClose={close}>
      <div className="stack" style={{ gap: 18 }}>
        <Field label="How did it go? (optional)">
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Left voicemail, wants quote by Friday…" />
        </Field>
        <Field group label="Follow up again?">
          <div className="chips">
            <button className={`chip ${pick === 'none' ? 'on' : ''}`} onClick={() => setPick('none')}>
              {action === 'call' ? 'Not unless no answer' : 'No'}
            </button>
            {quick.map((q) => (
              <button key={q.label} className={`chip ${pick === q.label ? 'on' : ''}`} onClick={() => setPick(q.label)}>
                {q.label}
              </button>
            ))}
            <button className={`chip ${pick === 'custom' ? 'on' : ''}`} onClick={() => setPick('custom')}>
              Pick a time…
            </button>
          </div>
          {action === 'call' && pick === 'none' && <div className="small muted" style={{ marginTop: 8 }}>No answer? We&apos;ll remind you again tomorrow at 9 AM.</div>}
        </Field>
        {openOnes.length > 0 && (
          <div className="card row pad">
            <div className="grow">
              <b>Mark done if you {action === 'call' ? 'talked' : 'sent it'}</b>
              <div className="small muted">{openOnes.map((i) => i.title).join(', ')}</div>
            </div>
            <Toggle on={markDone} onChange={setMarkDone} label="Mark done" />
          </div>
        )}
        <div className="grid-2">
          <button className="btn plain xl" onClick={missed}>
            {o.no}
          </button>
          <button className="btn primary xl" onClick={reached}>
            <Icon name="check" stroke={2.6} /> {o.yes}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function SnoozeSheet({ item }: { item: Item }) {
  const { close, saveItem, open, toast, now } = useApp()
  const quick = useMemo(() => quickTimes(new Date()), [])
  const move = async (d: Date) => {
    await saveItem({ ...item, at: d.toISOString(), updatedAt: new Date().toISOString() })
    toast(`Moved to ${fmtWhen(d.toISOString(), now)}`)
    close()
  }
  return (
    <Sheet title="Remind me later" onClose={close}>
      <p className="muted" style={{ marginTop: -6 }}>
        {item.title}
      </p>
      <div className="stack" style={{ gap: 10 }}>
        {quick.map((q) => (
          <button key={q.label} className="menu-opt" onClick={() => move(q.date)}>
            <Icon name="clock" size={26} />
            <div className="grow">
              {q.label}
              <small>{fmtWhen(q.date.toISOString(), now)}</small>
            </div>
          </button>
        ))}
        <button className="btn soft full" onClick={() => open({ type: 'item', item })}>
          Pick a day & time…
        </button>
      </div>
    </Sheet>
  )
}

export function NoteSheet({ customer }: { customer: Customer }) {
  const { close, logContact, toast } = useApp()
  const [text, setText] = useState('')
  const [type, setType] = useState<LogType>('note')
  const save = async () => {
    if (!text.trim() && type === 'note') return toast('Type a note first')
    await logContact(customer, type, text.trim() || undefined)
    toast('Added to history')
    close()
  }
  return (
    <Sheet title={`Note · ${customer.name}`} onClose={close}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="chips">
          {(['note', 'call', 'text', 'email', 'visit'] as LogType[]).map((t) => (
            <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
              {{ note: '📝 Note', call: '📞 I called', text: '💬 I texted', email: '✉️ I emailed', visit: '🏠 I visited' }[t]}
            </button>
          ))}
        </div>
        <textarea className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened?" style={{ minHeight: 140 }} />
        <button className="btn primary full xl" onClick={save}>
          <Icon name="check" stroke={2.6} /> Save
        </button>
      </div>
    </Sheet>
  )
}

export function AddMenu() {
  const { close, open } = useApp()
  const opts = [
    { icon: 'phone', label: 'Call Back Reminder', sub: 'Never forget to call someone back', bg: 'linear-gradient(160deg,#36A3FF,#0A72F5)', go: () => open({ type: 'item', item: { kind: 'callback' } }) },
    { icon: 'calendar', label: 'Appointment', sub: 'Estimate, walkthrough, job start', bg: 'linear-gradient(160deg,#7B8CFF,#4F5BEA)', go: () => open({ type: 'item', item: { kind: 'appointment' } }) },
    { icon: 'addperson', label: 'New Customer', sub: 'Save their name & number', bg: 'linear-gradient(160deg,#4AD6C8,#13A8B5)', go: () => open({ type: 'customer', remind: true }) },
    { icon: 'mail', label: 'Email Back', sub: 'Reply to someone later', bg: 'linear-gradient(160deg,#FFB547,#FF8A00)', go: () => open({ type: 'item', item: { kind: 'email' } }) },
    { icon: 'task', label: 'To-Do', sub: 'Order materials, send invoice…', bg: 'linear-gradient(160deg,#5BD87A,#22B455)', go: () => open({ type: 'item', item: { kind: 'task' } }) },
  ]
  return (
    <Sheet title="Add" onClose={close}>
      <div className="stack" style={{ gap: 10 }}>
        {opts.map((o) => (
          <button key={o.label} className="menu-opt" onClick={o.go}>
            <span className="q-icon" style={{ background: o.bg, width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Icon name={o.icon} size={28} />
            </span>
            <div className="grow">
              {o.label}
              <small>{o.sub}</small>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
