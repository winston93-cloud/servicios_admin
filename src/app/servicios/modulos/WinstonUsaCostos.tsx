'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'

type PagoUsaFila = {
  pago: 1 | 2 | 3
  monto_usd: number
  fecha_apertura: string
  monto_mxn_hoy: number | null
}

type TipoCambio = { fecha: string; usd_mxn: number; fecha_dato: string; fuente: string } | null

type FormPago = { monto_usd: string; fecha_apertura: string }

const PAGOS = [1, 2, 3] as const
const CONCEPTO: Record<1 | 2 | 3, string> = { 1: '23', 2: '24', 3: '25' }

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function formVacio(): Record<1 | 2 | 3, FormPago> {
  return {
    1: { monto_usd: '0', fecha_apertura: '' },
    2: { monto_usd: '0', fecha_apertura: '' },
    3: { monto_usd: '0', fecha_apertura: '' },
  }
}

export default function WinstonUsaCostos({ ciclo }: { ciclo: number | null }) {
  const [form, setForm] = useState(formVacio)
  const [filas, setFilas] = useState<PagoUsaFila[]>([])
  const [tipoCambio, setTipoCambio] = useState<TipoCambio>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const aplicar = (data: { pagos?: PagoUsaFila[]; tipoCambio?: TipoCambio }) => {
    const pagos = data.pagos ?? []
    setFilas(pagos)
    setTipoCambio(data.tipoCambio ?? null)
    const nuevo = formVacio()
    for (const p of pagos) {
      nuevo[p.pago] = { monto_usd: String(p.monto_usd), fecha_apertura: p.fecha_apertura }
    }
    setForm(nuevo)
  }

  const cargar = useCallback(async (cicloValor: number) => {
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(`/api/costos/winston-usa?ciclo=${cicloValor}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      aplicar(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      aplicar({})
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (ciclo != null) void cargar(ciclo)
  }, [ciclo, cargar])

  const setCampo = (pago: 1 | 2 | 3, key: keyof FormPago, value: string) => {
    setForm((f) => ({ ...f, [pago]: { ...f[pago], [key]: value } }))
  }

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ciclo == null) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/costos/winston-usa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciclo,
          pagos: PAGOS.map((p) => ({
            pago: p,
            monto_usd: Number(form[p].monto_usd),
            fecha_apertura: form[p].fecha_apertura,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar')
      aplicar(data)
      setMensaje(`Winston USA Program guardado para el ciclo ${ciclo}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  const totalUsd = PAGOS.reduce((s, p) => s + (Number(form[p].monto_usd) || 0), 0)
  const mxnHoy = (p: 1 | 2 | 3) => filas.find((f) => f.pago === p)?.monto_mxn_hoy ?? null

  return (
    <section className="ciclos-crud-form-card costos-usa-card" aria-labelledby="costos-usa-titulo">
      <h2 id="costos-usa-titulo" className="ciclos-crud-form-title">
        Winston USA Program (USD)
        {ciclo != null ? ` · ciclo ${ciclo}` : ''}
      </h2>
      <p className="costos-field-hint">
        Igual para todos los niveles. Al papá se le cobra en pesos con el tipo de cambio de Banxico del
        día en que paga (al peso hacia arriba). Cada pago aparece en el portal desde su fecha de
        apertura. Se muestra solo si «Winston USA Program» está abierto en Apertura de conceptos.
      </p>

      {cargando ? (
        <p className="ciclos-crud-loading">
          <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
          Cargando…
        </p>
      ) : (
        <form className="ciclos-crud-form" onSubmit={onGuardar}>
          <div className="costos-usa-grid">
            {PAGOS.map((p) => (
              <fieldset key={p} className="fd-fieldset costos-usa-pago">
                <legend>
                  Pago {p} <span className="costos-field-hint">· Concepto {CONCEPTO[p]}</span>
                </legend>
                <div className="ciclos-crud-field">
                  <label htmlFor={`usa-monto-${p}`}>Monto (USD)</label>
                  <input
                    id={`usa-monto-${p}`}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form[p].monto_usd}
                    onChange={(e) => setCampo(p, 'monto_usd', e.target.value)}
                    required
                  />
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor={`usa-fecha-${p}`}>Se abre a papás el</label>
                  <input
                    id={`usa-fecha-${p}`}
                    type="date"
                    value={form[p].fecha_apertura}
                    onChange={(e) => setCampo(p, 'fecha_apertura', e.target.value)}
                    required
                  />
                </div>
                <p className="costos-field-hint">
                  Hoy en pesos: <strong>{mxnHoy(p) != null ? money(mxnHoy(p)!) : '—'}</strong>
                </p>
              </fieldset>
            ))}
          </div>

          <p className="costos-field-hint" aria-live="polite">
            Total: <strong>USD ${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
            {' · '}
            {tipoCambio ? (
              <>
                Tipo de cambio de hoy: <strong>{tipoCambio.usd_mxn.toFixed(4)}</strong>
                {tipoCambio.fuente.startsWith('respaldo')
                  ? ' (respaldo: el DOF no respondió, se usa el último guardado)'
                  : tipoCambio.fuente.startsWith('dof')
                    ? ' (DOF)'
                    : ' (Banxico)'}
              </>
            ) : (
              <>Sin tipo de cambio disponible: los pagos no se muestran a papás hasta que el DOF responda.</>
            )}
          </p>

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
                  Guardar Winston USA Program
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
