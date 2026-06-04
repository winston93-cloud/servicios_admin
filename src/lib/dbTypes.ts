import type { InsForgeClient } from '@insforge/sdk'

/** Cliente PostgREST (`.from()`, `.select()`, etc.) — equivalente al antiguo `supabase`. */
export type AppDatabaseClient = InsForgeClient['database']

/** Cliente servidor con database + storage + functions. */
export type AppInsforgeClient = InsForgeClient
