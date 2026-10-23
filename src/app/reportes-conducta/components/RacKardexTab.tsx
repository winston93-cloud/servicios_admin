'use client'

import { ChevronDown, FileDown, FileText, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  etiquetaVuelta,
  fechaKardex,
  pesoAlerta,
  type KardexAlerta,
  type KardexAlumno,
  type KardexGrupo,
  type KardexRenglon,
} from '@/lib/rac/racKardex'
import './rac-kardex.css'

export type KardexGrupoOpcion = {
  clave: string
  etiqueta: string
  /** Query string del grupo para `${apiBase}/kardex` (sin `?`). */
  query: string
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V']

const ETIQUETA_ALERTA: Record<KardexAlerta, string> = {
  sin: 'Sin reportes',
  baja: 'Aviso o Reporte I',
  media: 'Reporte II',
  alta: 'Reporte III o 2da vuelta',
}

async function leerError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return data.error || `Error ${res.status}`
}

function TablaKardex({
  titulo,
  renglones,
  columnas,
}: {
  titulo: string
  renglones: KardexRenglon[]
  columnas: number
}) {
  return (
    <div className="rk-tabla-wrap">
      <table className="rk-tabla">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Informes</th>
            <th scope="col">Aviso</th>
            {ROMANOS.slice(0, columnas).map((r) => (
              <th key={r} scope="col">
                Rep. {r}
              </th>
            ))}
            <th scope="col">Vuelta</th>
          </tr>
        </thead>
        <tbody>
          {renglones.map((r) => (
            <tr key={r.clave} data-activo={r.escalon >= 0 || Boolean(r.informes) ? '' : undefined}>
              <th scope="row">{r.etiqueta}</th>
              <td className="rk-num">{r.informes ? r.informes : ''}</td>
              <td className="rk-fecha" data-tono={r.aviso ? 0 : undefined} data-na={r.aviso === null ? '' : undefined}>
                {r.aviso === null ? '—' : fechaKardex(r.aviso)}
              </td>
              {Array.from({ length: columnas }, (_, i) => {
                const fecha = r.reportes[i]
                if (fecha === undefined) {
                  return (
                    <td key={i} className="rk-fecha" data-na="">
                      —
                    </td>
                  )
                }
                return (
                  <td key={i} className="rk-fecha" data-tono={fecha ? Math.min(i + 1, 3) : undefined}>
                    {fechaKardex(fecha)}
                  </td>
                )
              })}
              <td className="rk-vuelta">{etiquetaVuelta(r.vuelta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RacKardexTab({
  apiBase,
  grupos,
}: {
  apiBase: string
  grupos: KardexGrupoOpcion[]
}) {
  const [clave, setClave] = useState(grupos[0]?.clave ?? '')
  const [datos, setDatos] = useState<KardexGrupo | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [soloConReportes, setSoloConReportes] = useState(false)
  const [orden, setOrden] = useState<'lista' | 'atencion'>('lista')
  const [abierto, setAbierto] = useState(0)
  const [generando, setGenerando] = useState<number | 'grupo' | null>(null)

  const grupo = grupos.find((g) => g.clave === clave) ?? grupos[0]
  const query = grupo?.query ?? ''

  useEffect(() => {
    if (!query) return
    let cancelado = false
    setCargando(true)
    setError('')
    setAbierto(0)
    fetch(`${apiBase}/kardex?${query}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerError(res))
        return (await res.json()) as KardexGrupo
      })
      .then((d) => {
        if (!cancelado) setDatos(d)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setDatos(null)
        setError(e instanceof Error ? e.message : 'No se pudo cargar el kardex')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [apiBase, query])

  const abrirPdf = useCallback(
    async (alumno?: KardexAlumno) => {
      if (!query) return
      // Abrir la pestaña dentro del clic: si se abre después del fetch, el navegador la bloquea.
      const ventana = window.open('', '_blank')
      setGenerando(alumno ? alumno.alumno_id : 'grupo')
      setError('')
      try {
        const extra = alumno ? `&alumnoId=${alumno.alumno_id}` : ''
        const res = await fetch(`${apiBase}/kardex?${query}&formato=pdf${extra}`, { credentials: 'include' })
        if (!res.ok) throw new Error(await leerError(res))
        const url = URL.createObjectURL(await res.blob())
        if (ventana) {
          ventana.location.href = url
        } else {
          const a = document.createElement('a')
          a.href = url
          a.download = alumno ? `kardex-${alumno.alumno_ref || alumno.alumno_id}.pdf` : 'kardex-grupo.pdf'
          a.click()
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch (e) {
        ventana?.close()
        setError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
      } finally {
        setGenerando(null)
      }
    },
    [apiBase, query]
  )

  const resumen = useMemo(() => {
    const alumnos = datos?.alumnos ?? []
    return {
      total: alumnos.length,
      conReportes: alumnos.filter((a) => a.alerta !== 'sin').length,
      atencion: alumnos.filter((a) => pesoAlerta(a.alerta) >= pesoAlerta('media')).length,
    }
  }, [datos])

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase()
    const lista = (datos?.alumnos ?? []).filter((a) => {
      if (soloConReportes && a.alerta === 'sin' && !a.totalInformes) return false
      if (!term) return true
      return a.nombre.toLowerCase().includes(term) || a.alumno_ref.includes(term)
    })
    if (orden === 'atencion') {
      lista.sort(
        (a, b) =>
          pesoAlerta(b.alerta) - pesoAlerta(a.alerta) ||
          b.totalReportes - a.totalReportes ||
          a.nombre.localeCompare(b.nombre, 'es')
      )
    }
    return lista
  }, [datos, q, soloConReportes, orden])

  if (!grupos.length) {
    return (
      <section className="rk">
        <p className="rk-vacio">No hay grupos disponibles para tu cuenta.</p>
      </section>
    )
  }

  return (
    <section className="rk" aria-label="Kardex del alumno">
      <div className="rk-barra">
        <label className="rk-campo">
          <span>Grado y grupo</span>
          <select value={grupo?.clave ?? ''} onChange={(e) => setClave(e.target.value)}>
            {grupos.map((g) => (
              <option key={g.clave} value={g.clave}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rk-btn rk-btn--grupo"
          disabled={cargando || !datos?.alumnos.length || generando !== null}
          onClick={() => void abrirPdf()}
        >
          <FileDown size={18} aria-hidden />
          {generando === 'grupo' ? 'Generando…' : `Kardex de todo el grupo${datos ? ` (${datos.alumnos.length})` : ''}`}
        </button>
      </div>

      {datos ? (
        <div className="rk-stats" aria-live="polite">
          <div>
            <strong>{resumen.total}</strong>
            <span>alumnos en {datos.grupoEtiqueta}</span>
          </div>
          <div>
            <strong>{resumen.conReportes}</strong>
            <span>con aviso o reporte</span>
          </div>
          <div data-alerta={resumen.atencion ? 'alta' : undefined}>
            <strong>{resumen.atencion}</strong>
            <span>en Reporte II, III o 2da vuelta</span>
          </div>
        </div>
      ) : null}

      <div className="rk-filtros">
        <label className="rk-buscar">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar alumno o matrícula"
            aria-label="Buscar alumno o matrícula"
          />
        </label>
        <label className="rk-campo rk-campo--compacto">
          <span>Ordenar</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value as 'lista' | 'atencion')}>
            <option value="lista">Lista (A–Z)</option>
            <option value="atencion">Más atención primero</option>
          </select>
        </label>
        <label className="rk-check">
          <input type="checkbox" checked={soloConReportes} onChange={(e) => setSoloConReportes(e.target.checked)} />
          Solo con reportes
        </label>
      </div>

      {error ? <p className="rk-error">{error}</p> : null}
      {cargando ? <p className="rk-vacio">Cargando kardex…</p> : null}

      {!cargando && datos ? (
        visibles.length ? (
          <ul className="rk-lista">
            {visibles.map((a) => {
              const abiertoAqui = abierto === a.alumno_id
              return (
                <li key={a.alumno_id} className="rk-alumno" data-alerta={a.alerta}>
                  <button
                    type="button"
                    className="rk-alumno-main"
                    aria-expanded={abiertoAqui}
                    onClick={() => setAbierto(abiertoAqui ? 0 : a.alumno_id)}
                  >
                    <span className="rk-dot" title={ETIQUETA_ALERTA[a.alerta]} aria-label={ETIQUETA_ALERTA[a.alerta]} />
                    <span className="rk-nombre">
                      <strong>{a.nombre}</strong>
                      <small>
                        {a.alumno_ref ? `${a.alumno_ref} · ` : ''}
                        {a.totalReportes} {a.totalReportes === 1 ? 'reporte' : 'reportes'} · {a.totalInformes}{' '}
                        {a.totalInformes === 1 ? 'informe' : 'informes'}
                      </small>
                    </span>
                    <span className="rk-chips">
                      {a.destacados.slice(0, 2).map((d) => (
                        <span key={d} className="rk-chip">
                          {d}
                        </span>
                      ))}
                      {a.destacados.length > 2 ? (
                        <span className="rk-chip rk-chip--mas">+{a.destacados.length - 2}</span>
                      ) : null}
                    </span>
                    <ChevronDown className="rk-chevron" size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rk-btn rk-btn--alumno"
                    disabled={generando !== null}
                    onClick={() => void abrirPdf(a)}
                    aria-label={`Kardex de ${a.nombre} en PDF`}
                  >
                    <FileText size={16} aria-hidden />
                    {generando === a.alumno_id ? '…' : 'Kardex'}
                  </button>
                  {abiertoAqui ? (
                    <div className="rk-detalle">
                      <TablaKardex titulo="Académico" renglones={a.academico} columnas={3} />
                      <TablaKardex
                        titulo="Conductual y otros"
                        renglones={a.conductual}
                        columnas={datos.columnasConductual}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rk-vacio">{q || soloConReportes ? 'Ningún alumno coincide con el filtro.' : 'Sin alumnos en este grupo.'}</p>
        )
      ) : null}

      <p className="rk-leyenda">
        <span data-alerta="sin">Sin reportes</span>
        <span data-alerta="baja">Aviso o Reporte I</span>
        <span data-alerta="media">Reporte II</span>
        <span data-alerta="alta">Reporte III o 2da vuelta</span>
        <em>Solo reportes validados del ciclo; las fechas son de la última vuelta.</em>
      </p>
    </section>
  )
}
