'use client'

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function deviceName() {
  const ua = navigator.userAgent
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export type PushState = 'unsupported' | 'needs-install' | 'off' | 'on' | 'blocked'

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Must be called from a button tap (iPhone requires it). */
export async function enablePush(vapidKey: string) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications were not allowed')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) })
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), device: deviceName() }),
  })
  if (!res.ok) throw new Error('Could not save this device')
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await fetch('/api/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}

export async function currentSub() {
  if (typeof window === 'undefined' || !pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

const sameKey = (a: ArrayBuffer, vapidKey: string) => {
  const x = new Uint8Array(a)
  const y = keyBytes(vapidKey)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/**
 * Quiet self-repair, run on every launch. iPhones can drop a push subscription after an update
 * while the permission stays "allowed", and nothing tells the app. If alerts are allowed but the
 * subscription is gone (or made with old keys), make a new one; either way re-register with the
 * server, which is harmless when nothing changed. Returns true when it actually fixed something.
 */
export async function healPush(vapidKey: string) {
  if (!pushSupported() || Notification.permission !== 'granted' || (isIOS() && !isStandalone())) return false
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  const key = sub?.options?.applicationServerKey
  if (sub && key && !sameKey(key, vapidKey)) {
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  let renewed = false
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) })
    renewed = true
  }
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), device: deviceName() }),
  })
  const body = (await res.json().catch(() => ({}))) as { known?: boolean }
  return renewed || body.known === false
}

/** Test one device (`endpoint`) or every device. */
export async function testPush(endpoint?: string) {
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
  return (await res.json()) as { sent: number; failed: number }
}

export async function confirmPush(endpoint: string) {
  const res = await fetch('/api/push/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
  if (!res.ok) throw new Error('Could not save that')
}

export type DeviceInfo = { endpoint: string; device?: string; createdAt: string; lastSentAt?: string; lastAckAt?: string; confirmedAt?: string }

export async function listDevices() {
  const res = await fetch('/api/push', { cache: 'no-store' })
  if (!res.ok) return []
  return ((await res.json()) as { devices: DeviceInfo[] }).devices
}

/**
 * How alerts are doing on THIS device. "broken" = we sent one 15+ minutes ago and it never
 * reported back; "untested" = turned on but he hasn't confirmed seeing a test yet.
 */
export type AlertHealth = Exclude<PushState, 'on'> | 'untested' | 'broken' | 'ok'

export function alertHealth(state: PushState, d: DeviceInfo | undefined, now = Date.now()): AlertHealth {
  if (state !== 'on') return state
  if (!d) return 'off'
  const sent = d.lastSentAt ? Date.parse(d.lastSentAt) : 0
  const ack = d.lastAckAt ? Date.parse(d.lastAckAt) : 0
  if (sent && ack < sent && now - sent > 15 * 60_000) return 'broken'
  if (!d.confirmedAt) return 'untested'
  return 'ok'
}

/** Fired after anything that changes alert setup, so every screen re-checks. */
export const ALERTS_CHANGED = 'schedule-bot:alerts-changed'
export const alertsChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED))
