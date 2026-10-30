'use client'

import { useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import { Field, Icon, Segmented, Sheet } from '../ui'
import { CustomerPicker, type NewPerson } from './CustomerPicker'
import { ALERT_OPTIONS, DEFAULT_ALERTS, dayKey, fmtWhen, fromLocal, quickTimes, timeValue, uid } from '@/lib/dates'
import { KINDS, type Item, type ItemKind } from '@/lib/types'

function autoTitle(kind: ItemKind, name?: string) {
  if (!name) return ''
  if (kind === 'callback') return `Call back ${name}`
  if (kind === 'email') return `Email ${name}`
  if (kind === 'appointment') return `Meet ${name}`
  return ''
}

const DURATIONS = [30, 60, 120, 180]

export function ItemSheet({ item }: { item?: Partial<Item> }) {
  const { close, saveItem, removeItem, saveCustomer, completeItem, customerById, toast, now } = useApp()
  const existing = Boolean(item?.id && item.createdAt)
  const startAt = item?.at ? new Date(item.at) : new Date(Math.ceil((Date.now() + 3600000) / 900000) * 900000)

  const [kind, setKind] = useState<ItemKind>(item?.kind ?? 'callback')
  const [customerId, setCustomerId] = useState<string | undefined>(item?.customerId)
  const [newPerson, setNewPerson] = useState<NewPerson | null>(null)
  const [title, setTitle] = useState(item?.title ?? '')
  const [titleTouched, setTitleTouched] = useState(Boolean(item?.title))
  const [date, setDate] = useState(dayKey(startAt))
  const [time, setTime] = useState(timeValue(startAt))
  const [pickedQuick, setPickedQuick] = useState<string | null>(null)
  const [duration, setDuration] = useState(item?.durationMin ?? 60)
  const [location, setLocation] = useState(item?.location ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [alerts, setAlerts] = useState<number[]>(item?.alerts ?? DEFAULT_ALERTS[item?.kind ?? 'callback'])
  const [saving, setSaving] = useState(false)

  const quick = useMemo(() => quickTimes(new Date()), [])
  const who = customerById(customerId)
  const personName = who?.name ?? newPerson?.name
  const shownTitle = titleTouched ? title : autoTitle(kind, personName) || title

  const changeKind = (k: ItemKind) => {
    setKind(k)
    if (!existing) setAlerts(DEFAULT_ALERTS[k])
    if (k === 'appointment' && !location && who?.address) setLocation(who.address)
  }

  const pickQuick = (label: string, d: Date) => {
    setPickedQuick(label)
    setDate(dayKey(d))
    setTime(timeValue(d))
  }

  const toggleAlert = (m: number) => setAlerts((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m].sort((x, y) => y - x)))

  const save = async () => {
    const finalTitle = shownTitle.trim()
    if (!finalTitle) return toast('Give it a name, or pick a customer')
    if (!date) return toast('Pick a day')
    setSaving(true)
    try {
      let cid = customerId
      if (!cid && newPerson?.name.trim()) {
        const stamp = new Date().toISOString()
        const c = await saveCustomer({
          id: uid(),
          name: newPerson.name.trim(),
          phone: newPerson.phone.trim() || undefined,
          stage: 'lead',
          createdAt: stamp,
          updatedAt: stamp,
          log: [],
        })
        cid = c.id
      }
      const stamp = new Date().toISOString()
      const at = fromLocal(date, time)
      await saveItem({
        id: item?.id ?? uid(),
        kind,
        title: finalTitle,
        customerId: cid,
        at,
        durationMin: kind === 'appointment' ? duration : undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        done: item?.done ?? false,
        doneAt: item?.doneAt,
        createdAt: item?.createdAt ?? stamp,
        updatedAt: stamp,
        alerts,
      })
      toast(`Saved · ${fmtWhen(at, now)}`)
      close()
    } catch {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!item?.id || !confirm('Delete this reminder?')) return
    await removeItem(item.id)
    toast('Deleted')
    close()
  }

  return (
    <Sheet title={existing ? 'Edit' : KINDS.find((k) => k.id === kind)?.label ?? 'New'} onClose={close}>
      <div className="stack" style={{ gap: 18 }}>
        <Segmented<ItemKind> value={kind} onChange={changeKind} options={KINDS.map((k) => ({ id: k.id, label: k.label }))} />

        <CustomerPicker value={customerId} onChange={setCustomerId} newPerson={newPerson} onNewPerson={setNewPerson} />

        <Field label="What">
          <input
            className="input"
            value={shownTitle}
            placeholder={kind === 'task' ? 'e.g. Order tile for Smith job' : 'e.g. Call back about kitchen quote'}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleTouched(true)
            }}
          />
        </Field>

        <Field label="When">
          <div className="chips">
            {quick.map((q) => (
              <button key={q.label} type="button" className={`chip ${pickedQuick === q.label ? 'on' : ''}`} onClick={() => pickQuick(q.label, q.date)}>
                {q.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="row">
          <input
            className="input grow"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setPickedQuick(null)
            }}
            aria-label="Date"
          />
          <input
            className="input"
            style={{ width: '42%' }}
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              setPickedQuick(null)
            }}
            aria-label="Time"
          />
        </div>

        {kind === 'appointment' && (
          <>
            <Field label="How long">
              <div className="chips">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" className={`chip ${duration === d ? 'on' : ''}`} onClick={() => setDuration(d)}>
                    {d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? 's' : ''}`}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Where">
              <input className="input" value={location} placeholder="Job site address" onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </>
        )}

        <Field label="Alert me">
          <div className="chips">
            {ALERT_OPTIONS.map((o) => (
              <button key={o.min} type="button" className={`chip ${alerts.includes(o.min) ? 'on' : ''}`} onClick={() => toggleAlert(o.min)}>
                {alerts.includes(o.min) ? '✓ ' : ''}
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea className="input" value={notes} placeholder="Anything to remember…" onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <button className="btn primary full xl" onClick={save} disabled={saving}>
          <Icon name="check" stroke={2.6} /> {saving ? 'Saving…' : 'Save'}
        </button>

        {existing && item && (
          <div className="grid-2">
            <button
              className="btn green"
              onClick={() => {
                completeItem(item as Item)
                close()
              }}
            >
              <Icon name="check" /> {item.done ? 'Mark Not Done' : 'Mark Done'}
            </button>
            <button className="btn danger" onClick={del}>
              <Icon name="trash" /> Delete
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
