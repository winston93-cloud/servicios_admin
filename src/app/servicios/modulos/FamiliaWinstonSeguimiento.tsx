'use client'

/**
 * 2026-10-06 — Familia Winston · seguimiento: resumen por ciclo, comprobantes que faltan
 * (con su estado de preparación) y beneficios aplicados, con búsqueda y exportar a Excel.
 * Los datos los carga FamiliaWinstonModulo (GET ?vista=seguimiento); aquí solo se filtran.
 * 2026-10-06 — Rediseño de presentación: resumen según la pestaña (pendientes o aplicados), «qué
 * sigue» por estado, estados de carga/error/vacío cuidados, filtros ordenados y tarjetas en móvil.
 * No cambia filtros, estados, exportación a Excel ni la acción «Validar» de cada fila.
 */
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  FileSpreadsheet,
  FilterX,
  Hourglass,
  Inbox,
  Loader2,
  Mail,
  QrCode,
  RefreshCw,
  Search,
  SearchX,
  UserX,
  Users,
} from 'lucide-react'
import type {
  EstadoPendienteFamiliaWinston,
  FilaSeguimientoFamiliaWinston,
  SeguimientoFamiliaWinston,
} from '@/lib/familiaWinstonService'

export type VistaSeguimiento = 'pendientes' | 'aplicados'
export type CicloFiltro = number | 'todos'

type Tono = 'ok' | 'warn' | 'err' | 'neutro'

/** Etiqueta, color y orden (los más accionables primero) de cada estado de preparación. */
const ESTADOS: Record<EstadoPendienteFamiliaWinston, { texto: string; tono: Tono; orden: number }> = {
  listo: { texto: 'Listo para aplicar', tono: 'ok', orden: 0 },
  'en-proceso': { texto: 'En proceso (atorado)', tono: 'warn', orden: 1 },
  'falta-pago': { texto: 'Falta pago del recomendado', tono: 'warn', orden: 2 },
  'faltan-dias': { texto: 'Aún no cumple 30 días', tono: 'warn', orden: 3 },
  'falta-inicio-clases': { texto: 'Falta inicio de clases', tono: 'warn', orden: 4 },
  'sin-colegiaturas': { texto: 'Sin colegiaturas pendientes', tono: 'warn', orden: 5 },
  'varios-candidatos': { texto: 'Varios posibles recomendados', tono: 'neutro', orden: 6 },
  'interesado-no-inscrito': { texto: 'Interesado aún no inscrito', tono: 'neutro', orden: 7 },
  'falta-identificar': { texto: 'Falta identificar al recomendado', tono: 'neutro', orden: 8 },
  'no-coincide': { texto: 'Interesado no coincide', tono: 'err', orden: 9 },
  'recomendado-no-nuevo': { texto: 'Recomendado no es de nuevo ingreso', tono: 'err', orden: 10 },
  'recomendado-ya-uso': { texto: 'Recomendado ya generó beneficio', tono: 'err', orden: 11 },
  'recomendado-inactivo': { texto: 'Recomendado no está activo', tono: 'err', orden: 12 },
  'no-procede': { texto: 'No procede', tono: 'err', orden: 13 },
  'recomendador-baja': { texto: 'Recomendador dado de baja', tono: 'err', orden: 14 },
  'recomendador-no-existe': { texto: 'Recomendador no existe', tono: 'err', orden: 15 },
}

/**
 * 2026-10-06 — «Qué sigue» por estado, en lenguaje llano (solo se muestra en pantalla; el Excel
 * sigue usando ESTADOS[...].texto y el detalle del servidor).
 */
const SIGUIENTE: Record<EstadoPendienteFamiliaWinston, string> = {
  listo: 'Abre el validador y aplica el beneficio.',
  'en-proceso': 'Se quedó a medias al aplicar: ábrelo en el validador para revisarlo.',
  'falta-pago': 'Espera a que el recomendado pague su primera colegiatura.',
  'faltan-dias': 'Se podrá validar a partir de la fecha indicada.',
  'falta-inicio-clases': 'Captura el inicio de clases del ciclo (Validar › Inicio de clases por ciclo).',
  'sin-colegiaturas': 'Quien recomendó no tiene una colegiatura pendiente que condonar.',
  'varios-candidatos': 'Abre el validador y elige al alumno correcto.',
  'interesado-no-inscrito': 'Espera a que el interesado se inscriba.',
  'falta-identificar': 'Abre el validador y busca al alumno nuevo por el nombre del PDF.',
  'no-coincide': 'Revisa que el alumno elegido sea el interesado del comprobante.',
  'recomendado-no-nuevo': 'No procede: el recomendado no es de nuevo ingreso.',
  'recomendado-ya-uso': 'No procede: ese alumno ya generó un beneficio.',
  'recomendado-inactivo': 'No procede mientras el recomendado no esté activo.',
  'no-procede': 'Abre el validador para ver el motivo.',
  'recomendador-baja': 'Quien recomendó ya no está inscrito: no puede recibir el beneficio.',
  'recomendador-no-existe': 'Revisa el número de control del comprobante.',
}

const NIVELES: Record<number, string> = { 1: 'Maternal', 2: 'Kinder', 3: 'Primaria', 4: 'Secundaria' }

const FUENTE_ORIGEN: Record<string, string> = {
  interesado: 'según AgendaW',
  cita: 'según la cita',
  fecha: 'por la fecha del comprobante',
}

function gradoTexto(a: FilaSeguimientoFamiliaWinston['recomendador']): string {
  if (!a) return ''
  const nivel = NIVELES[a.nivel] ?? ''
  const grado = a.grado && a.grado !== '0' ? ` ${a.grado}°` : ''
  const grupo = a.grupo && a.grupo !== '0' ? ` · Gpo ${a.grupo}` : ''
  return `${nivel}${grado}${grupo}`.trim()
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function textoBusqueda(f: FilaSeguimientoFamiliaWinston): string {
  return normalizar(
    [
      f.folio,
      f.qr,
      f.ctrl,
      f.recomendador?.nombre,
      f.interesadoNombre,
      f.recomendado?.nombre,
      f.recomendado?.ref,
      f.pagoReferencia,
      f.validadoPor,
      ...f.sugerencias.map((s) => `${s.nombre} ${s.ref}`),
    ]
      .filter((x) => x != null)
      .join(' ')
  )
}

function correoTexto(f: FilaSeguimientoFamiliaWinston): string {
  if (f.correoEnviadoEn) return 'Enviado'
  if (f.correoResultado) return 'No enviado'
  return f.sistemaAnterior ? 'Sistema anterior' : 'Sin correo'
}

export default function FamiliaWinstonSeguimiento({
  vista,
  datos,
  cargando,
  error,
  cicloFiltro,
  onCambiarCiclo,
  opcionesCiclo,
  onCambiarVista,
  onRecargar,
  onValidar,
}: {
  vista: VistaSeguimiento
  datos: SeguimientoFamiliaWinston | null
  cargando: boolean
  error: string | null
  cicloFiltro: CicloFiltro
  onCambiarCiclo: (c: CicloFiltro) => void
  opcionesCiclo: { valor: number; etiqueta: string }[]
  onCambiarVista: (v: VistaSeguimiento) => void
  onRecargar: () => void
  onValidar: (qr: number, ctrl: number) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoPendienteFamiliaWinston | ''>('')
  const [exportando, setExportando] = useState(false)

  const nombreCiclo = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of datos?.ciclos ?? []) m.set(c.valor, c.nombre)
    return (v: number | null) => (v == null ? 'Sin ciclo' : m.get(v) ?? `${v + 2003}-${v + 2004}`)
  }, [datos])

  const delCiclo = useMemo(
    () => (datos?.filas ?? []).filter((f) => cicloFiltro === 'todos' || f.ciclo === cicloFiltro),
    [datos, cicloFiltro]
  )
  const pendientes = useMemo(() => delCiclo.filter((f) => f.status !== 'autorizado'), [delCiclo])
  const aplicados = useMemo(() => delCiclo.filter((f) => f.status === 'autorizado'), [delCiclo])
  const sinCiclo = useMemo(() => (datos?.filas ?? []).filter((f) => f.ciclo == null).length, [datos])

  const resumen = useMemo(() => {
    const cuenta = (e: EstadoPendienteFamiliaWinston) => pendientes.filter((f) => f.estado === e).length
    const meses = new Map<string, number>()
    for (const f of aplicados) if (f.mes) meses.set(f.mes, (meses.get(f.mes) ?? 0) + 1)
    return {
      total: delCiclo.length,
      pendientes: pendientes.filter((f) => f.status === 'pendiente').length,
      enProceso: cuenta('en-proceso'),
      listos: cuenta('listo'),
      yaPagaron: pendientes.filter((f) => f.primeraColegiaturaPagada).length,
      sinIdentificar: cuenta('falta-identificar'),
      bajas: cuenta('recomendador-baja'),
      aplicados: aplicados.length,
      condonadas: aplicados.filter((f) => f.conceptoCondonado).length,
      correos: aplicados.filter((f) => f.correoEnviadoEn).length,
      meses: [...meses.entries()],
      familias: new Set(pendientes.filter((f) => f.status === 'pendiente').map((f) => f.ctrl)).size,
    }
  }, [delCiclo, pendientes, aplicados])

  const conteoEstados = useMemo(() => {
    const m = new Map<EstadoPendienteFamiliaWinston, number>()
    for (const f of pendientes) if (f.estado) m.set(f.estado, (m.get(f.estado) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => ESTADOS[a[0]].orden - ESTADOS[b[0]].orden)
  }, [pendientes])

  const q = normalizar(busqueda.trim())
  const listaPendientes = useMemo(
    () =>
      pendientes
        .filter((f) => !estadoFiltro || f.estado === estadoFiltro)
        .filter((f) => !q || textoBusqueda(f).includes(q))
        .sort(
          (a, b) =>
            (a.estado ? ESTADOS[a.estado].orden : 99) - (b.estado ? ESTADOS[b.estado].orden : 99) || a.id - b.id
        ),
    [pendientes, estadoFiltro, q]
  )
  const listaAplicados = useMemo(
    () =>
      aplicados
        .filter((f) => !q || textoBusqueda(f).includes(q))
        .sort((a, b) => String(b.validadoEn ?? '').localeCompare(String(a.validadoEn ?? '')) || b.id - a.id),
    [aplicados, q]
  )

  const verEstado = (e: EstadoPendienteFamiliaWinston | '') => {
    setEstadoFiltro(e)
    onCambiarVista('pendientes')
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const { exportarFamiliaWinstonExcel } = await import('@/lib/familiaWinstonExcel')
      const etiquetaCiclo = cicloFiltro === 'todos' ? 'Todos los ciclos' : nombreCiclo(cicloFiltro)
      const sufijo = cicloFiltro === 'todos' ? 'todos' : nombreCiclo(cicloFiltro)
      const subtitulo = `${etiquetaCiclo} · generado ${new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
      if (vista === 'pendientes') {
        await exportarFamiliaWinstonExcel({
          hoja: 'Pendientes',
          titulo: 'Familia Winston — comprobantes pendientes',
          subtitulo,
          archivo: `familia-winston-pendientes-${sufijo}.xlsx`,
          columnas: [
            { titulo: 'Folio', ancho: 12 },
            { titulo: 'QR', ancho: 10 },
            { titulo: 'Fecha', ancho: 12 },
            { titulo: 'Recomienda (No. control)', ancho: 14 },
            { titulo: 'Recomienda', ancho: 34 },
            { titulo: 'Grado', ancho: 20 },
            { titulo: 'Recomendador activo', ancho: 12 },
            { titulo: 'Interesado', ancho: 32 },
            { titulo: 'Recomendado (No. control)', ancho: 14 },
            { titulo: 'Recomendado', ancho: 32 },
            { titulo: 'Posibles (sugeridos)', ancho: 40 },
            { titulo: 'Ciclo', ancho: 12 },
            { titulo: 'Estado', ancho: 30 },
            { titulo: 'Detalle', ancho: 60 },
          ],
          filas: listaPendientes.map((f) => [
            f.folio,
            f.qr,
            f.fechaReal ? fechaCorta(f.fechaReal) : 'Migrado',
            f.ctrl,
            f.recomendador?.nombre ?? '',
            gradoTexto(f.recomendador),
            f.recomendador ? (f.recomendador.activo ? 'Sí' : 'No') : '',
            [f.interesadoNombre, f.interesadoNivelGrado].filter(Boolean).join(' · '),
            f.recomendado?.ref ?? '',
            f.recomendado?.nombre ?? '',
            f.sugerencias.map((s) => `${s.nombre} (${s.ref})`).join(', '),
            nombreCiclo(f.ciclo),
            f.estado ? ESTADOS[f.estado].texto : '',
            f.detalle ?? '',
          ]),
        })
      } else {
        await exportarFamiliaWinstonExcel({
          hoja: 'Aplicados',
          titulo: 'Familia Winston — beneficios aplicados',
          subtitulo,
          archivo: `familia-winston-aplicados-${sufijo}.xlsx`,
          columnas: [
            { titulo: 'Folio', ancho: 12 },
            { titulo: 'Recibió (No. control)', ancho: 14 },
            { titulo: 'Recibió el beneficio', ancho: 34 },
            { titulo: 'Recomendó a (No. control)', ancho: 14 },
            { titulo: 'Recomendó a', ancho: 34 },
            { titulo: 'Colegiatura condonada', ancho: 16 },
            { titulo: 'Ciclo', ancho: 12 },
            { titulo: 'Referencia de pago', ancho: 18 },
            { titulo: 'Validado', ancho: 22 },
            { titulo: 'Validó', ancho: 30 },
            { titulo: 'Correo', ancho: 14 },
          ],
          filas: listaAplicados.map((f) => [
            f.folio,
            f.ctrl,
            f.recomendador?.nombre ?? '',
            f.recomendado?.ref ?? '',
            f.recomendado?.nombre ?? '',
            f.mes ?? (f.sistemaAnterior ? 'Sistema anterior' : ''),
            nombreCiclo(f.ciclo),
            f.pagoReferencia ?? '',
            fmtFechaHora(f.validadoEn),
            f.validadoPor ?? '',
            correoTexto(f),
          ]),
        })
      }
    } finally {
      setExportando(false)
    }
  }

  /* 2026-10-06 — Apoyos de presentación: filtros activos, hora de la última carga y totales coherentes con la pestaña. */
  const hayFiltros = !!busqueda.trim() || (vista === 'pendientes' && !!estadoFiltro)
  const limpiarFiltros = () => {
    setBusqueda('')
    setEstadoFiltro('')
  }
  const horaCarga = (() => {
    const d = datos?.generadoEn ? new Date(datos.generadoEn) : null
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : null
  })()
  const nombreCicloFiltro = cicloFiltro === 'todos' ? 'todos los ciclos' : nombreCiclo(cicloFiltro)
  const esPendientes = vista === 'pendientes'
  const totalLista = esPendientes ? listaPendientes.length : listaAplicados.length

  return (
    <div className="fw-seg">
      {/* ── Ciclo + resumen de la pestaña ─────────────────────── */}
      <section className="servicios-panel-card fw-card" aria-labelledby="fw-seg-resumen">
        <div className="fw-card-cabeza">
          <div className="fw-card-enc">
            <h2 id="fw-seg-resumen" className="fw-h2">
              {esPendientes ? 'Qué falta por aplicar' : 'Qué ya se aplicó'}
            </h2>
            <p className="fw-card-sub">
              {cicloFiltro === 'todos' ? 'Todos los ciclos' : `Ciclo ${nombreCiclo(cicloFiltro)}`}
              {datos ? ` · ${resumen.total} comprobantes · ${resumen.familias} familias con pendientes` : ''}
            </p>
          </div>
          <div className="fw-cabeza-der">
            <label className="fw-seg-ciclo">
              <span>Ciclo</span>
              <select
                className="fw-input"
                value={String(cicloFiltro)}
                onChange={(e) => onCambiarCiclo(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              >
                <option value="todos">Todos los ciclos</option>
                {opcionesCiclo.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <div className="fw-actualizar">
              <button type="button" className="usr-btn" disabled={cargando} onClick={onRecargar}>
                {cargando ? <Loader2 className="usr-spin" size={16} aria-hidden /> : <RefreshCw size={16} aria-hidden />}
                Actualizar
              </button>
              {horaCarga ? <small className="fw-sub">Datos de las {horaCarga}</small> : null}
            </div>
          </div>
        </div>

        {error && datos ? (
          <p className="fw-aviso fw-aviso--err" role="alert">
            {error}
          </p>
        ) : null}

        {!datos && cargando ? (
          /* 2026-10-06 — Carga con esqueleto (mismo molde que el resumen y la tabla). */
          <div className="fw-skel-grupo" role="status" aria-live="polite">
            <span className="fw-sr">Revisando comprobantes…</span>
            <div className="fw-kpis" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="fw-skel fw-skel--kpi" />
              ))}
            </div>
          </div>
        ) : !datos && error ? (
          /* 2026-10-06 — Error sin datos: se explica y se ofrece reintentar. */
          <div className="fw-vacio fw-vacio--err" role="alert">
            <CircleAlert size={30} aria-hidden />
            <p className="fw-vacio-encab">No se pudo cargar el seguimiento</p>
            <p>{error}</p>
            <button type="button" className="usr-btn usr-btn--primary" onClick={onRecargar}>
              <RefreshCw size={16} aria-hidden /> Reintentar
            </button>
          </div>
        ) : datos ? (
          <>
            {esPendientes ? (
              <div className="fw-kpis">
                <button
                  type="button"
                  className="fw-kpi fw-kpi--accion"
                  aria-pressed={!estadoFiltro}
                  onClick={() => setEstadoFiltro('')}
                >
                  <span>
                    <Hourglass size={15} aria-hidden /> Faltan por aplicar
                  </span>
                  <strong>{pendientes.length}</strong>
                  <small>
                    {resumen.enProceso > 0 ? `Incluye ${resumen.enProceso} en proceso. ` : ''}Ver todos
                  </small>
                </button>
                <button
                  type="button"
                  className="fw-kpi fw-kpi--ok fw-kpi--accion"
                  aria-pressed={estadoFiltro === 'listo'}
                  onClick={() => verEstado('listo')}
                >
                  <span>
                    <CheckCircle2 size={15} aria-hidden /> Listos para aplicar
                  </span>
                  <strong>{resumen.listos}</strong>
                  <small>{resumen.yaPagaron} con la primera colegiatura del recomendado pagada</small>
                </button>
                <button
                  type="button"
                  className="fw-kpi fw-kpi--accion"
                  aria-pressed={estadoFiltro === 'falta-identificar'}
                  onClick={() => verEstado('falta-identificar')}
                >
                  <span>
                    <Users size={15} aria-hidden /> Falta identificar
                  </span>
                  <strong>{resumen.sinIdentificar}</strong>
                  <small>No se sabe a quién recomendaron</small>
                </button>
                <button
                  type="button"
                  className="fw-kpi fw-kpi--err fw-kpi--accion"
                  aria-pressed={estadoFiltro === 'recomendador-baja'}
                  onClick={() => verEstado('recomendador-baja')}
                >
                  <span>
                    <UserX size={15} aria-hidden /> Recomendador de baja
                  </span>
                  <strong>{resumen.bajas}</strong>
                  <small>Ya no pueden recibir el beneficio</small>
                </button>
                {resumen.enProceso > 0 ? (
                  <button
                    type="button"
                    className="fw-kpi fw-kpi--warn fw-kpi--accion"
                    aria-pressed={estadoFiltro === 'en-proceso'}
                    onClick={() => verEstado('en-proceso')}
                  >
                    <span>
                      <Clock size={15} aria-hidden /> En proceso (atorados)
                    </span>
                    <strong>{resumen.enProceso}</strong>
                    <small>Se quedaron «aplicando»</small>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="fw-kpi fw-kpi--acento fw-kpi--accion"
                  onClick={() => onCambiarVista('aplicados')}
                >
                  <span>
                    <FileSpreadsheet size={15} aria-hidden /> Ya aplicados
                  </span>
                  <strong>{resumen.aplicados}</strong>
                  <small className="fw-kpi-ir">
                    Ver aplicados <ArrowRight size={13} aria-hidden />
                  </small>
                </button>
              </div>
            ) : (
              <div className="fw-kpis">
                <div className="fw-kpi fw-kpi--acento">
                  <span>
                    <FileSpreadsheet size={15} aria-hidden /> Beneficios aplicados
                  </span>
                  <strong>{resumen.aplicados}</strong>
                  <small>En {nombreCicloFiltro}</small>
                </div>
                <div className="fw-kpi fw-kpi--ok">
                  <span>
                    <CheckCircle2 size={15} aria-hidden /> Colegiaturas condonadas
                  </span>
                  <strong>{resumen.condonadas}</strong>
                  <small>Registradas en $0</small>
                </div>
                <div className="fw-kpi">
                  <span>
                    <Mail size={15} aria-hidden /> Correos enviados
                  </span>
                  <strong>{resumen.correos}</strong>
                  <small>
                    {resumen.aplicados - resumen.correos > 0
                      ? `${resumen.aplicados - resumen.correos} sin correo (incluye sistema anterior)`
                      : 'A todas las familias'}
                  </small>
                </div>
                <button type="button" className="fw-kpi fw-kpi--accion" onClick={() => onCambiarVista('pendientes')}>
                  <span>
                    <Hourglass size={15} aria-hidden /> Faltan por aplicar
                  </span>
                  <strong>{pendientes.length}</strong>
                  <small className="fw-kpi-ir">
                    Ver pendientes <ArrowRight size={13} aria-hidden />
                  </small>
                </button>
              </div>
            )}

            {cicloFiltro !== 'todos' && sinCiclo > 0 ? (
              <p className="fw-hint">
                {sinCiclo} comprobante(s) no tienen ciclo identificable y solo aparecen en{' '}
                <button type="button" className="fw-btn-link fw-btn-inline" onClick={() => onCambiarCiclo('todos')}>
                  Todos los ciclos
                </button>
                .
              </p>
            ) : null}
            {/* 2026-10-06 — La nota larga de cómo se asigna el ciclo pasa a un desplegable (no recarga el resumen). */}
            <details className="fw-ayuda">
              <summary>¿Cómo se asigna el ciclo a cada comprobante?</summary>
              <p className="fw-hint">
                Ciclo de un pendiente: el ciclo actual de quien recomienda (donde se condonaría). Aplicados: el ciclo
                de la colegiatura condonada. Los comprobantes migrados no tienen fecha real.
              </p>
            </details>
          </>
        ) : null}
      </section>

      {/* ── Lista ─────────────────────────────────────────────── */}
      {datos ? (
        <section className="servicios-panel-card fw-card" aria-labelledby="fw-seg-lista">
          <div className="fw-card-cabeza">
            <div className="fw-card-enc">
              <h2 id="fw-seg-lista" className="fw-h2">
                {esPendientes ? 'Comprobantes que faltan' : 'Beneficios aplicados'}{' '}
                <span className="fw-h2-n">({totalLista})</span>
              </h2>
              <p className="fw-card-sub">
                {esPendientes
                  ? 'Los más fáciles de resolver aparecen primero. «Validar» abre el validador con ese comprobante.'
                  : 'Del más reciente al más antiguo. Aquí queda quién validó y si se avisó a la familia.'}
              </p>
            </div>
            {/* 2026-10-06 — Exportar junto al título de la lista: exporta lo que se ve con los filtros activos. */}
            <button
              type="button"
              className="usr-btn"
              disabled={exportando || !totalLista}
              onClick={() => void exportar()}
              title="Descarga lo que ves en la lista, con los filtros activos"
            >
              {exportando ? <Loader2 className="usr-spin" size={16} aria-hidden /> : <Download size={16} aria-hidden />}
              Exportar Excel
            </button>
          </div>

          <div className="fw-seg-filtros">
            <label className="fw-seg-buscar">
              <span className="fw-sr">Buscar por nombre, número de control, folio o QR</span>
              <Search size={16} aria-hidden />
              <input
                type="search"
                className="fw-input"
                placeholder="Buscar por nombre, No. control, folio o QR"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            {esPendientes ? (
              <label className="fw-seg-estado-campo">
                <span className="fw-sr">Filtrar por estado</span>
                <select
                  className="fw-input fw-seg-estado"
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value as EstadoPendienteFamiliaWinston | '')}
                >
                  <option value="">Todos los estados ({pendientes.length})</option>
                  {conteoEstados.map(([e, n]) => (
                    <option key={e} value={e}>
                      {ESTADOS[e].texto} ({n})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hayFiltros ? (
              <button type="button" className="fw-btn-link" onClick={limpiarFiltros}>
                <FilterX size={14} aria-hidden /> Quitar filtros
              </button>
            ) : null}
          </div>
          {!esPendientes && resumen.meses.length ? (
            <div className="fw-seg-meses" role="group" aria-label="Colegiaturas condonadas por mes">
              <span className="fw-sub">Condonadas por mes:</span>
              {resumen.meses.map(([mes, n]) => (
                <span key={mes} className="fw-chip">
                  {mes}: {n}
                </span>
              ))}
            </div>
          ) : null}

          {esPendientes ? (
            listaPendientes.length === 0 ? (
              /* 2026-10-06 — Vacío compuesto: distingue «no hay nada» de «los filtros no encuentran nada». */
              <div className="fw-vacio">
                {hayFiltros ? <SearchX size={32} aria-hidden /> : <Inbox size={32} aria-hidden />}
                <p className="fw-vacio-encab">
                  {hayFiltros ? 'Ningún comprobante coincide' : 'No hay comprobantes pendientes'}
                </p>
                <p>
                  {hayFiltros
                    ? 'Prueba con otro nombre, folio o estado.'
                    : `Todo lo recibido de ${nombreCicloFiltro} ya se aplicó. Los nuevos comprobantes aparecerán aquí.`}
                </p>
                {hayFiltros ? (
                  <button type="button" className="usr-btn" onClick={limpiarFiltros}>
                    <FilterX size={16} aria-hidden /> Quitar filtros
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="fw-tabla-wrap">
                <table className="fw-tabla fw-tabla--seg">
                  <caption className="fw-sr">Comprobantes que faltan por aplicar</caption>
                  <thead>
                    <tr>
                      <th scope="col">Comprobante</th>
                      <th scope="col">Recomienda</th>
                      <th scope="col">Interesado / recomendado</th>
                      <th scope="col">Ciclo</th>
                      <th scope="col">Estado y qué sigue</th>
                      <th scope="col">
                        <span className="fw-sr">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaPendientes.map((f) => {
                      const est = f.estado ? ESTADOS[f.estado] : null
                      return (
                        <tr key={f.id} className={f.estado === 'listo' ? 'fw-fila--lista' : undefined}>
                          <td data-label="Comprobante" className="fw-seg-celda-id">
                            <strong>{f.folio}</strong>
                            <span className="fw-sub">QR {f.qr}</span>
                            <span className="fw-sub">{f.fechaReal ? fechaCorta(f.fechaReal) : 'Migrado (sin fecha)'}</span>
                          </td>
                          <td data-label="Recomienda">
                            <span className="fw-nombre">{f.recomendador?.nombre ?? '—'}</span>
                            <span className="fw-sub">
                              No. control {f.ctrl}
                              {f.recomendador ? ` · ${gradoTexto(f.recomendador)}` : ''}
                            </span>
                            {f.recomendador ? (
                              <span className={`fw-chip ${f.recomendador.activo ? 'fw-chip--ok' : 'fw-chip--err'}`}>
                                {f.recomendador.activo ? 'Activo' : 'Baja'}
                              </span>
                            ) : null}
                          </td>
                          <td data-label="Interesado / recomendado">
                            {f.interesadoNombre ? (
                              <>
                                <span className="fw-nombre">{f.interesadoNombre}</span>
                                {f.interesadoNivelGrado ? (
                                  <span className="fw-sub">{f.interesadoNivelGrado}</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="fw-sub">Sin interesado guardado</span>
                            )}
                            {f.recomendado ? (
                              <span className="fw-sub fw-seg-recomendado">
                                Inscrito: {f.recomendado.nombre} ({f.recomendado.ref})
                              </span>
                            ) : f.sugerencias.length ? (
                              <span className="fw-sub">
                                {f.fuenteRecomendado === 'apellido' ? 'Posibles por apellido: ' : 'Posibles: '}
                                {f.sugerencias.map((s) => `${s.nombre} (${s.ref})`).join(', ')}
                              </span>
                            ) : null}
                          </td>
                          <td data-label="Ciclo">
                            {nombreCiclo(f.ciclo)}
                            {f.cicloOrigen != null && f.cicloOrigen !== f.ciclo ? (
                              <span className="fw-sub">
                                Recomendación de {nombreCiclo(f.cicloOrigen)}{' '}
                                {f.fuenteCicloOrigen ? FUENTE_ORIGEN[f.fuenteCicloOrigen] : ''}
                              </span>
                            ) : null}
                          </td>
                          <td data-label="Estado y qué sigue" className="fw-seg-celda-estado">
                            {est ? <span className={`fw-chip fw-chip--punto fw-chip--${est.tono}`}>{est.texto}</span> : '—'}
                            {f.detalle ? <span className="fw-sub fw-seg-detalle">{f.detalle}</span> : null}
                            {f.estado === 'faltan-dias' && f.fechaDisponible ? (
                              <span className="fw-sub">Disponible desde el {fechaCorta(f.fechaDisponible)}</span>
                            ) : null}
                            {f.estado ? <span className="fw-sub fw-seg-siguiente">{SIGUIENTE[f.estado]}</span> : null}
                          </td>
                          <td data-label="Acción" className="fw-seg-accion">
                            <button
                              type="button"
                              className={`usr-btn ${f.estado === 'listo' ? 'usr-btn--primary' : ''}`}
                              onClick={() => onValidar(f.qr, f.ctrl)}
                              title="Abrir el validador con este comprobante"
                              aria-label={`Validar el comprobante ${f.folio}`}
                            >
                              <QrCode size={15} aria-hidden /> Validar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : listaAplicados.length === 0 ? (
            <div className="fw-vacio">
              {hayFiltros ? <SearchX size={32} aria-hidden /> : <Inbox size={32} aria-hidden />}
              <p className="fw-vacio-encab">
                {hayFiltros ? 'Ningún beneficio coincide' : 'Todavía no hay beneficios aplicados'}
              </p>
              <p>
                {hayFiltros
                  ? 'Prueba con otro nombre, folio o referencia de pago.'
                  : `En ${nombreCicloFiltro} aún no se aplica ningún beneficio. Cuando valides uno, quedará registrado aquí.`}
              </p>
              {hayFiltros ? (
                <button type="button" className="usr-btn" onClick={limpiarFiltros}>
                  <FilterX size={16} aria-hidden /> Quitar filtros
                </button>
              ) : (
                <button type="button" className="usr-btn" onClick={() => onCambiarVista('pendientes')}>
                  <Hourglass size={16} aria-hidden /> Ver pendientes
                </button>
              )}
            </div>
          ) : (
            <div className="fw-tabla-wrap">
              <table className="fw-tabla fw-tabla--seg">
                <caption className="fw-sr">Beneficios aplicados</caption>
                <thead>
                  <tr>
                    <th scope="col">Comprobante</th>
                    <th scope="col">Recibió el beneficio</th>
                    <th scope="col">Recomendó a</th>
                    <th scope="col">Colegiatura condonada</th>
                    <th scope="col">Validó</th>
                    <th scope="col">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {listaAplicados.map((f) => (
                    <tr key={f.id}>
                      <td data-label="Comprobante" className="fw-seg-celda-id">
                        <strong>{f.folio}</strong>
                        <span className="fw-sub">QR {f.qr}</span>
                      </td>
                      <td data-label="Recibió el beneficio">
                        <span className="fw-nombre">{f.recomendador?.nombre ?? '—'}</span>
                        <span className="fw-sub">
                          No. control {f.ctrl}
                          {f.recomendador ? ` · ${gradoTexto(f.recomendador)}` : ''}
                        </span>
                      </td>
                      <td data-label="Recomendó a">
                        <span className="fw-nombre">{f.recomendado?.nombre ?? f.interesadoNombre ?? '—'}</span>
                        {f.recomendado ? <span className="fw-sub">No. control {f.recomendado.ref}</span> : null}
                      </td>
                      <td data-label="Colegiatura condonada">
                        <span className="fw-nombre">
                          {f.mes ? `${f.mes} ${nombreCiclo(f.ciclo)}` : f.sistemaAnterior ? 'Sistema anterior' : '—'}
                        </span>
                        {f.pagoReferencia ? <span className="fw-sub">Ref. {f.pagoReferencia}</span> : null}
                        {f.sistemaAnterior && f.detalle ? <span className="fw-sub">{f.detalle}</span> : null}
                      </td>
                      <td data-label="Validó">
                        {f.validadoPor ?? '—'}
                        <span className="fw-sub">{fmtFechaHora(f.validadoEn)}</span>
                      </td>
                      <td data-label="Correo">
                        <span
                          className={`fw-chip fw-chip--punto ${
                            f.correoEnviadoEn ? 'fw-chip--ok' : f.correoResultado ? 'fw-chip--err' : 'fw-chip--neutro'
                          }`}
                          title={f.correoResultado ?? undefined}
                        >
                          {correoTexto(f)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : cargando ? (
        /* 2026-10-06 — Esqueleto de la lista mientras llegan los datos. */
        <section className="servicios-panel-card fw-card" aria-hidden>
          <div className="fw-skel fw-skel--cab" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="fw-skel fw-skel--fila" />
          ))}
        </section>
      ) : null}
    </div>
  )
}
