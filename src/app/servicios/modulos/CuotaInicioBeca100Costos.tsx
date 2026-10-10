'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { cuotaInicioBeca100 } from '@/lib/boucherCore'

type NivelFila = {
  nivel: number
  etiqueta: string
  total: number
  pct: number
  tieneFila: boolean
}

type Becado = { alumno_ref: number; nombre: string; nivel: number; beca: string }

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function pctValido(valor: string): number | null {
  if (valor.trim() === '') return 0
  const p = Number(valor)
  return Number.isFinite(p) && p >= 0 && p <= 100 ? p : null
}

export default function CuotaInicioBeca100Costos({ ciclo }: { ciclo: number | null }) {
  const { opcionesCatalogo } = useCicloEscolar()
  const [niveles, setNiveles] = useState<NivelFila[]>([])
  const [becados, setBecados] = useState<Becado[]>([])
  const [pcts, setPcts] = useState<Record<number, string>>({})
  const [cargando, setCargando] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const etiquetaCiclo = (valor: number) =>
    opcionesCatalogo.find((c) => c.valor === valor)?.etiqueta ?? `Ciclo ${valor}`

  const aplicar = (data: { niveles?: NivelFila[]; becados?: Becado[] }) => {
    const filas = data.niveles ?? []
    setNiveles(filas)
    setBecados(data.becados ?? [])
    setPcts(Object.fromEntries(filas.map((f) => [f.nivel, f.pct > 0 ? String(f.pct) : ''])))
  }

  const cargar = useCallback(async (cicloValor: number) => {
    setCargando(true)
    setCargado(false)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(`/api/costos/cuota-inicio-beca100?ciclo=${cicloValor}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          res.status === 401 || res.status === 403
            ? 'Tu sesión no es de personal (¿entraste al portal como papá en este navegador?). Cierra sesión y vuelve a entrar con tu usuario.'
            : (data.error ?? `Error ${res.status}`)
        )
      }
      aplicar(data)
      setCargado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (ciclo != null) void cargar(ciclo)
  }, [ciclo, cargar])

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ciclo == null) return
    const porcentajes: { nivel: number; pct: number }[] = []
    for (const n of niveles.filter((f) => f.tieneFila)) {
      const p = pctValido(pcts[n.nivel] ?? '')
      if (p == null) {
        setError(`El porcentaje de ${n.etiqueta} debe estar entre 0 y 100.`)
        return
      }
      porcentajes.push({ nivel: n.nivel, pct: p })
    }
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/costos/cuota-inicio-beca100', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo, porcentajes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar')
      aplicar(data)
      setMensaje(`Porcentajes para becados al 100% guardados para ${etiquetaCiclo(ciclo)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  const becadosPorNivel = (nivel: number) => becados.filter((b) => b.nivel === nivel).length

  return (
    <section className="ciclos-crud-form-card costos-usa-card" aria-labelledby="costos-beca100-titulo">
      <h2 id="costos-beca100-titulo" className="ciclos-crud-form-title">
        Cuota de inicio · Becados al 100% (hijos de maestros)
        {ciclo != null ? ` · ${etiquetaCiclo(ciclo)}` : ''}
      </h2>
      <p className="costos-field-hint">
        Solo a alumnos activos con beca autorizada del 100% en el ciclo se les cobra la Cuota de Inicio de Curso
        (concepto 00) con este porcentaje menos. Se calcula sobre la cuota total del ciclo, redondeado al peso. Al
        resto se le cobra la cuota total.
      </p>

      {cargando ? (
        <p className="ciclos-crud-loading">
          <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
          Cargando…
        </p>
      ) : !cargado ? (
        <p className="ciclos-crud-msg ciclos-crud-msg--error" role="alert">
          {error ?? 'No se pudo cargar la cuota de inicio para becados al 100%.'}
        </p>
      ) : (
        <form className="ciclos-crud-form" onSubmit={onGuardar}>
          <div className="costos-beca100-grid">
            {niveles.map((n) => {
              const p = pctValido(pcts[n.nivel] ?? '')
              const cobro = p != null ? cuotaInicioBeca100(n.total, p) : null
              return (
                <fieldset key={n.nivel} className="fd-fieldset costos-usa-pago">
                  <legend>{n.etiqueta}</legend>
                  {n.tieneFila ? (
                    <>
                      <div className="costos-beca100-fila">
                        <span>Cuota de inicio total</span>
                        <strong>{money(n.total)}</strong>
                      </div>
                      <div className="ciclos-crud-field">
                        <label htmlFor={`beca100-pct-${n.nivel}`}>Porcentaje que se baja (%)</label>
                        <input
                          id={`beca100-pct-${n.nivel}`}
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          inputMode="decimal"
                          value={pcts[n.nivel] ?? ''}
                          onChange={(e) => setPcts((f) => ({ ...f, [n.nivel]: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                      <div className="costos-beca100-fila costos-beca100-cobro">
                        <span>Se cobra a becados 100%</span>
                        <strong>{cobro != null ? money(cobro) : '—'}</strong>
                      </div>
                      <p className="costos-field-hint">
                        {cobro != null && p ? (
                          <>
                            Baja <strong>{money(n.total - cobro)}</strong> ·{' '}
                          </>
                        ) : null}
                        Aplica a <strong>{becadosPorNivel(n.nivel)}</strong> alumno(s)
                      </p>
                    </>
                  ) : (
                    <p className="costos-field-hint">
                      Este nivel aún no tiene precios en el ciclo. Captúralos primero en «Editar costos».
                    </p>
                  )}
                </fieldset>
              )
            })}
          </div>

          {mensaje ? (
            <p className="ciclos-crud-msg ciclos-crud-msg--ok" role="status">
              {mensaje}
            </p>
          ) : null}
          {error ? (
            <p className="ciclos-crud-msg ciclos-crud-msg--error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ciclos-crud-form-actions">
            <button
              type="submit"
              className="ciclos-crud-btn ciclos-crud-btn--primary"
              disabled={guardando || ciclo == null}
            >
              {guardando ? (
                <>
                  <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                <>
                  <Save size={18} aria-hidden />
                  Guardar porcentajes
                </>
              )}
            </button>
          </div>

          <details className="costos-beca100-lista">
            <summary>
              Alumnos con beca al 100% en {ciclo != null ? etiquetaCiclo(ciclo) : 'el ciclo'} ({becados.length})
            </summary>
            {becados.length ? (
              <div className="costos-beca100-tabla-wrap">
                <table className="costos-beca100-tabla">
                  <thead>
                    <tr>
                      <th>Control</th>
                      <th>Alumno</th>
                      <th>Nivel</th>
                      <th>Beca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {becados.map((b) => (
                      <tr key={b.alumno_ref}>
                        <td>{b.alumno_ref}</td>
                        <td>{b.nombre}</td>
                        <td>{niveles.find((n) => n.nivel === b.nivel)?.etiqueta ?? b.nivel}</td>
                        <td>{b.beca || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="costos-field-hint">No hay alumnos con beca al 100% autorizada en este ciclo.</p>
            )}
          </details>
        </form>
      )}
    </section>
  )
}
