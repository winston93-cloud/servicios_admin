import { createClient, type InsForgeClient } from '@insforge/sdk'
import type { AppDatabaseClient } from './dbTypes'
import {
  portalSessionHeaderName,
  readPortalSessionForFetch,
} from './insforgeDbProxyShared'
import { createInsforgeAdmin } from './insforgeAdmin'

function browserOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function browserDatabaseFetch(): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    const session = readPortalSessionForFetch()
    if (session) {
      headers.set(portalSessionHeaderName(), session)
    }
    return fetch(input, { ...init, headers })
  }
}

let browserClient: InsForgeClient | null = null
let serverClient: InsForgeClient | null = null

function createBrowserClient(): InsForgeClient {
  return createClient({
    baseUrl: browserOrigin(),
    anonKey: 'browser-proxy',
    fetch: browserDatabaseFetch(),
  })
}

export function getInsforgeClient(): InsForgeClient {
  if (typeof window === 'undefined') {
    if (!serverClient) {
      serverClient = createInsforgeAdmin()
    }
    return serverClient
  }
  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}

function getDatabaseClient(): AppDatabaseClient {
  return getInsforgeClient().database
}

/** Acceso a tablas — servidor: API key; navegador: proxy /api/database con sesión. */
export const insforge = new Proxy({} as InsForgeClient, {
  get(_target, prop) {
    const client = getInsforgeClient()
    const value = client[prop as keyof InsForgeClient]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export const supabase = new Proxy({} as AppDatabaseClient, {
  get(_target, prop) {
    const db = getDatabaseClient()
    const value = db[prop as keyof AppDatabaseClient]
    return typeof value === 'function' ? value.bind(db) : value
  },
})
