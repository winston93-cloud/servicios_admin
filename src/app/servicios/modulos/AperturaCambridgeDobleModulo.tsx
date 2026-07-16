'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Save } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { PortalAperturaConceptos } from '@/lib/portalAperturaConceptosService'

export default function AperturaCambridgeDobleModulo() {
  const { user } = useAuth()
  const [cambridge, setCambridge] = useState(false)
  const [doble, setDoble] = useState(false)
  const [meta, setMeta] = useState<Pick<PortalAperturaConceptos, 'actualizado_en' | 'actualizado_por'> | null>(
    null
  )
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal-apertura-conceptos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      const fila = data.fila as PortalAperturaConceptos
      setCambridge(Boolean(fila.cambridge_abierto))
      setDoble(Boolean(fila.doble_titulacion_abierto))
      setMeta({
        actualizado_en: fila.actualizado_en,
        actualizado_por: fila.actualizado_por,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    try {
      const res = await fetch('/api/portal-apertura-conceptos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cambridge_abierto: cambridge,
          doble_titulacion_abierto: doble,
          actualizado_por: user?.usuario_nombre_completo ?? user?.usuario_username ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      const fila = data.fila as PortalAperturaConceptos
      setCambridge(Boolean(fila.cambridge_abierto))
      setDoble(Boolean(fila.doble_titulacion_abierto))
      setMeta({
        actualizado_en: fila.actualizado_en,
        actualizado_por: fila.actualizado_por,
      })
      setMensaje('Apertura guardada. El portal de pagos ya refleja estos interruptores.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Apertura Cambridge / Doble titulación</h1>
        <p className="servicios-panel-lead">
          Controla si esos conceptos aparecen en el portal de pagos de papás. Por ahora solo
          interruptores globales; más adelante se afinan las reglas por grado.
        </p>
      </header>

      <section className="ciclos-crud-form-card costos-form-card" aria-labelledby="apertura-form-titulo">
        <h2 id="apertura-form-titulo" className="ciclos-crud-form-title">
          Visibilidad en portal
        </h2>

        {cargando ? (
          <p className="servicios-panel-hint">
            <Loader2 className="servicios-inline-spin" size={16} /> Cargando…
          </p>
        ) : (
          <form className="ciclos-crud-form" onSubmit={onGuardar}>
            <label className="apertura-toggle">
              <input
                type="checkbox"
                checked={cambridge}
                onChange={(e) => setCambridge(e.target.checked)}
              />
              <span>
                <strong>Cambridge</strong>
                <span className="costos-field-hint">
                  Conceptos 19 / 20 / 22. Regla prevista: solo 9.º de secundaria.
                </span>
              </span>
            </label>

            <label className="apertura-toggle">
              <input
                type="checkbox"
                checked={doble}
                onChange={(e) => setDoble(e.target.checked)}
              />
              <span>
                <strong>Doble titulación (Winston USA)</strong>
                <span className="costos-field-hint">
                  Conceptos 23 / 24 / 25. Regla prevista: 1.º de primaria a 9.º de secundaria,
                  opcional si el papá lo desea.
                </span>
              </span>
            </label>

            {meta?.actualizado_en && (
              <p className="costos-field-hint">
                Último cambio:{' '}
                {new Date(meta.actualizado_en).toLocaleString('es-MX', {
                  timeZone: 'America/Mexico_City',
                })}
                {meta.actualizado_por ? ` · ${meta.actualizado_por}` : ''}
              </p>
            )}

            {error && (
              <p className="servicios-panel-hint" role="alert" style={{ color: 'var(--danger, #b91c1c)' }}>
                {error}
              </p>
            )}
            {mensaje && (
              <p className="servicios-panel-hint" role="status">
                <CheckCircle2 size={16} aria-hidden /> {mensaje}
              </p>
            )}

            <div className="ciclos-crud-actions">
              <button type="submit" className="ciclos-crud-btn-primary" disabled={guardando}>
                {guardando ? (
                  <>
                    <Loader2 className="servicios-inline-spin" size={16} /> Guardando…
                  </>
                ) : (
                  <>
                    <Save size={16} aria-hidden /> Guardar
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
