'use client'

import { useAuth } from '@/contexts/AuthContext'
import type { CfdiTimbradoLoteResultado, CfdiTimbradoResultado } from '@/lib/cfdi/cfdiTypes'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import FacturacionShell from './FacturacionShell'

const MESES = [
  { v: 1, l: 'Enero' },
  { v: 2, l: 'Febrero' },
  { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' },
  { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' },
  { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' },
  { v: 11, l: 'Noviembre' },
  { v: 12, l: 'Diciembre' },
]

type Props = {
  modo: 'mes' | 'individual'
  title: string
  subtitle: string
}

export default function FacturacionTimbrarView({ modo, title, subtitle }: Props) {
  const { session, user } = useAuth()
  const [pacListo, setPacListo] = useState<boolean | null>(null)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [metodo, setMetodo] = useState('Transferencia')
  const [referencia, setReferencia] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lote, setLote] = useState<CfdiTimbradoLoteResultado | null>(null)
  const [individual, setIndividual] = useState<CfdiTimbradoResultado | null>(null)

  useEffect(() => {
    fetch('/api/facturacion/timbrar')
      .then((r) => r.json())
      .then((d) => setPacListo(Boolean(d.pacConfigurado)))
      .catch(() => setPacListo(false))
  }, [])

  const timbrar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setLote(null)
    setIndividual(null)
    try {
      const body =
        modo === 'mes'
          ? {
              modo: 'mes',
              mes,
              metodo,
              creadoPor: user?.usuario_username ?? session?.displayName,
            }
          : {
              modo: 'individual',
              referencia: referencia.trim(),
              metodo,
              creadoPor: user?.usuario_username ?? session?.displayName,
            }

      const res = await fetch('/api/facturacion/timbrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al timbrar')

      if (modo === 'mes') setLote(data.resultado as CfdiTimbradoLoteResultado)
      else setIndividual(data.resultado as CfdiTimbradoResultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al timbrar')
    } finally {
      setCargando(false)
    }
  }, [mes, metodo, modo, referencia, session, user])

  return (
    <FacturacionShell title={title} subtitle={subtitle} showNav={false}>
      <div className="facturacion-cfdi-timbrar">
        {pacListo === false && (
          <p className="facturacion-cfdi-timbrar-aviso" role="alert">
            Faltan credenciales PAC en Vercel (FACTUROPORTI). El timbrado no podrá ejecutarse hasta
            configurarlas.
          </p>
        )}

        <div className="facturacion-cfdi-timbrar-form">
          {modo === 'mes' && (
            <label className="facturacion-cfdi-field">
              Mes (año en curso)
              <select
                className="facturacion-cfdi-input"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESES.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.l}
                  </option>
                ))}
              </select>
            </label>
          )}

          {modo === 'individual' && (
            <label className="facturacion-cfdi-field">
              Referencia de pago (12 dígitos)
              <input
                className="facturacion-cfdi-input"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="000000000000"
                maxLength={12}
              />
            </label>
          )}

          <label className="facturacion-cfdi-field">
            Forma de pago
            <select
              className="facturacion-cfdi-input"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
            >
              <option value="Transferencia">Transferencia</option>
              <option value="Efectivo">Efectivo</option>
            </select>
          </label>

          <button
            type="button"
            className="facturacion-cfdi-btn-primary"
            disabled={cargando || pacListo === false}
            onClick={() => void timbrar()}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="facturacion-cfdi-spin" aria-hidden />
                Timbrando…
              </>
            ) : (
              'Timbrar'
            )}
          </button>
        </div>

        {error && (
          <p className="facturacion-cfdi-timbrar-error" role="alert">
            {error}
          </p>
        )}

        {individual && (
          <div
            className={`facturacion-cfdi-resultado ${individual.ok ? 'ok' : 'fail'}`}
            role="status"
          >
            <p>
              <strong>{individual.ok ? 'Éxito' : 'Error'}</strong> — {individual.referencia}
            </p>
            <p>{individual.mensaje}</p>
            {individual.uuid && <p>UUID: {individual.uuid}</p>}
            {individual.errorTecnico && <p className="muted">{individual.errorTecnico}</p>}
          </div>
        )}

        {lote && (
          <div className="facturacion-cfdi-lote" role="status">
            <p>
              Procesados: {lote.procesados} · Exitosos: {lote.exitosos} · Fallidos: {lote.fallidos}
            </p>
            {lote.resultados.length > 0 && (
              <ul className="facturacion-cfdi-lote-list">
                {lote.resultados.map((r) => (
                  <li key={r.referencia} className={r.ok ? 'ok' : 'fail'}>
                    {r.referencia}: {r.mensaje}
                  </li>
                ))}
              </ul>
            )}
            {lote.procesados === 0 && <p>No había pagos pendientes para ese mes y forma de pago.</p>}
          </div>
        )}
      </div>
    </FacturacionShell>
  )
}
