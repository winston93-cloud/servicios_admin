'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  FileDown,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  ETIQUETAS_TIPO_SUSPENSION,
  TIPOS_SUSPENSION_UI,
} from '@/lib/suspensionesAdeudos'
import {
  SUSPENSIONES_CORREO_PRUEBA,
  SUSPENSIONES_ENVIO_MODO_PRUEBA,
} from '@/lib/suspensionesEnvioConfig'
import {
  claseEstadoEnvioSuspension,
  claseFilaEnvioSuspension,
  etiquetaEstadoEnvioSuspension,
  type EstadoEnvioSuspension,
  type EstadoFilaEnvio,
} from '@/lib/suspensionesEnvioUi'
import type { AlumnoDeudorSuspension } from '@/lib/suspensionesService'

type TipoReporte = 1 | 2 | 3 | 4

/** Pausa entre correos (Gmail limita ~1 msg / 2 s en emailServicios). */
const PAUSA_ENTRE_CORREOS_MS = 2200

interface ResultadoGenerar {
  ok: boolean
  deudores: AlumnoDeudorSuspension[]
  totalAlumnosRevisados: number
  pdfListaBase64: string
  cicloEscolar: number
  cicloLargo: number
  plantel: 1 | 2
  tipo: TipoReporte
  fechaCartas: string
}

interface ResumenEnvio {
  enviados: number
  errores: number
  total: number
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export default function SuspensionesModulo() {
  const { cicloSeleccionado, cicloActualSistema, opcionesCatalogo } = useCicloEscolar()
  const [plantel, setPlantel] = useState<1 | 2>(2)
  const [tipo, setTipo] = useState<TipoReporte>(3)
  const [fechaCartas, setFechaCartas] = useState(hoyIso())
  const [cicloReporte, setCicloReporte] = useState<number | null>(null)
  const [generando, setGenerando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoGenerar | null>(null)
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const [panelConfirmarEnvio, setPanelConfirmarEnvio] = useState(false)
  const [estadosEnvio, setEstadosEnvio] = useState<Map<number, EstadoFilaEnvio>>(new Map())
  const [progresoEnvio, setProgresoEnvio] = useState<{
    actual: number
    total: number
    nombre: string
  } | null>(null)
  const [resumenEnvio, setResumenEnvio] = useState<ResumenEnvio | null>(null)
  const [faseEnvio, setFaseEnvio] = useState<'idle' | 'enviando' | 'hecho'>('idle')

  const filaRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
  const cancelarEnvioRef = useRef(false)

  const cicloEfectivo = cicloReporte ?? cicloSeleccionado ?? cicloActualSistema ?? 22

  const elegidos = useMemo(() => {
    if (!resultado) return []
    return resultado.deudores.filter((d) => seleccion.has(d.alumnoId))
  }, [resultado, seleccion])

  const contadoresEnvio = useMemo(() => {
    let ok = 0
    let err = 0
    let pendiente = 0
    for (const e of estadosEnvio.values()) {
      if (e.estado === 'ok') ok++
      else if (e.estado === 'error') err++
      else if (e.estado === 'pendiente' || e.estado === 'enviando') pendiente++
    }
    return { ok, err, pendiente }
  }, [estadosEnvio])

  const actualizarEstadoFila = useCallback((alumnoId: number, parcial: EstadoFilaEnvio) => {
    setEstadosEnvio((prev) => {
      const next = new Map(prev)
      next.set(alumnoId, parcial)
      return next
    })
    requestAnimationFrame(() => {
      filaRefs.current.get(alumnoId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [])

  const generar = useCallback(async () => {
    setGenerando(true)
    setError(null)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setResultado(null)
    setEstadosEnvio(new Map())
    setResumenEnvio(null)
    setFaseEnvio('idle')
    setProgresoEnvio(null)
    setPanelConfirmarEnvio(false)

    try {
      const res = await fetch('/api/suspensiones/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantel,
          tipo,
          fechaCartas,
          cicloEscolar: cicloEfectivo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        return
      }
      setResultado(data as ResultadoGenerar)
      const ids = new Set((data.deudores as AlumnoDeudorSuspension[]).map((d) => d.alumnoId))
      setSeleccion(ids)
      const bin = atob(data.pdfListaBase64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      setPdfUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setGenerando(false)
    }
  }, [plantel, tipo, fechaCartas, cicloEfectivo, pdfUrl])

  const enviarCorreosSecuencial = useCallback(async () => {
    if (!resultado || !elegidos.length) return

    setPanelConfirmarEnvio(false)
    setEnviando(true)
    setError(null)
    setResumenEnvio(null)
    setFaseEnvio('enviando')
    cancelarEnvioRef.current = false

    const mapaInicial = new Map<number, EstadoFilaEnvio>()
    for (const d of elegidos) {
      mapaInicial.set(d.alumnoId, { estado: 'pendiente', mensaje: 'En cola' })
    }
    setEstadosEnvio(mapaInicial)

    let enviados = 0
    let errores = 0

    for (let i = 0; i < elegidos.length; i++) {
      if (cancelarEnvioRef.current) break

      const d = elegidos[i]
      setProgresoEnvio({ actual: i, total: elegidos.length, nombre: d.nombre })
      actualizarEstadoFila(d.alumnoId, { estado: 'enviando', mensaje: 'Generando carta y enviando…' })

      try {
        const res = await fetch('/api/suspensiones/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plantel: resultado.plantel,
            tipo: resultado.tipo,
            fechaCartas: resultado.fechaCartas,
            alumnos: [
              {
                alumnoId: d.alumnoId,
                alumnoRef: d.alumnoRef,
                nombre: d.nombre,
                nivel: d.nivel,
                adeudos: d.adeudos,
                emails: d.emails,
              },
            ],
          }),
        })
        const data = await res.json()
        const detalle = data.detalle?.[0] as { ok?: boolean; mensaje?: string } | undefined

        if (res.ok && detalle?.ok) {
          enviados++
          actualizarEstadoFila(d.alumnoId, {
            estado: 'ok',
            mensaje: detalle.mensaje ?? 'Enviado',
          })
        } else {
          errores++
          actualizarEstadoFila(d.alumnoId, {
            estado: 'error',
            mensaje: detalle?.mensaje ?? data.error ?? 'Error al enviar',
          })
        }
      } catch (e) {
        errores++
        actualizarEstadoFila(d.alumnoId, {
          estado: 'error',
          mensaje: e instanceof Error ? e.message : 'Error de red',
        })
      }

      setProgresoEnvio({ actual: i + 1, total: elegidos.length, nombre: d.nombre })

      if (i < elegidos.length - 1 && !cancelarEnvioRef.current) {
        await sleep(PAUSA_ENTRE_CORREOS_MS)
      }
    }

    setProgresoEnvio(null)
    setFaseEnvio('hecho')
    setResumenEnvio({
      enviados,
      errores,
      total: elegidos.length,
    })
    setEnviando(false)
  }, [resultado, elegidos, actualizarEstadoFila])

  const reenviarErrores = useCallback(async () => {
    if (!resultado) return
    const conError = resultado.deudores.filter((d) => estadosEnvio.get(d.alumnoId)?.estado === 'error')
    if (!conError.length) return
    setSeleccion(new Set(conError.map((d) => d.alumnoId)))
    setPanelConfirmarEnvio(true)
  }, [resultado, estadosEnvio])

  const toggleAlumno = (id: number) => {
    if (enviando) return
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const todosSeleccionados = useMemo(() => {
    if (!resultado?.deudores.length) return false
    return resultado.deudores.every((d) => seleccion.has(d.alumnoId))
  }, [resultado, seleccion])

  const porcentajeProgreso =
    progresoEnvio && progresoEnvio.total > 0
      ? Math.round((progresoEnvio.actual / progresoEnvio.total) * 100)
      : 0

  return (
    <div className="servicios-panel-inner sus-modulo">
      <header className="sus-encabezado">
        <div className="sus-encabezado-icono" aria-hidden>
          <Ban size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="sus-titulo">Suspensiones</h1>
        </div>
      </header>

      <div className="sus-layout">
        <section className="sus-form-card">
          <h2 className="sus-subtitulo">Reporte de alumnos deudores</h2>

          <label className="sus-label" htmlFor="sus-plantel">
            Institución
          </label>
          <select
            id="sus-plantel"
            className="sus-select"
            value={plantel}
            onChange={(e) => setPlantel(Number(e.target.value) as 1 | 2)}
            disabled={enviando}
          >
            <option value={1}>Instituto Educativo Winston</option>
            <option value={2}>Instituto Winston Churchill</option>
          </select>

          <label className="sus-label" htmlFor="sus-tipo">
            Pagos pendientes
          </label>
          <select
            id="sus-tipo"
            className="sus-select"
            value={tipo}
            onChange={(e) => setTipo(Number(e.target.value) as TipoReporte)}
            disabled={enviando}
          >
            {TIPOS_SUSPENSION_UI.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO_SUSPENSION[t]}
              </option>
            ))}
          </select>

          <label className="sus-label" htmlFor="sus-ciclo">
            Ciclo escolar
          </label>
          <select
            id="sus-ciclo"
            className="sus-select"
            value={cicloEfectivo}
            onChange={(e) => setCicloReporte(Number(e.target.value))}
            disabled={enviando}
          >
            {opcionesCatalogo.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
                {o.valor === cicloActualSistema ? ' (activo)' : ''}
              </option>
            ))}
          </select>

          <label className="sus-label" htmlFor="sus-fecha">
            Fecha para las cartas
          </label>
          <input
            id="sus-fecha"
            type="date"
            className="sus-input"
            value={fechaCartas}
            onChange={(e) => setFechaCartas(e.target.value)}
            disabled={enviando}
          />

          <button
            type="button"
            className="sus-btn sus-btn--primario"
            disabled={generando || enviando}
            onClick={() => void generar()}
          >
            {generando ? (
              <>
                <Loader2 className="sus-spin" size={18} aria-hidden />
                Generando…
              </>
            ) : (
              <>
                <RefreshCw size={18} aria-hidden />
                Generar reporte
              </>
            )}
          </button>
        </section>

        <section className="sus-preview-card">
          {pdfUrl ? (
            <>
              <div className="sus-preview-toolbar">
                <a
                  href={pdfUrl}
                  download={`deudores_${plantel === 1 ? 'IEW' : 'IWC'}_${fechaCartas}.pdf`}
                  className="sus-btn sus-btn--secundario"
                >
                  <FileDown size={16} aria-hidden />
                  Descargar PDF lista
                </a>
              </div>
              <iframe
                title="Vista previa reporte suspensiones"
                src={pdfUrl}
                className="sus-pdf-frame"
              />
            </>
          ) : (
            <p className="sus-preview-vacio">
              La vista previa del PDF aparecerá aquí después de generar el reporte.
            </p>
          )}
        </section>
      </div>

      {SUSPENSIONES_ENVIO_MODO_PRUEBA && (
        <div className="sus-alerta sus-alerta--aviso" role="status">
          <strong>Modo prueba de correos activo.</strong> Los avisos solo se envían a{' '}
          <code>{SUSPENSIONES_CORREO_PRUEBA}</code>. El envío a papás está deshabilitado.
        </div>
      )}

      {error && (
        <div className="sus-alerta sus-alerta--error" role="alert">
          {error}
        </div>
      )}

      {resultado && (
        <section className="sus-tabla-section">
          <div className="sus-tabla-head">
            <p className="sus-resumen">
              {resultado.deudores.length} deudor(es) de {resultado.totalAlumnosRevisados}{' '}
              alumnos revisados · {ETIQUETAS_TIPO_SUSPENSION[resultado.tipo]}
            </p>
            <div className="sus-tabla-acciones">
              {faseEnvio === 'hecho' && contadoresEnvio.err > 0 && (
                <button
                  type="button"
                  className="sus-btn sus-btn--secundario"
                  disabled={enviando}
                  onClick={() => void reenviarErrores()}
                >
                  <RotateCcw size={16} aria-hidden />
                  Reintentar errores ({contadoresEnvio.err})
                </button>
              )}
              <button
                type="button"
                className="sus-btn sus-btn--primario"
                disabled={enviando || !elegidos.length}
                onClick={() => setPanelConfirmarEnvio(true)}
              >
                {enviando ? (
                  <>
                    <Loader2 className="sus-spin" size={18} aria-hidden />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Mail size={18} aria-hidden />
                    {SUSPENSIONES_ENVIO_MODO_PRUEBA
                      ? `Enviar prueba (${elegidos.length})`
                      : `Enviar correos (${elegidos.length})`}
                  </>
                )}
              </button>
            </div>
          </div>

          {panelConfirmarEnvio && !enviando && (
            <div className="sus-envio-panel" role="dialog" aria-labelledby="sus-envio-titulo">
              <h3 id="sus-envio-titulo" className="sus-envio-panel-titulo">
                Confirmar envío
              </h3>
              <p className="sus-envio-panel-texto">
                Se enviarán <strong>{elegidos.length}</strong> carta(s) de suspensión.
                {SUSPENSIONES_ENVIO_MODO_PRUEBA && (
                  <>
                    {' '}
                    En modo prueba todo llega a <code>{SUSPENSIONES_CORREO_PRUEBA}</code>; ningún
                    papá recibirá correo.
                  </>
                )}
              </p>
              <div className="sus-envio-panel-acciones">
                <button
                  type="button"
                  className="sus-btn sus-btn--secundario"
                  onClick={() => setPanelConfirmarEnvio(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="sus-btn sus-btn--primario"
                  onClick={() => void enviarCorreosSecuencial()}
                >
                  <Mail size={16} aria-hidden />
                  Iniciar envío
                </button>
              </div>
            </div>
          )}

          {(enviando || faseEnvio === 'hecho') && (
            <div
              className={`sus-envio-progreso ${faseEnvio === 'hecho' ? 'sus-envio-progreso--hecho' : ''}`}
              role="status"
              aria-live="polite"
            >
              {enviando && progresoEnvio && (
                <>
                  <div className="sus-envio-progreso-top">
                    <span className="sus-envio-progreso-label">
                      Enviando {progresoEnvio.actual + 1} de {progresoEnvio.total}
                    </span>
                    <span className="sus-envio-progreso-pct">{porcentajeProgreso}%</span>
                  </div>
                  <div className="sus-envio-barra" aria-hidden>
                    <div
                      className="sus-envio-barra-fill"
                      style={{ width: `${porcentajeProgreso}%` }}
                    />
                  </div>
                  <p className="sus-envio-progreso-nombre">{progresoEnvio.nombre}</p>
                  <button
                    type="button"
                    className="sus-envio-cancelar"
                    onClick={() => {
                      cancelarEnvioRef.current = true
                    }}
                  >
                    Detener después del actual
                  </button>
                </>
              )}

              {faseEnvio === 'hecho' && resumenEnvio && (
                <div className="sus-envio-resumen">
                  <CheckCircle2 size={22} className="sus-envio-resumen-icono sus-envio-resumen-icono--ok" aria-hidden />
                  <div>
                    <p className="sus-envio-resumen-titulo">Envío terminado</p>
                    <div className="sus-envio-chips">
                      <span className="sus-envio-chip sus-envio-chip--ok">
                        {resumenEnvio.enviados} enviado(s)
                      </span>
                      {resumenEnvio.errores > 0 && (
                        <span className="sus-envio-chip sus-envio-chip--error">
                          {resumenEnvio.errores} error(es)
                        </span>
                      )}
                    </div>
                    {SUSPENSIONES_ENVIO_MODO_PRUEBA && (
                      <p className="sus-envio-resumen-nota">
                        Modo prueba: correos a {SUSPENSIONES_CORREO_PRUEBA}. Ningún papá fue
                        contactado.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(enviando || faseEnvio === 'hecho') && estadosEnvio.size > 0 && (
                <div className="sus-envio-chips sus-envio-chips--inline">
                  <span className="sus-envio-chip sus-envio-chip--ok">{contadoresEnvio.ok} ok</span>
                  {contadoresEnvio.err > 0 && (
                    <span className="sus-envio-chip sus-envio-chip--error">
                      {contadoresEnvio.err} error
                    </span>
                  )}
                  {contadoresEnvio.pendiente > 0 && (
                    <span className="sus-envio-chip sus-envio-chip--pendiente">
                      {contadoresEnvio.pendiente} pendiente
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="sus-tabla-wrap">
            <table className="sus-tabla">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={todosSeleccionados}
                      disabled={enviando}
                      onChange={() => {
                        if (todosSeleccionados) setSeleccion(new Set())
                        else
                          setSeleccion(
                            new Set(resultado.deudores.map((d) => d.alumnoId))
                          )
                      }}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th>#</th>
                  <th>Control</th>
                  <th>Nombre</th>
                  <th>Grado</th>
                  <th>Deudas</th>
                  <th>Envío</th>
                  <th>Prórroga</th>
                  <th>Correo</th>
                </tr>
              </thead>
              <tbody>
                {resultado.deudores.map((d, i) => {
                  const filaEstado = estadosEnvio.get(d.alumnoId)
                  const estado: EstadoEnvioSuspension = filaEstado?.estado ?? 'idle'
                  return (
                    <tr
                      key={d.alumnoId}
                      ref={(el) => {
                        if (el) filaRefs.current.set(d.alumnoId, el)
                        else filaRefs.current.delete(d.alumnoId)
                      }}
                      className={claseFilaEnvioSuspension(estado)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccion.has(d.alumnoId)}
                          disabled={enviando}
                          onChange={() => toggleAlumno(d.alumnoId)}
                          aria-label={`Enviar a ${d.nombre}`}
                        />
                      </td>
                      <td>{i + 1}</td>
                      <td>{d.alumnoRef}</td>
                      <td>{d.nombre}</td>
                      <td>{d.gradoEtiqueta}</td>
                      <td className="sus-deudas">{d.adeudos}</td>
                      <td className="sus-celda-envio">
                        {estado === 'idle' ? (
                          <span className="sus-estado sus-estado--idle">—</span>
                        ) : (
                          <>
                            <span className={claseEstadoEnvioSuspension(estado)}>
                              {estado === 'ok' && (
                                <CheckCircle2 size={12} aria-hidden className="sus-estado-icono" />
                              )}
                              {estado === 'error' && (
                                <XCircle size={12} aria-hidden className="sus-estado-icono" />
                              )}
                              {estado === 'enviando' && (
                                <Loader2
                                  size={12}
                                  aria-hidden
                                  className="sus-spin sus-estado-icono"
                                />
                              )}
                              {etiquetaEstadoEnvioSuspension(estado)}
                            </span>
                            {filaEstado?.mensaje && (
                              <span className="sus-estado-detalle">{filaEstado.mensaje}</span>
                            )}
                          </>
                        )}
                      </td>
                      <td>{d.prorroga ?? '—'}</td>
                      <td>{d.emails.length ? d.emails.join(', ') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
