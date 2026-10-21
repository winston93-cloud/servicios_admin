'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import type { ClassroomResumen } from '@/lib/boletasPrimariaEnClassroom'
import { Link2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const CADA_MS = 3 * 60 * 1000

type AlumnoLista = { alumno_id: number; nombre: string }
type Respuesta = { classroom: ClassroomResumen | null; congelado: boolean }

function hora(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' })
}

/** Trae las calificaciones del trimestre desde Classroom al abrir la hoja y cada 3 min con la pestaña visible. */
export default function ClassroomBarra({
  url,
  params,
  alumnos,
  nota,
  onDatos,
}: {
  url: string
  /** Lo que identifica la hoja en el POST (grado/grupo/trimestre o materiaId/grupo/trimestre). */
  params: Record<string, string | number>
  alumnos: AlumnoLista[]
  /** Qué se llena desde Classroom y qué se captura a mano. */
  nota: string
  onDatos: () => void
}) {
  const [resumen, setResumen] = useState<ClassroomResumen | null>(null)
  const [congelado, setCongelado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [elegidos, setElegidos] = useState<Record<string, string>>({})
  const ultimo = useRef(0)
  const onDatosRef = useRef(onDatos)
  useEffect(() => {
    onDatosRef.current = onDatos
  })
  const paramsKey = JSON.stringify(params)

  const pedir = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      setCargando(true)
      setErr('')
      ultimo.current = Date.now()
      try {
        const r = await kiApi<Respuesta>(url, {
          method: 'POST',
          body: JSON.stringify({ accion: 'classroom', ...(JSON.parse(paramsKey) as object), ...extra }),
        })
        setResumen(r.classroom)
        setCongelado(r.congelado)
        if (r.classroom?.cambios || extra.accion === 'ligar') onDatosRef.current()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'No se pudo leer Classroom.')
      } finally {
        setCargando(false)
      }
    },
    [url, paramsKey]
  )

  useEffect(() => {
    setResumen(null)
    void pedir()
    const tick = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimo.current >= CADA_MS) void pedir()
    }
    const id = window.setInterval(tick, 30 * 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [pedir])

  async function ligar(googleId: string) {
    const alumnoId = Number(elegidos[googleId] ?? 0)
    if (!alumnoId) return
    await pedir({ accion: 'ligar', googleId, alumnoId })
  }

  const r = resumen
  return (
    <div className="bc-classroom" role="status" aria-live="polite">
      <div className="bc-classroom-fila">
        <p className="ki-hint">
          <strong>Classroom</strong>
          {r
            ? ` · ${congelado ? 'congelado desde el envío; última lectura' : 'actualizado'} ${hora(r.sincronizadoEn)}` +
              (r.clases.length ? ` · ${r.clases.length === 1 ? '1 clase' : `${r.clases.length} clases`} · ${r.calificaciones} calificaciones` : '')
            : cargando
              ? ' · leyendo calificaciones…'
              : ''}
        </p>
        {!congelado && (
          <button type="button" className="ki-btn ghost" disabled={cargando} onClick={() => void pedir({ forzar: true })}>
            <RefreshCw size={16} aria-hidden className={cargando ? 'bc-girando' : undefined} />
            {cargando ? 'Leyendo…' : 'Actualizar'}
          </button>
        )}
      </div>
      {r?.aviso && <p className="ki-msg is-error">{r.aviso}</p>}
      {err && <p className="ki-msg is-error">{err}</p>}
      {!congelado && r && r.clases.length > 0 && <p className="ki-hint bc-classroom-nota">{nota}</p>}
      {!congelado && r && r.sinLigar.length > 0 && (
        <details className="bc-classroom-ligar">
          <summary>
            <Link2 size={16} aria-hidden /> {r.sinLigar.length} alumno{r.sinLigar.length === 1 ? '' : 's'} de Classroom sin
            ligar a su boleta
          </summary>
          <ul>
            {r.sinLigar.map((s) => (
              <li key={s.googleId}>
                <span>{s.nombre || 'Sin nombre'}</span>
                <select
                  value={elegidos[s.googleId] ?? ''}
                  onChange={(e) => setElegidos((m) => ({ ...m, [s.googleId]: e.target.value }))}
                  aria-label={`Alumno del sistema para ${s.nombre}`}
                >
                  <option value="">Elige al alumno…</option>
                  {alumnos.map((a) => (
                    <option key={a.alumno_id} value={a.alumno_id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ki-btn primary"
                  disabled={cargando || !elegidos[s.googleId]}
                  onClick={() => void ligar(s.googleId)}
                >
                  Ligar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
