'use client'

import { useAuth } from '@/contexts/AuthContext'
import {
  emisorRfcDefault,
  MOTIVOS_CANCELACION,
} from '@/lib/cfdi/cfdiCancelacionService'
import type { CfdiCancelacionResultado, CfdiEmisorClave } from '@/lib/cfdi/cfdiTypes'
import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import FacturacionShell from './FacturacionShell'

type Props = {
  emisorDefault: CfdiEmisorClave
  title: string
}

export default function FacturacionCancelacionView({ emisorDefault, title }: Props) {
  const { session, user } = useAuth()
  const [emisor, setEmisor] = useState<CfdiEmisorClave>(emisorDefault)
  const [uuid, setUuid] = useState('')
  const [folioSustitucion, setFolioSustitucion] = useState('')
  const [rfcEmisor, setRfcEmisor] = useState(emisorRfcDefault(emisorDefault))
  const [rfcReceptor, setRfcReceptor] = useState('')
  const [total, setTotal] = useState('')
  const [motivo, setMotivo] = useState('02')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<CfdiCancelacionResultado | null>(null)

  const cambiarEmisor = (clave: CfdiEmisorClave) => {
    setEmisor(clave)
    setRfcEmisor(emisorRfcDefault(clave))
  }

  const cancelar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setResultado(null)
    try {
      const res = await fetch('/api/facturacion/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: uuid.trim(),
          folioSustitucion: folioSustitucion.trim(),
          rfcEmisor: rfcEmisor.trim(),
          rfcReceptor: rfcReceptor.trim(),
          total: Number(total),
          motivo,
          emisor,
          creadoPor: user?.usuario_username ?? session?.displayName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar')
      setResultado(data.resultado as CfdiCancelacionResultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCargando(false)
    }
  }, [
    emisor,
    folioSustitucion,
    motivo,
    rfcEmisor,
    rfcReceptor,
    session,
    total,
    user,
    uuid,
  ])

  return (
    <FacturacionShell
      title={title}
      subtitle="Cancelación ante el SAT vía FacturoPorTi (CSD del emisor)."
      showNav={false}
    >
      <div className="facturacion-cfdi-timbrar">
        <div className="facturacion-cfdi-timbrar-form facturacion-cfdi-form-stack">
          <label className="facturacion-cfdi-field">
            Emisor
            <select
              className="facturacion-cfdi-input"
              value={emisor}
              onChange={(e) => cambiarEmisor(e.target.value as CfdiEmisorClave)}
            >
              <option value="churchill">Winston Churchill</option>
              <option value="educativo">Educativo</option>
            </select>
          </label>

          <label className="facturacion-cfdi-field">
            UUID a cancelar
            <input
              className="facturacion-cfdi-input"
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>

          <label className="facturacion-cfdi-field">
            Folio fiscal que sustituye
            <input
              className="facturacion-cfdi-input"
              value={folioSustitucion}
              onChange={(e) => setFolioSustitucion(e.target.value)}
            />
          </label>

          <label className="facturacion-cfdi-field">
            RFC emisor
            <input
              className="facturacion-cfdi-input"
              value={rfcEmisor}
              onChange={(e) => setRfcEmisor(e.target.value.toUpperCase())}
            />
          </label>

          <label className="facturacion-cfdi-field">
            RFC receptor
            <input
              className="facturacion-cfdi-input"
              value={rfcReceptor}
              onChange={(e) => setRfcReceptor(e.target.value.toUpperCase())}
            />
          </label>

          <label className="facturacion-cfdi-field">
            Monto total
            <input
              className="facturacion-cfdi-input"
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
            />
          </label>

          <label className="facturacion-cfdi-field facturacion-cfdi-field-wide">
            Motivo de cancelación
            <select
              className="facturacion-cfdi-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS_CANCELACION.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value} — {m.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="facturacion-cfdi-btn-primary"
            disabled={cargando || !uuid.trim()}
            onClick={() => void cancelar()}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="facturacion-cfdi-spin" aria-hidden />
                Cancelando…
              </>
            ) : (
              'Cancelar CFDI'
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
              <strong>{resultado.ok ? 'Cancelación exitosa' : 'Error'}</strong> — {resultado.uuid}
            </p>
            <p>{resultado.mensaje}</p>
            {resultado.errorTecnico && <p className="muted">{resultado.errorTecnico}</p>}
          </div>
        )}
      </div>
    </FacturacionShell>
  )
}
