'use client'

import { useEffect, type ReactNode } from 'react'
import type { Level } from '@/lib/status'

const PATHS: Record<string, ReactNode> = {
  today: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M16.5 14.6c2.6.1 4.4 1.8 5 4.6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.3M12 19.2v2.3M4.3 4.3l1.7 1.7M18 18l1.7 1.7M2.5 12h2.3M19.2 12h2.3M4.3 19.7 6 18M18 6l1.7-1.7" />
      <circle cx="12" cy="12" r="7" />
    </>
  ),
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  phone: (
    <path d="M6.6 3.5h2.6l1.5 4-2 1.4a11.5 11.5 0 0 0 6.4 6.4l1.4-2 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  text: (
    <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9l-5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5Z" />
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 6.5 8.5 7 8.5-7" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  right: <path d="m9 5 7 7-7 7" />,
  up: <path d="m5 15 7-7 7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  left: <path d="m15 5-7 7 7 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6 6.5l1 13.5h10l1-13.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  pencil: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 7.5l3 3" />,
  download: <path d="M12 3.5v12M7 11l5 5 5-5M4.5 20.5h15" />,
  upload: <path d="M12 16V4M7 8.5l5-5 5 5M4.5 20.5h15" />,
  note: (
    <>
      <path d="M6 3.5h9l4 4v13H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  task: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  snooze: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M9.5 10.5h5l-5 5h5M4 4.5 6.5 2.5M20 4.5l-2.5-2M12 2.5v1" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 21h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 11h-1" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5" />
    </>
  ),
  addperson: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2.5 21c.8-4.2 3.8-6.5 7.5-6.5 2 0 3.8.7 5.2 2M18.5 13.5v7M15 17h7" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5" />,
}

export function Icon({ name, size = 24, stroke = 2 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}

export const KIND_ICON: Record<string, string> = {
  appointment: 'calendar',
  callback: 'phone',
  email: 'mail',
  task: 'task',
}

export function Sheet({ title, onClose, children, right }: { title: string; onClose: () => void; children: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          {right}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} stroke={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** `group` renders a div instead of a label, for sections that hold buttons (a label would forward taps to them). */
export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="field">
      <span>{label}</span>
      {children}
    </Tag>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  scroll,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  scroll?: boolean
}) {
  return (
    <div className={`seg ${scroll ? 'scroll' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format: (v: number) => string }) {
  return (
    <div className="stepper">
      <button className="icon-btn" aria-label="Less" onClick={() => onChange(Math.max(min, value - step))}>
        <b style={{ fontSize: 22, minWidth: 0 }}>−</b>
      </button>
      <b>{format(value)}</b>
      <button className="icon-btn" aria-label="More" onClick={() => onChange(Math.min(max, value + step))}>
        <b style={{ fontSize: 22, minWidth: 0 }}>+</b>
      </button>
    </div>
  )
}

export function Avatar({ name, level, lg }: { name: string; level?: Level; lg?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <div className={`avatar ${lg ? 'lg' : ''}`}>
      {initials || '?'}
      {level && level !== 'none' && level !== 'done' && <i className={`status-dot lvl-${level}`} />}
    </div>
  )
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty card">
      <img src="/icons/192" alt="" />
      <h3>{title}</h3>
      {text && <p style={{ margin: '0 0 14px' }}>{text}</p>}
      {children}
    </div>
  )
}
