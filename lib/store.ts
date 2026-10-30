import 'server-only'
import { Redis } from '@upstash/redis'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_SETTINGS, type AppData, type Customer, type Item, type PushSub, type Settings } from './types'

/**
 * Two backends:
 *  - Upstash Redis (production on Vercel; env vars added by the Vercel Upstash integration)
 *  - a JSON file in .data/ (local development only)
 */
export interface Store {
  kind: 'redis' | 'file'
  getAll(): Promise<AppData>
  putCustomer(c: Customer): Promise<void>
  deleteCustomer(id: string): Promise<void>
  putItem(i: Item): Promise<void>
  deleteItem(id: string): Promise<void>
  putSettings(s: Settings): Promise<void>
  listSubs(): Promise<PushSub[]>
  putSub(s: PushSub): Promise<void>
  deleteSub(endpoint: string): Promise<void>
  /** Returns true only the first time a key is claimed (used so an alert is sent once). */
  claim(key: string, ttlSeconds: number): Promise<boolean>
  incr(key: string, ttlSeconds: number): Promise<number>
  del(key: string): Promise<void>
}

export class StorageNotConfigured extends Error {
  constructor() {
    super('Storage is not connected. In Vercel, open Storage and connect Upstash Redis to this project.')
  }
}

const P = 'sb:'

function redisStore(url: string, token: string): Store {
  const r = new Redis({ url, token })
  const vals = <T>(h: Record<string, T> | null) => (h ? Object.values(h) : [])
  return {
    kind: 'redis',
    async getAll() {
      const [c, i, s] = await Promise.all([
        r.hgetall<Record<string, Customer>>(P + 'customers'),
        r.hgetall<Record<string, Item>>(P + 'items'),
        r.get<Settings>(P + 'settings'),
      ])
      return { customers: vals(c), items: vals(i), settings: { ...DEFAULT_SETTINGS, ...(s ?? {}) } }
    },
    putCustomer: async (c) => void (await r.hset(P + 'customers', { [c.id]: c })),
    deleteCustomer: async (id) => void (await r.hdel(P + 'customers', id)),
    putItem: async (i) => void (await r.hset(P + 'items', { [i.id]: i })),
    deleteItem: async (id) => void (await r.hdel(P + 'items', id)),
    putSettings: async (s) => void (await r.set(P + 'settings', s)),
    listSubs: async () => vals(await r.hgetall<Record<string, PushSub>>(P + 'subs')),
    putSub: async (s) => void (await r.hset(P + 'subs', { [s.endpoint]: s })),
    deleteSub: async (endpoint) => void (await r.hdel(P + 'subs', endpoint)),
    async claim(key, ttl) {
      return (await r.set(P + 'k:' + key, 1, { nx: true, ex: ttl })) === 'OK'
    },
    async incr(key, ttl) {
      const n = await r.incr(P + 'k:' + key)
      if (n === 1) await r.expire(P + 'k:' + key, ttl)
      return n
    },
    del: async (key) => void (await r.del(P + 'k:' + key)),
  }
}

type FileDb = {
  customers: Record<string, Customer>
  items: Record<string, Item>
  subs: Record<string, PushSub>
  settings?: Settings
  keys: Record<string, { v: number; exp: number }>
}

function fileStore(): Store {
  const file = path.join(process.cwd(), '.data', 'db.json')
  const read = (): FileDb => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return { customers: {}, items: {}, subs: {}, keys: {} }
    }
  }
  const write = (db: FileDb) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(db, null, 2))
  }
  const edit = async (fn: (db: FileDb) => void) => {
    const db = read()
    fn(db)
    write(db)
  }
  const liveKey = (db: FileDb, key: string) => {
    const k = db.keys[key]
    return k && k.exp > Date.now() ? k : undefined
  }
  return {
    kind: 'file',
    async getAll() {
      const db = read()
      return {
        customers: Object.values(db.customers),
        items: Object.values(db.items),
        settings: { ...DEFAULT_SETTINGS, ...(db.settings ?? {}) },
      }
    },
    putCustomer: (c) => edit((db) => void (db.customers[c.id] = c)),
    deleteCustomer: (id) => edit((db) => void delete db.customers[id]),
    putItem: (i) => edit((db) => void (db.items[i.id] = i)),
    deleteItem: (id) => edit((db) => void delete db.items[id]),
    putSettings: (s) => edit((db) => void (db.settings = s)),
    listSubs: async () => Object.values(read().subs),
    putSub: (s) => edit((db) => void (db.subs[s.endpoint] = s)),
    deleteSub: (e) => edit((db) => void delete db.subs[e]),
    async claim(key, ttl) {
      const db = read()
      if (liveKey(db, key)) return false
      db.keys[key] = { v: 1, exp: Date.now() + ttl * 1000 }
      write(db)
      return true
    },
    async incr(key, ttl) {
      const db = read()
      const k = liveKey(db, key) ?? { v: 0, exp: Date.now() + ttl * 1000 }
      k.v += 1
      db.keys[key] = k
      write(db)
      return k.v
    },
    del: (key) => edit((db) => void delete db.keys[key]),
  }
}

let cached: Store | undefined

export function getStore(): Store {
  if (cached) return cached
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) cached = redisStore(url, token)
  else if (process.env.VERCEL) throw new StorageNotConfigured()
  else cached = fileStore()
  return cached
}
