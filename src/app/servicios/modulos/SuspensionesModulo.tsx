'use client'

import { useCallback, useMemo, useState } from 'react'
import { Ban, FileDown, Loader2, Mail, RefreshCw } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { ETIQUETAS_TIPO_SUSPENSION } from '@/lib/suspensionesAdeudos'
import type { AlumnoDeudorSuspension } from '@/lib/suspensionesService'

type TipoReporte = 1 | 2 | 3 | 4

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

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
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

  const cicloEfectivo = cicloReporte ?? cicloSeleccionado ?? cicloActualSistema ?? 22

  const generar = useCallback(async () => {
    setGenerando(true)
    setError(null)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setResultado(null)

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

  const enviarCorreos = useCallback(async () => {
    if (!resultado) return
    const elegidos = resultado.deudores.filter((d) => seleccion.has(d.alumnoId))
    if (!elegidos.length) {
      setError('Seleccione al menos un alumno para enviar correo.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/suspensiones/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantel: resultado.plantel,
          tipo: resultado.tipo,
          fechaCartas: resultado.fechaCartas,
          alumnos: elegidos.map((d) => ({
            alumnoId: d.alumnoId,
            alumnoRef: d.alumnoRef,
            nombre: d.nombre,
            nivel: d.nivel,
            adeudos: d.adeudos,
            emails: d.emails,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al enviar')
        return
      }
      alert(
        `Correos: ${data.resumen.enviados} enviados, ${data.resumen.errores} errores, ${data.resumen.sinCorreo} sin correo.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setEnviando(false)
    }
  }, [resultado, seleccion])

  const toggleAlumno = (id: number) => {
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

  return (
    <div className="servicios-panel-inner sus-modulo">
      <header className="sus-encabezado">
        <div className="sus-encabezado-icono" aria-hidden>
          <Ban size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="sus-titulo">Suspensiones</h1>
          <p className="sus-lead">
            Reporte de alumnos deudores y envío de aviso de suspensión. Niveles 1–2: plantel
            Educativo; 3–4: Winston Churchill. Colegiaturas según plan de 10 u 11 meses más cuota
            de inicio (00) y material de enero (16).
          </p>
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
          >
            <option value={1}>Instituto Educativo Winston (niveles 1–2)</option>
            <option value={2}>Instituto Winston Churchill (niveles 3–4)</option>
          </select>

          <label className="sus-label" htmlFor="sus-tipo">
            Pagos pendientes
          </label>
          <select
            id="sus-tipo"
            className="sus-select"
            value={tipo}
            onChange={(e) => setTipo(Number(e.target.value) as TipoReporte)}
          >
            {(Object.entries(ETIQUETAS_TIPO_SUSPENSION) as [string, string][]).map(
              ([k, label]) => (
                <option key={k} value={k} disabled={k === '1'}>
                  {label}
                  {k === '1' ? ' (próximamente)' : ''}
                </option>
              )
            )}
          </select>

          <label className="sus-label" htmlFor="sus-ciclo">
            Ciclo escolar
          </label>
          <select
            id="sus-ciclo"
            className="sus-select"
            value={cicloEfectivo}
            onChange={(e) => setCicloReporte(Number(e.target.value))}
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
          />

          <button
            type="button"
            className="sus-btn sus-btn--primario"
            disabled={generando || tipo === 1}
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
            <button
              type="button"
              className="sus-btn sus-btn--primario"
              disabled={enviando || !resultado.deudores.length}
              onClick={() => void enviarCorreos()}
            >
              {enviando ? (
                <>
                  <Loader2 className="sus-spin" size={18} aria-hidden />
                  Enviando…
                </>
              ) : (
                <>
                  <Mail size={18} aria-hidden />
                  Enviar correos de suspensión ({seleccion.size})
                </>
              )}
            </button>
          </div>

          <div className="sus-tabla-wrap">
            <table className="sus-tabla">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={todosSeleccionados}
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
                  <th>Prórroga</th>
                  <th>Correo</th>
                </tr>
              </thead>
              <tbody>
                {resultado.deudores.map((d, i) => (
                  <tr key={d.alumnoId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccion.has(d.alumnoId)}
                        onChange={() => toggleAlumno(d.alumnoId)}
                        aria-label={`Enviar a ${d.nombre}`}
                      />
                    </td>
                    <td>{i + 1}</td>
                    <td>{d.alumnoRef}</td>
                    <td>{d.nombre}</td>
                    <td>{d.gradoEtiqueta}</td>
                    <td className="sus-deudas">{d.adeudos}</td>
                    <td>{d.prorroga ?? '—'}</td>
                    <td>{d.emails.length ? d.emails.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
