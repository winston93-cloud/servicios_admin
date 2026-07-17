'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import type { CsdAlertaNivel, CsdVencimientoFila } from '@/lib/cfdi/csdVencimientos'

type Umbrales = { rojoDias: number; amarilloDias: number }

function etiquetaDias(dias: number | null, alerta: CsdAlertaNivel): string {
  if (dias == null) return '—'
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return 'Vence hoy'
  return `${dias.toLocaleString('es-MX')} día${dias === 1 ? '' : 's'}`
}

function claseAlerta(alerta: CsdAlertaNivel): string {
  if (alerta === 'rojo') return 'csd-dias csd-dias--rojo'
  if (alerta === 'amarillo') return 'csd-dias csd-dias--amarillo'
  if (alerta === 'ok') return 'csd-dias csd-dias--ok'
  return 'csd-dias csd-dias--neutro'
}

export default function CsdVencimientosModulo() {
  const [filas, setFilas] = useState<CsdVencimientoFila[]>([])
  const [umbrales, setUmbrales] = useState<Umbrales>({ rojoDias: 30, amarilloDias: 90 })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/facturacion/csd-vencimientos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setFilas((data.filas ?? []) as CsdVencimientoFila[])
      if (data.umbrales) {
        setUmbrales({
          rojoDias: Number(data.umbrales.rojoDias) || 30,
          amarilloDias: Number(data.umbrales.amarilloDias) || 90,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar vencimientos')
      setFilas([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Vencimiento de CSD</h1>
        <p className="servicios-panel-lead">
          Vigencia de los certificados de sello digital (.cer) usados para facturar con FacturoPorTi
          (Educativo y Churchill). Se lee de las variables en Vercel; no se muestra el certificado.
        </p>
      </header>

      <section className="ciclos-crud-table-card" aria-labelledby="csd-tabla-titulo">
        <div className="ciclos-crud-table-header">
          <h2 id="csd-tabla-titulo" className="ciclos-crud-form-title">
            <ShieldAlert size={18} aria-hidden /> Emisores CFDI
          </h2>
          <button
            type="button"
            className="ciclos-crud-btn ciclos-crud-btn--secondary"
            onClick={() => void cargar()}
            disabled={cargando}
          >
            {cargando ? <Loader2 className="servicios-inline-spin" size={16} /> : <RefreshCw size={16} />}
            Actualizar
          </button>
        </div>

        <p className="costos-field-hint" style={{ marginBottom: '0.75rem' }}>
          Columna <strong>Días restantes</strong>:{' '}
          <span className="csd-leyenda csd-leyenda--rojo">rojo</span> ≤ {umbrales.rojoDias} días o
          vencido · <span className="csd-leyenda csd-leyenda--amarillo">amarillo</span> ≤{' '}
          {umbrales.amarilloDias} días.
        </p>

        {error ? <p className="servicios-panel-hint" style={{ color: '#b91c1c' }}>{error}</p> : null}

        {cargando && filas.length === 0 ? (
          <p className="servicios-panel-hint">
            <Loader2 className="servicios-inline-spin" size={16} /> Leyendo certificados…
          </p>
        ) : (
          <div className="ciclos-crud-table-wrap">
            <table className="ciclos-crud-table csd-vencimientos-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>RFC</th>
                  <th>Vigente desde</th>
                  <th>Vence</th>
                  <th>Días restantes</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.clave}>
                    <td data-label="Empresa">{f.empresa}</td>
                    <td data-label="RFC">
                      <code>{f.rfc}</code>
                    </td>
                    <td data-label="Vigente desde">{f.vigenteDesde ?? '—'}</td>
                    <td data-label="Vence">{f.vence ?? '—'}</td>
                    <td data-label="Días restantes">
                      <span className={claseAlerta(f.alerta)} title={f.mensaje}>
                        {f.alerta === 'sin_csd' || f.alerta === 'error'
                          ? f.mensaje ?? 'Sin datos'
                          : etiquetaDias(f.diasRestantes, f.alerta)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
