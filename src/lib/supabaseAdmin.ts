/**
 * @deprecated Usar `createDbAdmin` o `createInsforgeAdmin` desde `@/lib/insforgeAdmin`.
 */
import type { AppDatabaseClient } from './dbTypes'
import { createDbAdmin } from './insforgeAdmin'

export function createSupabaseAdmin(): AppDatabaseClient {
  return createDbAdmin()
}

export { createInsforgeAdmin, createDbAdmin } from './insforgeAdmin'
