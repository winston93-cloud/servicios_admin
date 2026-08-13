import { NextResponse } from 'next/server'
import { BoletasAuthError } from '@/lib/boletasAuth'

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function jsonError(err: unknown, fallbackStatus = 500) {
  if (err instanceof BoletasAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const message = err instanceof Error ? err.message : String(err)
  const status = /no autenticado|se requiere/i.test(message) ? 401 : fallbackStatus
  return NextResponse.json({ error: message }, { status })
}
