import { createClient, type InsForgeClient } from '@insforge/sdk'
import type { AppDatabaseClient } from './dbTypes'
import { getDesayunosAdmin } from './desayunosInsforge'
import {
  portalSessionHeaderName,
  readPortalSessionForFetch,
} from './insforgeDbProxyShared'

function browserOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function browserDesayunosFetch(): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    const session = readPortalSessionForFetch()
    if (session) {
      headers.set(portalSessionHeaderName(), session)
    }

    let url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (url.includes('/api/database/')) {
      url = url.replace('/api/database/', '/api/desayunos-database/')
    }

    const request =
      typeof input === 'string' || input instanceof URL
        ? new Request(url, { ...init, headers })
        : new Request(url, { ...init, headers, method: input.method })

    return fetch(request)
  }
}

let browserClient: InsForgeClient | null = null

function createBrowserDesayunosClient(): InsForgeClient {
  return createClient({
    baseUrl: browserOrigin(),
    anonKey: 'desayunos-proxy',
    fetch: browserDesayunosFetch(),
  })
}

function getDesayunosDatabaseClient(): AppDatabaseClient {
  if (typeof window === 'undefined') {
    return getDesayunosAdmin().database
  }
  if (!browserClient) {
    browserClient = createBrowserDesayunosClient()
  }
  return browserClient.database
}

/** Tablas Desayunos POS: concepto_desayunos, pago_desayunos, notificaciones, etc. */
export const desayunosDb = new Proxy({} as AppDatabaseClient, {
  get(_target, prop) {
    const db = getDesayunosDatabaseClient()
    const value = db[prop as keyof AppDatabaseClient]
    return typeof value === 'function' ? value.bind(db) : value
  },
})
