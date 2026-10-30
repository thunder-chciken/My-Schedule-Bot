'use client'

import { useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import { Field, Icon, Sheet, Toggle } from '../ui'
import { DEFAULT_ALERTS, fmtWhen, quickTimes, uid } from '@/lib/dates'
import type { Customer, Item, LogType } from '@/lib/types'

const PAST: Record<LogType, string> = { call: 'Called', text: 'Texted', email: 'Emailed', note: 'Note for', visit: 'Visited' }

/** Shown right after he taps Call / Text / Email so nothing slips. */
export function FollowUpSheet({ customer, action }: { customer: Customer; action: LogType }) {
  const { close, items, saveItem, saveCustomer, open, toast, now } = useApp()
  const openOnes = items.filter((i) => i.customerId === customer.id && !i.done && i.kind !== 'appointment')
  const [markDone, setMarkDone] = useState(true)
  const [note, setNote] = useState('')
  const quick = useMemo(() => quickTimes(new Date()).filter((q) => ['In 1 hour', 'Tomorrow 9 AM', 'In 3 days', 'Next Monday', 'In 2 weeks'].includes(q.label)), [])
  const [pick, setPick] = useState<string>('none')

  const finish = async (custom?: boolean) => {
    if (note.trim() && customer.log?.[0]) {
      const [first, ...rest] = customer.log
      saveCustomer({ ...customer, log: [{ ...first, text: note.trim() }, ...rest] }).catch(() => {})
    }
    // Mark handled directly (completeItem would log a second "Called" entry).
    const doneAt = new Date().toISOString()
    if (markDone) for (const i of openOnes) await saveItem({ ...i, done: true, doneAt, updatedAt: doneAt })
    const q = quick.find((x) => x.label === pick)
    if (custom) {
      open({ type: 'item', item: { kind: 'callback', customerId: customer.id } })
      return
    }
    if (q) {
      const stamp = new Date().toISOString()
      await saveItem({
        id: uid(),
        kind: action === 'email' ? 'email' : 'callback',
        title: `${action === 'email' ? 'Email' : 'Call back'} ${customer.name}`,
        customerId: customer.id,
        at: q.date.toISOString(),
        done: false,
        createdAt: stamp,
        updatedAt: stamp,
        alerts: DEFAULT_ALERTS.callback,
      })
      toast(`Follow-up set · ${fmtWhen(q.date.toISOString(), now)}`)
    } else toast('Logged ✓')
    close()
  }

  return (
    <Sheet title={`${PAST[action]} ${customer.name.split(' ')[0]}`} onClose={close}>
      <div className="stack" style={{ gap: 18 }}>
        {openOnes.length > 0 && (
          <div className="card row pad">
            <div className="grow">
              <b>Mark as handled</b>
              <div className="small muted">{openOnes.map((i) => i.title).join(', ')}</div>
            </div>
            <Toggle on={markDone} onChange={setMarkDone} label="Mark handled" />
          </div>
        )}
        <Field label="How did it go? (optional)">
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Left voicemail, wants quote by Friday…" />
        </Field>
        <Field label="Follow up again?">
          <div className="chips">
            <button className={`chip ${pick === 'none' ? 'on' : ''}`} onClick={() => setPick('none')}>
              No, all set
            </button>
            {quick.map((q) => (
              <button key={q.label} className={`chip ${pick === q.label ? 'on' : ''}`} onClick={() => setPick(q.label)}>
                {q.label}
              </button>
            ))}
            <button className="chip" onClick={() => finish(true)}>
              Pick a time…
            </button>
          </div>
        </Field>
        <button className="btn primary full xl" onClick={() => finish()}>
          <Icon name="check" stroke={2.6} /> Done
        </button>
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
