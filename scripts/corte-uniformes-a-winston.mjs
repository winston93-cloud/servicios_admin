#!/usr/bin/env node
/**
 * Corte de Uniformes a Winston Servicios (fuera de horario: Uniformes se usa de 8:00 a 17:30).
 *
 *   node --env-file=.env.local scripts/corte-uniformes-a-winston.mjs --sincronizar   # última copia + folios
 *   node --env-file=.env.local scripts/corte-uniformes-a-winston.mjs --vercel        # variables del proyecto uniformes
 *
 * --sincronizar: apaga los triggers de las tablas de Uniformes en Winston (para que la copia no genere
 * auditoría, folios ni pedidos), copia lo nuevo/cambiado y borra lo que ya no existe en Uniformes
 * (solo en esas tablas), vuelve a prender los triggers y alinea las secuencias de folios.
 * --vercel: apunta NEXT_PUBLIC_INSFORGE_URL, NEXT_PUBLIC_INSFORGE_ANON_KEY e INSFORGE_ADMIN_TOKEN del
 * proyecto Vercel «uniformes» a Winston. Nunca imprime valores. Después: redeploy de producción.
 */
import { execFileSync, spawnSync } from 'node:child_process'

const UNIFORMES_DIR = '/home/mario/Proyectos/uniformes'
const WINSTON_DIR = '/home/mario/Proyectos/servicios_admin'
const SECUENCIAS = ['cotizacion_folio_seq', 'devoluciones_folio_seq']
const TABLAS_UNIFORMES = [
  'auditoria', 'categorias_prendas', 'compras_insumos', 'conjunto_precios', 'conjuntos', 'cortes',
  'costo_ubicaciones', 'costos', 'cotizaciones', 'datos_fiscales_cliente', 'detalle_cortes',
  'detalle_cotizacion', 'detalle_devoluciones', 'detalle_pedidos', 'detalle_transferencias', 'devoluciones',
  'empresas', 'externos', 'gastos_fijos_catalogo', 'gastos_fijos_semanales', 'gastos_fijos_semanales_detalle',
  'insumo_ubicaciones', 'insumos', 'movimientos', 'pedidos', 'prenda_talla_insumos', 'prendas',
  'presentaciones', 'produccion_plan_semanal', 'produccion_plan_semanal_items', 'roles_uniformes',
  'sat_formas_pago', 'sat_metodos_pago', 'semanas', 'snapshot_insumos_pedido', 'sucursales', 'tallas',
  'transferencias', 'ubicaciones_almacenamiento', 'uniformes_migracion_state', 'usuario_perfil', 'usuarios',
  'usuarios_uniformes',
]

function sql(dir, consulta) {
  const out = execFileSync('npx', ['-y', '@insforge/cli@latest', 'db', 'query', '--json', '--', consulta], {
    cwd: dir,
    encoding: 'utf8',
  })
  return JSON.parse(out).rows
}

function triggers(accion) {
  sql(WINSTON_DIR, TABLAS_UNIFORMES.map((t) => `ALTER TABLE public.${t} ${accion} TRIGGER USER;`).join('\n'))
  console.log(`triggers ${accion === 'DISABLE' ? 'apagados' : 'prendidos'} en ${TABLAS_UNIFORMES.length} tablas`)
}

if (process.argv.includes('--sincronizar')) {
  triggers('DISABLE')
  let r
  try {
    r = spawnSync('node', ['--env-file=.env.local', 'scripts/migrar-uniformes-a-winston.mjs', '--copiar', '--borrar-sobrantes'], {
      cwd: WINSTON_DIR,
      stdio: 'inherit',
    })
  } finally {
    triggers('ENABLE')
  }
  for (const s of SECUENCIAS) {
    const [u] = sql(UNIFORMES_DIR, `select last_value, is_called from public.${s}`)
    sql(WINSTON_DIR, `select setval('public.${s}', ${Number(u.last_value)}, ${u.is_called})`)
    console.log(`secuencia ${s} → ${u.last_value}`)
  }
  process.exit(r?.status ?? 1)
}

if (process.argv.includes('--vercel')) {
  const url = process.env.NEXT_PUBLIC_INSFORGE_URL
  const anon = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  const admin = process.env.INSFORGE_API_KEY
  if (!url?.includes('g4ta4bfg') || !anon || !admin) throw new Error('Faltan variables de Winston en .env.local.')
  if (anon.startsWith('ik_')) throw new Error('NEXT_PUBLIC_INSFORGE_ANON_KEY no puede ser una llave de servicio (ik_).')
  const variables = [
    ['NEXT_PUBLIC_INSFORGE_URL', url, false],
    ['NEXT_PUBLIC_INSFORGE_ANON_KEY', anon, false],
    ['INSFORGE_ADMIN_TOKEN', admin, true],
  ]
  for (const env of ['production', 'preview', 'development']) {
    for (const [nombre, valor, sensible] of variables) {
      const args = ['-y', 'vercel', 'env', 'add', nombre, env, '--yes', '--force']
      if (env !== 'development') args.push(sensible ? '--sensitive' : '--no-sensitive')
      const r = spawnSync('npx', args, { cwd: UNIFORMES_DIR, input: valor, encoding: 'utf8' })
      console.log(`${r.status === 0 ? '✓' : '✗'} ${nombre} → ${env}${r.status === 0 ? '' : `: ${(r.stderr || '').slice(0, 200)}`}`)
      if (r.status !== 0) process.exitCode = 1
    }
  }
}
