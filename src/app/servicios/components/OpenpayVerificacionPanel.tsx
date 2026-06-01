'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'

interface VerificacionRow {
  id: number
  cuenta: string
  verification_code: string
  recibido_en: string
}

interface VerificacionResponse {
  urls?: { winston: string; educativo: string }
  verificaciones?: VerificacionRow[]
  error?: string
}

function etiquetaCuenta(cuenta: string): string {
  return cuenta === 'winston' ? 'Winston Churchill' : 'Educativo'
}

export default function OpenpayVerificacionPanel() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urls, setUrls] = useState<{ winston: string; educativo: string } | null>(null)
  const [filas, setFilas] = useState<VerificacionRow[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/openpay/verificacion')
      const data = (await res.json()) as VerificacionResponse
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar')
      setUrls(data.urls ?? null)
      setFilas(data.verificaciones ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="openpay-verif-panel" aria-labelledby="openpay-verif-titulo">
      <header className="openpay-verif-head">
        <h3 id="openpay-verif-titulo">OpenPay — Webhooks y verificación</h3>
        <button
          type="button"
          className="portal-pagos-btn-sec"
          onClick={() => void cargar()}
          disabled={cargando}
        >
          <RefreshCw size={14} aria-hidden className={cargando ? 'portal-pagos-spin' : ''} />
          Actualizar
        </button>
      </header>

      <p className="openpay-verif-lead">
        Registra estas URLs en el dashboard de OpenPay (una por merchant). Al verificar, OpenPay
        envía un código; aparece abajo para copiarlo en el panel de OpenPay.
      </p>

      {urls && (
        <div className="openpay-verif-urls">
          <div className="openpay-verif-url-row">
            <span className="openpay-verif-url-label">Winston</span>
            <code>{urls.winston}</code>
            <button type="button" className="openpay-verif-copy" onClick={() => void copiar(urls.winston)}>
              <Copy size={14} aria-hidden />
            </button>
          </div>
          <div className="openpay-verif-url-row">
            <span className="openpay-verif-url-label">Educativo</span>
            <code>{urls.educativo}</code>
            <button type="button" className="openpay-verif-copy" onClick={() => void copiar(urls.educativo)}>
              <Copy size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {cargando && <p className="openpay-verif-estado">Cargando…</p>}
      {error && (
        <p className="openpay-verif-error" role="alert">
          {error}
          {error.includes('autorizado') && (
            <> — Si usas <code>MIGRACION_SECRET</code>, la API requiere el header en servidor.</>
          )}
        </p>
      )}

      {!cargando && !error && filas.length === 0 && (
        <p className="openpay-verif-estado">
          Aún no hay códigos. Dispara la verificación desde OpenPay después de dar de alta la URL.
        </p>
      )}

      {!cargando && filas.length > 0 && (
        <table className="openpay-verif-tabla">
          <thead>
            <tr>
              <th>Plantel</th>
              <th>Código</th>
              <th>Recibido</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>{etiquetaCuenta(f.cuenta)}</td>
                <td>
                  <code className="openpay-verif-code">{f.verification_code}</code>
                </td>
                <td>{new Date(f.recibido_en).toLocaleString('es-MX')}</td>
                <td>
                  <button
                    type="button"
                    className="openpay-verif-copy"
                    onClick={() => void copiar(f.verification_code)}
                    aria-label="Copiar código"
                  >
                    <Copy size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
