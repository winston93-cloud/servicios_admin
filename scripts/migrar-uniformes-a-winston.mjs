#!/usr/bin/env node
/**
 * Espejo Uniformes (InsForge q488j9fg) → Winston Servicios.
 *
 *   node --env-file=.env.local scripts/migrar-uniformes-a-winston.mjs                 # solo verifica
 *   node --env-file=.env.local scripts/migrar-uniformes-a-winston.mjs --respaldo DIR  # JSON por tabla de Uniformes
 *   node --env-file=.env.local scripts/migrar-uniformes-a-winston.mjs --copiar        # copia y verifica
 *
 * --copiar hace upsert por llave primaria de las filas nuevas o cambiadas en Uniformes.
 * --borrar-sobrantes además borra en Winston, SOLO en las tablas de Uniformes, lo que ya no existe
 * en Uniformes; usarlo SOLO antes del corte (después, Winston recibe movimientos nuevos).
 * Con la migración de lógica aplicada, desactivar antes los triggers de esas tablas
 * (ALTER TABLE … DISABLE TRIGGER USER) para que la copia no genere auditoría, folios ni pedidos.
 * Nunca toca alumno, ciclos_escolares ni usuario de Winston.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createAdminClient } from '@insforge/sdk'

const UNIFORMES_PROJECT = '/home/mario/Proyectos/uniformes/.insforge/project.json'
const PROTEGIDAS = new Set(['alumno', 'ciclos_escolares', 'usuario'])

/** Tabla → llave primaria (todas las de Uniformes salvo las 3 que ya son de Winston). */
const TABLAS = {
  auditoria: 'id',
  categorias_prendas: 'id',
  compras_insumos: 'id',
  conjunto_precios: 'id',
  conjuntos: 'id',
  cortes: 'id',
  costo_ubicaciones: 'id',
  costos: 'id',
  cotizaciones: 'id',
  datos_fiscales_cliente: 'id',
  detalle_cortes: 'id',
  detalle_cotizacion: 'id',
  detalle_devoluciones: 'id',
  detalle_pedidos: 'id',
  detalle_transferencias: 'id',
  devoluciones: 'id',
  empresas: 'id',
  externos: 'id',
  gastos_fijos_catalogo: 'id',
  gastos_fijos_semanales: 'id',
  gastos_fijos_semanales_detalle: 'id',
  insumo_ubicaciones: 'id',
  insumos: 'id',
  movimientos: 'id',
  pedidos: 'id',
  prenda_talla_insumos: 'id',
  prendas: 'id',
  presentaciones: 'id',
  produccion_plan_semanal: 'id',
  produccion_plan_semanal_items: 'id',
  roles_uniformes: 'id',
  sat_formas_pago: 'id',
  sat_metodos_pago: 'id',
  semanas: 'id',
  snapshot_insumos_pedido: 'id',
  sucursales: 'id',
  tallas: 'id',
  transferencias: 'id',
  ubicaciones_almacenamiento: 'id',
  uniformes_migracion_state: 'id',
  usuario_perfil: 'perfil_id',
  usuarios: 'id',
  usuarios_uniformes: 'id',
}

const args = process.argv.slice(2)
const copiar = args.includes('--copiar')
const borrarSobrantes = args.includes('--borrar-sobrantes')
const dirRespaldo = args.includes('--respaldo') ? args[args.indexOf('--respaldo') + 1] : null

for (const t of Object.keys(TABLAS)) if (PROTEGIDAS.has(t)) throw new Error(`${t} es de Winston; no se copia.`)

const uniformesCfg = JSON.parse(readFileSync(UNIFORMES_PROJECT, 'utf8'))
if (!uniformesCfg.oss_host.includes('q488j9fg')) throw new Error('El origen no es el proyecto Uniformes.')
const origen = createAdminClient({ baseUrl: uniformesCfg.oss_host, apiKey: uniformesCfg.api_key }).database

const winstonUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL
const winstonKey = process.env.INSFORGE_API_KEY
if (!winstonUrl || !winstonKey) throw new Error('Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY (.env.local de Winston).')
if (!winstonUrl.includes('g4ta4bfg')) throw new Error('El destino debe ser Winston Servicios (g4ta4bfg).')
const destino = createAdminClient({ baseUrl: winstonUrl, apiKey: winstonKey }).database

async function todas(db, tabla, pk) {
  const filas = []
  for (let ultimo = null; ; ) {
    let consulta = db.from(tabla).select('*').order(pk, { ascending: true }).limit(1000)
    if (ultimo != null) consulta = consulta.gt(pk, ultimo)
    const { data, error } = await consulta
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) return filas
    ultimo = data[data.length - 1][pk]
  }
}

const normal = (fila) => JSON.stringify(Object.keys(fila).sort().map((k) => [k, fila[k]]))

if (dirRespaldo) {
  mkdirSync(dirRespaldo, { recursive: true })
  for (const t of [...Object.keys(TABLAS), ...PROTEGIDAS]) {
    const filas = await todas(origen, t, TABLAS[t] ?? (t === 'alumno' ? 'alumno_id' : t === 'usuario' ? 'usuario_id' : 'id'))
    writeFileSync(`${dirRespaldo}/${t}.json`, JSON.stringify(filas))
    console.log(`respaldo ${t}: ${filas.length}`)
  }
  process.exit(0)
}

async function verificar() {
  let ok = true
  for (const [t, pk] of Object.entries(TABLAS)) {
    const [u, w] = await Promise.all([todas(origen, t, pk), todas(destino, t, pk)])
    const mapaW = new Map(w.map((f) => [String(f[pk]), normal(f)]))
    const faltan = u.filter((f) => !mapaW.has(String(f[pk]))).length
    const distintas = u.filter((f) => mapaW.has(String(f[pk])) && mapaW.get(String(f[pk])) !== normal(f)).length
    const idsU = new Set(u.map((f) => String(f[pk])))
    const sobran = w.filter((f) => !idsU.has(String(f[pk]))).length
    const bien = faltan === 0 && distintas === 0 && sobran === 0
    if (!bien) ok = false
    console.log(`${bien ? 'OK ' : 'DIF'} ${t.padEnd(32)} Uniformes=${u.length} Winston=${w.length} faltan=${faltan} distintas=${distintas} sobran=${sobran}`)
  }
  return ok
}

if (copiar) {
  for (const [t, pk] of Object.entries(TABLAS)) {
    const actuales = new Map((await todas(destino, t, pk)).map((f) => [String(f[pk]), normal(f)]))
    const filas = (await todas(origen, t, pk)).filter((f) => actuales.get(String(f[pk])) !== normal(f))
    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await destino.from(t).upsert(filas.slice(i, i + 500), { onConflict: pk })
      if (error) throw new Error(`${t}: ${error.message}`)
    }
    console.log(`copiadas ${t}: ${filas.length}`)
  }
  for (const [t, pk] of borrarSobrantes ? Object.entries(TABLAS) : []) {
    const ids = new Set((await todas(origen, t, pk)).map((f) => String(f[pk])))
    const sobran = (await todas(destino, t, pk)).filter((f) => !ids.has(String(f[pk]))).map((f) => f[pk])
    for (let i = 0; i < sobran.length; i += 200) {
      const { error } = await destino.from(t).delete().in(pk, sobran.slice(i, i + 200))
      if (error) throw new Error(`${t} (borrar sobrantes): ${error.message}`)
    }
    if (sobran.length) console.log(`borradas en Winston ${t}: ${sobran.length} (ya no existen en Uniformes)`)
  }
}

const ok = await verificar()
console.log(ok ? '\nESPEJO IDÉNTICO' : '\nHAY DIFERENCIAS')
process.exit(ok ? 0 : 1)
