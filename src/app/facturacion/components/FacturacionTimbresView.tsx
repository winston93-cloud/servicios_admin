'use client'

import type { CfdiSaldoTimbres } from '@/lib/cfdi/cfdiTimbresService'
import { Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import FacturacionShell from './FacturacionShell'

export default function FacturacionTimbresView() {
  const [saldos, setSaldos] = useState<CfdiSaldoTimbres[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/facturacion/timbres')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al consultar timbres')
      setSaldos(data.saldos as CfdiSaldoTimbres[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consultar timbres')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <FacturacionShell
      title="Saldo de timbres"
      subtitle="Créditos disponibles en FacturoPorTi por emisor (Churchill y Educativo)."
      showNav={false}
    >
      <div className="facturacion-cfdi-timbrar">
        <div className="facturacion-cfdi-timbrar-form">
          <button
            type="button"
            className="facturacion-cfdi-btn-primary"
            disabled={cargando}
            onClick={() => void cargar()}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="facturacion-cfdi-spin" aria-hidden />
                Consultando…
              </>
            ) : (
              <>
                <RefreshCw size={16} aria-hidden />
                Actualizar
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="facturacion-cfdi-timbrar-error" role="alert">
            {error}
          </p>
        )}

        {!cargando && saldos.length > 0 && (
          <div className="facturacion-cfdi-timbres-grid">
            {saldos.map((s) => (
              <div
                key={s.emisor}
                className={`facturacion-cfdi-timbres-card ${s.ok ? 'ok' : 'fail'}`}
              >
                <h2 className="facturacion-cfdi-timbres-title">{s.label}</h2>
                {s.ok ? (
                  <dl className="facturacion-cfdi-timbres-dl">
                    <div>
                      <dt>Fecha de compra</dt>
                      <dd>{s.fechaCompra ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Timbres utilizados</dt>
                      <dd>{s.timbresUtilizados ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Créditos restantes</dt>
                      <dd className="facturacion-cfdi-timbres-saldo">{s.creditosRestantes ?? '—'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p>
                    {s.mensaje} ({s.codigo})
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </FacturacionShell>
  )
}
