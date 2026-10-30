'use client'

import { useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import { Field, Icon, Segmented, Sheet } from '../ui'
import { DEFAULT_ALERTS, fmtWhen, quickTimes, uid } from '@/lib/dates'
import { STAGES, type Customer, type Stage } from '@/lib/types'

export function CustomerSheet({ customer, remind }: { customer?: Customer; remind?: boolean }) {
  const { close, saveCustomer, saveItem, customers, openCustomer, toast, now } = useApp()
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [stage, setStage] = useState<Stage>(customer?.stage ?? 'lead')
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const quick = useMemo(() => quickTimes(new Date()).filter((q) => ['In 1 hour', 'Tomorrow 9 AM', 'In 3 days', 'Next Monday'].includes(q.label)), [])
  const [follow, setFollow] = useState<string>(remind ? 'Tomorrow 9 AM' : 'none')
  const [saving, setSaving] = useState(false)

  const digits = phone.replace(/\D/g, '')
  const dupe = !customer && digits.length >= 7 ? customers.find((c) => c.phone?.replace(/\D/g, '').endsWith(digits.slice(-7))) : undefined

  const save = async () => {
    if (!name.trim()) return toast('Add a name first')
    setSaving(true)
    const stamp = new Date().toISOString()
    try {
      const c = await saveCustomer({
        id: customer?.id ?? uid(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        stage,
        createdAt: customer?.createdAt ?? stamp,
        updatedAt: stamp,
        lastContactAt: customer?.lastContactAt ?? (customer ? undefined : stamp),
        log: customer?.log ?? [],
      })
      const pick = quick.find((q) => q.label === follow)
      if (pick) {
        await saveItem({
          id: uid(),
          kind: 'callback',
          title: `Call back ${c.name}`,
          customerId: c.id,
          at: pick.date.toISOString(),
          done: false,
          createdAt: stamp,
          updatedAt: stamp,
          alerts: DEFAULT_ALERTS.callback,
        })
        toast(`Saved · callback ${fmtWhen(pick.date.toISOString(), now)}`)
      } else toast(customer ? 'Saved' : `${c.name} added`)
      close()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Sheet title={customer ? 'Edit Customer' : 'New Customer'} onClose={close}>
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" />
        </Field>
        <Field label="Phone">
          <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
        </Field>
        {dupe && (
          <button className="card pad row" style={{ background: 'var(--orange-soft)', textAlign: 'left' }} onClick={() => openCustomer(dupe.id)}>
            <Icon name="person" />
            <div className="grow">
              <b>{dupe.name}</b> already has this number. Tap to open them instead.
            </div>
          </button>
        )}
        <Field label="Email">
          <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
        </Field>
        <Field label="Address">
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Job site address" />
        </Field>
        <Field label="Stage">
          <Segmented<Stage> value={stage} onChange={setStage} options={STAGES.map((s) => ({ id: s.id, label: s.label }))} />
        </Field>
        <Field label="Notes">
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What do they want done? Budget? Gate code?" />
        </Field>
        {!customer && (
          <Field label="Remind me to call them back">
            <div className="chips">
              <button className={`chip ${follow === 'none' ? 'on' : ''}`} onClick={() => setFollow('none')}>
                No reminder
              </button>
              {quick.map((q) => (
                <button key={q.label} className={`chip ${follow === q.label ? 'on' : ''}`} onClick={() => setFollow(q.label)}>
                  {q.label}
                </button>
              ))}
            </div>
          </Field>
        )}
        <button className="btn primary full xl" onClick={save} disabled={saving}>
          <Icon name="check" stroke={2.6} /> {saving ? 'Saving…' : customer ? 'Save' : 'Add Customer'}
        </button>
      </div>
    </Sheet>
  )
}
