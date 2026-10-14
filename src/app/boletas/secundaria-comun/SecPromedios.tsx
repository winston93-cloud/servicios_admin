'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import { NumeroAnimado } from '@/components/boletas-motion'
import { SECUNDARIA_GRADOS, SECUNDARIA_GRUPOS, etiquetaGradoSec, fmtTrunc } from '@/lib/boletasSecundariaCatalog'
import type { SecDivisores, SecPromedioAlumno, SecPromedioGrupo } from '@/lib/boletasSecundariaService'
import { Download, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'

type Periodo = '1' | '2' | '3' | 'final'
type Datos = { alumnos: SecPromedioAlumno[]; grupos: SecPromedioGrupo[]; divisores: SecDivisores }

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: '1', etiqueta: 'Trimestre 1' },
  { valor: '2', etiqueta: 'Trimestre 2' },
  { valor: '3', etiqueta: 'Trimestre 3' },
  { valor: 'final', etiqueta: 'Final del ciclo' },
]

function Lugar({ n }: { n: number | null }) {
  if (n == null) return <span className="sd-lugar">—</span>
  if (n <= 3) {
    return (
      <span className={`sd-medalla is-${n}`} title={['Oro', 'Plata', 'Bronce'][n - 1]}>
        {n}
      </span>
    )
  }
  return <span className="sd-lugar">{n}</span>
}

/** En el podio el promedio oficial sube hasta su valor; al terminar muestra el truncado exacto. */
function Prom({ v, podio = false }: { v: number | null; podio?: boolean }) {
  if (v == null) return <span className="sd-lugar">—</span>
  const oficial = fmtTrunc(v, 1)
  return (
    <>
      {podio ? (
        <NumeroAnimado className="sd-prom-oficial" valor={Number(oficial)} texto={oficial} decimales={1} />
      ) : (
        <span className="sd-prom-oficial">{oficial}</span>
      )}
      <span className="sd-prom-fino">{fmtTrunc(v, 3)}</span>
    </>
  )
}

function csv(filas: (string | number)[][]): string {
  return filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}

/** Promedios exactos por grado y grupo para medallas: Winston (ranking) y SET, truncados como el legacy. */
export default function SecPromedios({ ciclo, etiquetaCiclo }: { ciclo: number; etiquetaCiclo: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('final')
  const [grado, setGrado] = useState(1)
  const [grupo, setGrupo] = useState('')
  const [soloPodio, setSoloPodio] = useState(false)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let vivo = true
    setDatos(null)
    setErr('')
    kiApi<Datos>(`/api/boletas-secundaria/promedios?ciclo=${ciclo}&periodo=${periodo}&grado=${grado}`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'No se pudieron calcular los promedios.'))
    return () => {
      vivo = false
    }
  }, [ciclo, periodo, grado])

  const lugar = (a: SecPromedioAlumno) => (grupo ? a.lugarGrupo : a.lugarGrado)
  const alumnos = (datos?.alumnos ?? [])
    .filter((a) => a.grado === grado && (!grupo || a.grupo === grupo))
    .filter((a) => !soloPodio || (lugar(a) ?? 99) <= 3)
    .sort((a, b) => (lugar(a) ?? 9999) - (lugar(b) ?? 9999) || a.nombre.localeCompare(b.nombre, 'es'))
  const grupos = (datos?.grupos ?? []).filter((g) => g.grado === grado)
  const div = datos?.divisores[grado]
  const ambito = grupo ? `${etiquetaGradoSec(grado)} ${grupo}` : etiquetaGradoSec(grado)
  const periodoTxt = PERIODOS.find((p) => p.valor === periodo)?.etiqueta ?? ''

  function exportar() {
    const filas: (string | number)[][] = [
      ['Lugar en grado', 'Lugar en grupo', 'Matrícula', 'Alumno', 'Grado', 'Grupo', 'Winston oficial', 'Winston (3 dec.)', 'SET oficial', 'SET (3 dec.)', 'Materias sin calificación'],
      ...alumnos.map((a) => [
        a.lugarGrado ?? '',
        a.lugarGrupo ?? '',
        a.alumno_ref ?? '',
        a.nombre,
        etiquetaGradoSec(a.grado),
        a.grupo,
        fmtTrunc(a.winston, 1),
        fmtTrunc(a.winston, 3),
        fmtTrunc(a.set, 1),
        fmtTrunc(a.set, 3),
        a.faltan.join('; '),
      ]),
    ]
    const blob = new Blob(['\ufeff' + csv(filas)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `promedios_${ambito.replace(/[^\w]+/g, '')}_${periodo}_${etiquetaCiclo}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="ki-paper bm-panel">
      <div className="ki-filters bm-filters sd-no-print">
        <label>
          Periodo
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grado
          <select
            value={grado}
            onChange={(e) => {
              setGrado(Number(e.target.value))
              setGrupo('')
            }}
          >
            {SECUNDARIA_GRADOS.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grupo
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="">Todo el grado</option>
            {SECUNDARIA_GRUPOS.filter((g) => grupos.some((x) => x.grupo === g)).map((g) => (
              <option key={g} value={g}>
                {etiquetaGradoSec(grado)} {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mostrar
          <select value={soloPodio ? 'podio' : 'todos'} onChange={(e) => setSoloPodio(e.target.value === 'podio')}>
            <option value="todos">Todos los alumnos</option>
            <option value="podio">Solo lugares 1 a 3</option>
          </select>
        </label>
      </div>

      <div className="sd-panel-acciones sd-no-print">
        <button type="button" className="ki-btn" disabled={!alumnos.length} onClick={exportar}>
          <Download size={15} aria-hidden /> Descargar CSV
        </button>
        <button type="button" className="ki-btn ghost" disabled={!alumnos.length} onClick={() => window.print()}>
          <Printer size={15} aria-hidden /> Imprimir
        </button>
      </div>

      <h2 className="ki-seccion">
        {ambito} · {periodoTxt} · Ciclo {etiquetaCiclo}
      </h2>

      {err && <p className="ki-msg is-error">{err}</p>}
      {!datos && !err && <p className="ki-hint">Calculando promedios…</p>}

      {datos && grupos.length > 0 && (
        <div className="sd-resumen">
          {grupos.map((g) => (
            <div key={g.grupo} className={`sd-resumen-card sc-g-${g.grupo}`}>
              <strong>{g.etiqueta}</strong>
              <span>
                {g.alumnos} alumnos · Winston {fmtTrunc(g.winston, 3) || '—'} · SET {fmtTrunc(g.set, 3) || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {datos && (
        <div className="sd-tabla-wrap">
          <table className="sd-tabla">
            <thead>
              <tr>
                <th scope="col" className="centro">
                  Lugar {grupo ? 'grupo' : 'grado'}
                </th>
                <th scope="col">Alumno</th>
                <th scope="col">Grupo</th>
                <th scope="col" className="num" title="Promedio general Winston: decide el lugar">
                  Winston
                </th>
                <th scope="col" className="num" title="Promedio de materias oficiales SEP">
                  SET
                </th>
                <th scope="col" className="centro">
                  Lugar {grupo ? 'grado' : 'grupo'}
                </th>
                <th scope="col">Sin calificación</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => {
                const l = lugar(a)
                return (
                  <tr key={a.alumno_id} className={l != null && l <= 3 ? 'is-podio' : undefined}>
                    <td className="centro">
                      <Lugar n={l} />
                    </td>
                    <td>
                      {a.nombre}
                      {a.alumno_ref ? <span className="sd-prom-fino">Matrícula {a.alumno_ref}</span> : null}
                    </td>
                    <td className={`sc-g-${a.grupo}`}>
                      <span className="sd-chip">{a.grupo || '—'}</span>
                    </td>
                    <td className="num">
                      <Prom v={a.winston} podio={l != null && l <= 3} />
                    </td>
                    <td className="num">
                      <Prom v={a.set} />
                    </td>
                    <td className="centro">
                      <span className="sd-lugar">{(grupo ? a.lugarGrado : a.lugarGrupo) ?? '—'}</span>
                    </td>
                    <td>
                      {a.faltan.length > 0 && (
                        <span className="sd-faltan" title={a.faltan.join(', ')}>
                          {a.faltan.length} materia{a.faltan.length === 1 ? '' : 's'} (cuenta{a.faltan.length === 1 ? '' : 'n'} 0)
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {alumnos.length === 0 && (
                <tr>
                  <td colSpan={7} className="centro">
                    Sin alumnos con calificaciones en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {div && (
        <p className="sd-nota">
          Igual que la boleta legacy: se suman las calificaciones de las materias que cuentan (una materia sin calificación o con «-» cuenta 0) y
          se divide entre el total fijo de materias de {etiquetaGradoSec(grado)}: <strong>Winston ÷ {div.winston}</strong>, <strong>SET ÷ {div.set}</strong>.
          {periodo === 'final' ? ' En el final, cada materia aporta el promedio de sus trimestres capturados.' : ''} Siempre se trunca, nunca se
          redondea. El número grande es el oficial (1 decimal); el chico, 3 decimales para desempatar. El lugar se decide con Winston a 3 decimales;
          empates comparten lugar. Mindfulness no cuenta.
        </p>
      )}
    </section>
  )
}
