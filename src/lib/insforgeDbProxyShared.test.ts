/**
 * 2026-10-12 - Seguridad del proxy /api/database: una sesión de familia no puede leer ni escribir tablas
 * internas (antes cualquier sesión tenía acceso total con la API key de administrador).
 * Ejecutar: npx tsx --test src/lib/insforgeDbProxyShared.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { familiaPuedeUsarProxy, proxyInsforgeDatabaseRequest, tablaDeRuta } from './insforgeDbProxyShared'
import type { AuthSession } from './portalAuthService'

const ENV = { baseUrl: 'https://db.ejemplo', apiKey: 'llave-de-prueba' }
const FAMILIA: AuthSession = { role: 'alumno', displayName: 'PRUEBA', alumno_id: 2683, alumno_ref: 29904 }
const PERSONAL: AuthSession = { role: 'usuario', displayName: 'Sistemas', usuario_id: 1, usuario_username: 'sistemas' }

function conFetchFalso<T>(fn: (llamadas: string[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  const llamadas: string[] = []
  globalThis.fetch = (async (url: string | URL | Request) => {
    llamadas.push(String(url))
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return fn(llamadas).finally(() => {
    globalThis.fetch = original
  })
}

function pedir(path: string, method = 'GET') {
  return new Request(`https://servicios.ejemplo${path}`, { method, body: method === 'GET' ? undefined : '{}' })
}

test('tablaDeRuta', () => {
  assert.equal(tablaDeRuta('/api/database/records/alumno'), 'alumno')
  assert.equal(tablaDeRuta('/api/database/records/Ciclos_Escolares'), 'ciclos_escolares')
  assert.equal(tablaDeRuta('/api/database/rpc/algo'), null)
})

test('familia: solo lectura de ciclos_escolares', () => {
  assert.equal(familiaPuedeUsarProxy('/api/database/records/ciclos_escolares', 'GET'), true)
  assert.equal(familiaPuedeUsarProxy('/api/database/records/ciclos_escolares', 'PATCH'), false)
  assert.equal(familiaPuedeUsarProxy('/api/database/records/alumno', 'GET'), false)
  assert.equal(familiaPuedeUsarProxy('/api/database/records/usuario', 'GET'), false)
  assert.equal(familiaPuedeUsarProxy('/api/database/rpc/cualquiera', 'POST'), false)
})

test('familia: 403 al leer alumnos o usuarios y no llega a la base', async () => {
  await conFetchFalso(async (llamadas) => {
    for (const tabla of ['alumno', 'usuario', 'alumno_detalles', 'pago_detalle']) {
      const r = await proxyInsforgeDatabaseRequest(
        pedir(`/api/database/records/${tabla}?select=*`),
        `/api/database/records/${tabla}`,
        FAMILIA,
        ENV
      )
      assert.equal(r.status, 403, tabla)
    }
    assert.equal(llamadas.length, 0)
  })
})

test('familia: 403 al escribir o llamar RPC', async () => {
  await conFetchFalso(async (llamadas) => {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const r = await proxyInsforgeDatabaseRequest(
        pedir('/api/database/records/pago_detalle', method),
        '/api/database/records/pago_detalle',
        FAMILIA,
        ENV
      )
      assert.equal(r.status, 403, method)
    }
    const rpc = await proxyInsforgeDatabaseRequest(pedir('/api/database/rpc/x', 'POST'), '/api/database/rpc/x', FAMILIA, ENV)
    assert.equal(rpc.status, 403)
    assert.equal(llamadas.length, 0)
  })
})

test('familia: puede leer ciclos_escolares (lo usa su pantalla de inicio)', async () => {
  await conFetchFalso(async (llamadas) => {
    const r = await proxyInsforgeDatabaseRequest(
      pedir('/api/database/records/ciclos_escolares?select=*'),
      '/api/database/records/ciclos_escolares',
      FAMILIA,
      ENV
    )
    assert.equal(r.status, 200)
    assert.equal(llamadas.length, 1)
  })
})

test('personal: sigue igual (lee y escribe cualquier tabla)', async () => {
  await conFetchFalso(async (llamadas) => {
    const r1 = await proxyInsforgeDatabaseRequest(pedir('/api/database/records/alumno'), '/api/database/records/alumno', PERSONAL, ENV)
    const r2 = await proxyInsforgeDatabaseRequest(
      pedir('/api/database/records/pago_detalle', 'PATCH'),
      '/api/database/records/pago_detalle',
      PERSONAL,
      ENV
    )
    assert.equal(r1.status, 200)
    assert.equal(r2.status, 200)
    assert.equal(llamadas.length, 2)
  })
})

test('sin sesión: 401', async () => {
  const r = await proxyInsforgeDatabaseRequest(pedir('/api/database/records/alumno'), '/api/database/records/alumno', null, ENV)
  assert.equal(r.status, 401)
})
