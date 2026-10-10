'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'

type NivelFila = {
  nivel: number
  etiqueta: string
  anterior: number
  actual: number
  normal: number
  tieneFila: boolean
}

type Becado = { alumno_ref: number; nombre: string; nivel: number; beca: string }

type FormNivel = { monto: string; pct: string }

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function pctDesde(anterior: number, actual: number): string {
  if (!(anterior > 0) || !(actual > 0)) return ''
  return String(Math.round(((actual - anterior) / anterior) * 10000) / 100)
}

export default function CuotaInicioBeca100Costos({ ciclo }: { ciclo: number | null }) {
  const { opcionesCatalogo } = useCicloEscolar()
  const [niveles, setNiveles] = useState<NivelFila[]>([])
  const [becados, setBecados] = useState<Becado[]>([])
  const [form, setForm] = useState<Record<number, FormNivel>>({})
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
    setForm(
      Object.fromEntries(
        filas.map((f) => [f.nivel, { monto: String(f.actual), pct: pctDesde(f.anterior, f.actual) }])
      )
    )
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

  const onMonto = (fila: NivelFila, monto: string) => {
    setForm((f) => ({ ...f, [fila.nivel]: { monto, pct: pctDesde(fila.anterior, Number(monto)) } }))
  }

  const onPct = (fila: NivelFila, pct: string) => {
    const p = Number(pct)
    setForm((f) => ({
      ...f,
      [fila.nivel]: {
        pct,
        monto:
          pct !== '' && Number.isFinite(p) && fila.anterior > 0
            ? String(Math.round(fila.anterior * (1 + p / 100)))
            : f[fila.nivel]?.monto ?? '0',
      },
    }))
  }

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ciclo == null) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/costos/cuota-inicio-beca100', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciclo,
          montos: niveles.map((n) => ({ nivel: n.nivel, monto: Number(form[n.nivel]?.monto ?? 0) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar')
      aplicar(data)
      setMensaje(`Cuota de inicio para becados al 100% guardada para ${etiquetaCiclo(ciclo)}.`)
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
        Solo a alumnos activos con beca autorizada del 100% en el ciclo se les cobra este monto en la Cuota
        de Inicio de Curso (concepto 00). Al resto se le cobra la cuota normal. En 0 se cobra la cuota normal.
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
            {niveles.map((n) => (
              <fieldset key={n.nivel} className="fd-fieldset costos-usa-pago">
                <legend>{n.etiqueta}</legend>
                <div className="costos-beca100-anterior">
                  <span>{ciclo != null ? etiquetaCiclo(ciclo - 1) : 'Ciclo anterior'}</span>
                  <strong>{n.anterior > 0 ? money(n.anterior) : '—'}</strong>
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor={`beca100-pct-${n.nivel}`}>Aumento (%)</label>
                  <input
                    id={`beca100-pct-${n.nivel}`}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form[n.nivel]?.pct ?? ''}
                    onChange={(e) => onPct(n, e.target.value)}
                    disabled={!(n.anterior > 0) || !n.tieneFila}
                    placeholder={n.anterior > 0 ? '' : 'Sin ciclo anterior'}
                  />
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor={`beca100-monto-${n.nivel}`}>
                    {ciclo != null ? etiquetaCiclo(ciclo) : 'Ciclo'} (MXN)
                  </label>
                  <input
                    id={`beca100-monto-${n.nivel}`}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form[n.nivel]?.monto ?? '0'}
                    onChange={(e) => onMonto(n, e.target.value)}
                    disabled={!n.tieneFila}
                    required
                  />
                </div>
                <p className="costos-field-hint">
                  {n.tieneFila ? (
                    <>
                      Cuota normal: <strong>{money(n.normal)}</strong> · Aplica a{' '}
                      <strong>{becadosPorNivel(n.nivel)}</strong> alumno(s)
                    </>
                  ) : (
                    'Este nivel aún no tiene precios en el ciclo.'
                  )}
                </p>
              </fieldset>
            ))}
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
                  Guardar cuota para becados
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
