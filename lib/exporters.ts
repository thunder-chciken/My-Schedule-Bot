'use client'

import type { AppData, Customer } from './types'

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// vCard text escaping: backslash, newline, comma, semicolon
const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m)
const fileName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim() || 'contact'

function vcard(c: Customer) {
  const [first, ...rest] = c.name.trim().split(/\s+/)
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(rest.join(' '))};${esc(first)};;;`,
    `FN:${esc(c.name)}`,
    c.phone && `TEL;TYPE=CELL:${c.phone}`,
    c.email && `EMAIL:${c.email}`,
    c.address && `ADR;TYPE=HOME:;;${esc(c.address)};;;;`,
    `NOTE:${esc(['Customer of Story Remodeling', c.notes].filter(Boolean).join('\n'))}`,
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n')
}

/** Opens the "Add to Contacts" screen on iPhone/iPad. */
export const downloadVCard = (c: Customer) => save(`${fileName(c.name)}.vcf`, vcard(c), 'text/vcard')

export const downloadAllVCards = (list: Customer[]) =>
  save('schedule-bot-contacts.vcf', list.map(vcard).join('\r\n'), 'text/vcard')

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function downloadCsv(list: Customer[]) {
  const rows = [
    ['Name', 'Phone', 'Email', 'Address', 'Stage', 'Last Contact', 'Notes'],
    ...list.map((c) => [c.name, c.phone, c.email, c.address, c.stage, c.lastContactAt ?? '', c.notes]),
  ]
  save(`customers-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => r.map(cell).join(',')).join('\n'), 'text/csv')
}

export const downloadBackup = (d: AppData) =>
  save(`schedule-bot-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2), 'application/json')
