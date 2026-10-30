import 'server-only'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_SETTINGS, type AppData, type Customer, type Item, type PushSub, type Settings } from './types'

/**
 * Three backends, picked by which env vars are set:
 *  - Supabase (SUPABASE_URL + SUPABASE_SECRET_KEY; tables from supabase/schema.sql)
 *  - Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN)
 *  - a JSON file in .data/ (local development only)
 */
export interface Store {
  kind: 'supabase' | 'redis' | 'file'
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
  /** App-generated config (push keys, cron token). */
  getConfig<T>(key: string): Promise<T | null>
  /** Saves `value` only if nothing is stored yet; returns whatever ends up stored. */
  initConfig<T>(key: string, value: T): Promise<T>
}

export class StorageNotConfigured extends Error {
  constructor() {
    super('Storage is not connected. In Vercel, add SUPABASE_URL and SUPABASE_SECRET_KEY to this project, then redeploy.')
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
    getConfig: async <T>(key: string) => r.get<T>(P + 'cfg:' + key),
    async initConfig<T>(key: string, value: T) {
      await r.set(P + 'cfg:' + key, value, { nx: true })
      return (await r.get<T>(P + 'cfg:' + key)) as T
    },
  }
}

function supabaseStore(url: string, key: string): Store {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const T = {
    customers: 'schedule_customers',
    items: 'schedule_items',
    subs: 'schedule_push_subs',
    settings: 'schedule_settings',
    keys: 'schedule_keys',
    config: 'schedule_config',
  }
  const ok = <R extends { error: unknown }>(r: R) => {
    if (r.error) throw new Error(`Supabase: ${(r.error as { message?: string }).message ?? 'request failed'}`)
    return r
  }
  // PostgREST returns at most 1000 rows per request, so page through.
  async function all<T>(table: string): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = ok(await db.from(table).select('data').range(from, from + 999))
      out.push(...(data ?? []).map((r) => r.data as T))
      if (!data || data.length < 1000) return out
    }
  }
  const put = async (table: string, row: Record<string, unknown>, onConflict = 'id') =>
    void ok(await db.from(table).upsert({ ...row, ...(table === T.subs ? {} : { updated_at: new Date().toISOString() }) }, { onConflict }))
  const remove = async (table: string, col: string, val: string) => void ok(await db.from(table).delete().eq(col, val))
  const expiry = (ttl: number) => new Date(Date.now() + ttl * 1000).toISOString()

  return {
    kind: 'supabase',
    async getAll() {
      const [customers, items, s] = await Promise.all([
        all<Customer>(T.customers),
        all<Item>(T.items),
        db.from(T.settings).select('data').eq('id', 1).maybeSingle(),
      ])
      return { customers, items, settings: { ...DEFAULT_SETTINGS, ...(ok(s).data?.data ?? {}) } }
    },
    putCustomer: (c) => put(T.customers, { id: c.id, data: c }),
    deleteCustomer: (id) => remove(T.customers, 'id', id),
    putItem: (i) => put(T.items, { id: i.id, data: i }),
    deleteItem: (id) => remove(T.items, 'id', id),
    putSettings: (s) => put(T.settings, { id: 1, data: s }),
    listSubs: () => all<PushSub>(T.subs),
    putSub: (s) => put(T.subs, { endpoint: s.endpoint, data: s }, 'endpoint'),
    deleteSub: (endpoint) => remove(T.subs, 'endpoint', endpoint),
    async claim(key, ttl) {
      ok(await db.from(T.keys).delete().eq('key', key).lt('expires_at', new Date().toISOString()))
      // Insert-if-missing is atomic in Postgres, so two devices can't both claim the same alert.
      const { data } = ok(
        await db
          .from(T.keys)
          .upsert({ key, value: 1, expires_at: expiry(ttl) }, { onConflict: 'key', ignoreDuplicates: true })
          .select('key'),
      )
      return (data?.length ?? 0) > 0
    },
    async incr(key, ttl) {
      const { data } = ok(await db.from(T.keys).select('value, expires_at').eq('key', key).maybeSingle())
      const live = data && Date.parse(data.expires_at) > Date.now()
      const value = live ? data.value + 1 : 1
      ok(await db.from(T.keys).upsert({ key, value, expires_at: live ? data.expires_at : expiry(ttl) }, { onConflict: 'key' }))
      return value
    },
    del: (key) => remove(T.keys, 'key', key),
    async getConfig<T>(key: string) {
      const { data } = ok(await db.from(T.config).select('value').eq('key', key).maybeSingle())
      return (data?.value ?? null) as T | null
    },
    async initConfig<T>(key: string, value: T) {
      ok(await db.from(T.config).upsert({ key, value }, { onConflict: 'key', ignoreDuplicates: true }))
      const { data } = ok(await db.from(T.config).select('value').eq('key', key).single())
      return data!.value as T
    },
  }
}

type FileDb = {
  customers: Record<string, Customer>
  items: Record<string, Item>
  subs: Record<string, PushSub>
  settings?: Settings
  keys: Record<string, { v: number; exp: number }>
  config?: Record<string, unknown>
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
    getConfig: async <T>(key: string) => (read().config?.[key] ?? null) as T | null,
    async initConfig<T>(key: string, value: T) {
      const db = read()
      db.config ??= {}
      if (!(key in db.config)) {
        db.config[key] = value
        write(db)
      }
      return db.config[key] as T
    },
  }
}

let cached: Store | undefined

export function getStore(): Store {
  if (cached) return cached
  const sbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (sbUrl && sbKey) cached = supabaseStore(sbUrl, sbKey)
  else if (url && token) cached = redisStore(url, token)
  else if (process.env.VERCEL) throw new StorageNotConfigured()
  else cached = fileStore()
  return cached
}
