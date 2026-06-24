'use client'

import { useAuth } from '@/contexts/AuthContext'
import { TIPOS_RELACION_NOTA } from '@/lib/cfdi/cfdiNotaCreditoService'
import type { CfdiNotaCreditoResultado } from '@/lib/cfdi/cfdiTypes'
import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import FacturacionShell from './FacturacionShell'

export default function FacturacionDevolucionView() {
  const { session, user } = useAuth()
  const [referencia, setReferencia] = useState('')
  const [uuid, setUuid] = useState('')
  const [tipoRelacion, setTipoRelacion] = useState('01')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<CfdiNotaCreditoResultado | null>(null)

  const emitir = useCallback(async () => {
    setCargando(true)
    setError(null)
    setResultado(null)
    try {
      const res = await fetch('/api/facturacion/nota-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: referencia.trim(),
          uuid: uuid.trim(),
          tipoRelacion,
          creadoPor: user?.usuario_username ?? session?.displayName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al emitir nota de crédito')
      setResultado(data.resultado as CfdiNotaCreditoResultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al emitir nota de crédito')
    } finally {
      setCargando(false)
    }
  }, [referencia, session, tipoRelacion, user, uuid])

  return (
    <FacturacionShell
      title="Devoluciones"
      subtitle="Nota de crédito (CFDI Egreso) relacionada a una factura timbrada."
      showNav={false}
    >
      <div className="facturacion-cfdi-timbrar">
        <div className="facturacion-cfdi-timbrar-form facturacion-cfdi-form-stack">
          <label className="facturacion-cfdi-field">
            Referencia de pago
            <input
              className="facturacion-cfdi-input"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="000000000000"
              maxLength={12}
            />
          </label>

          <label className="facturacion-cfdi-field">
            UUID de la factura original
            <input
              className="facturacion-cfdi-input"
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>

          <label className="facturacion-cfdi-field facturacion-cfdi-field-wide">
            Tipo de relación
            <select
              className="facturacion-cfdi-input"
              value={tipoRelacion}
              onChange={(e) => setTipoRelacion(e.target.value)}
            >
              {TIPOS_RELACION_NOTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value} — {t.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="facturacion-cfdi-btn-primary"
            disabled={cargando || referencia.length < 9 || !uuid.trim()}
            onClick={() => void emitir()}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="facturacion-cfdi-spin" aria-hidden />
                Timbrando nota…
              </>
            ) : (
              'Generar devolución'
            )}
          </button>
        </div>

        {error && (
          <p className="facturacion-cfdi-timbrar-error" role="alert">
            {error}
          </p>
        )}

        {resultado && (
          <div
            className={`facturacion-cfdi-resultado ${resultado.ok ? 'ok' : 'fail'}`}
            role="status"
          >
            <p>
              <strong>{resultado.ok ? 'Éxito' : 'Error'}</strong> — {resultado.referencia}
            </p>
            <p>{resultado.mensaje}</p>
            {resultado.uuid && <p>UUID nota: {resultado.uuid}</p>}
            {resultado.errorTecnico && <p className="muted">{resultado.errorTecnico}</p>}
          </div>
        )}
      </div>
    </FacturacionShell>
  )
}
