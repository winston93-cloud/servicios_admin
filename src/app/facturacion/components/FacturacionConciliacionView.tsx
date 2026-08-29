'use client'

import { useId, useRef, useState } from 'react'
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  Loader2,
  Upload,
} from 'lucide-react'
import FacturacionSatShell from './FacturacionSatShell'

function truncarNombre(nombre: string, max = 32) {
  if (nombre.length <= max) return nombre
  return `${nombre.slice(0, max - 3)}…`
}

type ZonaArchivoProps = {
  id: string
  label: string
  hint: string
  accept: string
  icon: React.ReactNode
  archivo: File | null
  disabled: boolean
  onSelect: (file: File | null) => void
}

function ZonaArchivo({
  id,
  label,
  hint,
  accept,
  icon,
  archivo,
  disabled,
  onSelect,
}: ZonaArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="facturacion-cfdi-sat-file-zone facturacion-cfdi-sat-conc-zone">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="facturacion-cfdi-sat-file-input"
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className={`facturacion-cfdi-sat-file-btn${archivo ? ' has-file' : ''}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-describedby={`${id}-hint`}
      >
        <span className="facturacion-cfdi-sat-file-icon" aria-hidden>
          {archivo ? <CheckCircle2 size={22} /> : icon}
        </span>
        <span className="facturacion-cfdi-sat-file-text">
          <span className="facturacion-cfdi-sat-file-label">{label}</span>
          <span className="facturacion-cfdi-sat-file-name" id={`${id}-hint`}>
            {archivo ? truncarNombre(archivo.name) : hint}
          </span>
        </span>
      </button>
    </div>
  )
}

export default function FacturacionConciliacionView() {
  const cfdiId = useId()
  const banorteId = useId()
  const claraId = useId()

  const [cfdi, setCfdi] = useState<File | null>(null)
  const [banorte, setBanorte] = useState<File | null>(null)
  const [clara, setClara] = useState<File | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const listo = Boolean(cfdi && banorte && clara)

  const generar = async () => {
    if (!cfdi || !banorte || !clara) {
      setError('Seleccione los tres archivos para continuar.')
      return
    }
    setProcesando(true)
    setError(null)
    setMensaje(null)
    try {
      const fd = new FormData()
      fd.set('cfdiExcel', cfdi)
      fd.set('banorteTxt', banorte)
      fd.set('claraCsv', clara)
      fd.set('nombreCfdi', cfdi.name)
      fd.set('nombreBanorte', banorte.name)
      fd.set('nombreClara', clara.name)

      const res = await fetch('/api/sat/conciliacion', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo generar la conciliación.')
      }

      const blob = await res.blob()
      const total = res.headers.get('X-Conciliacion-Total')
      const ok = res.headers.get('X-Conciliacion-Ok')
      const pend = res.headers.get('X-Conciliacion-Pendiente')

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conciliacion-cfdi_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      setMensaje(
        `Excel generado: ${ok ?? '—'} de ${total ?? '—'} facturas conciliadas` +
          (pend && Number(pend) > 0 ? ` · ${pend} sin localizar` : '')
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al conciliar')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <FacturacionSatShell
      title="Conciliación"
      subtitle="Cruce de CFDI recibidos con pagos Banorte (TXT) y tarjeta Clara (CSV)"
    >
      <div className="facturacion-cfdi-sat-panel facturacion-cfdi-sat-conciliacion-panel">
        <div className="facturacion-cfdi-sat-conc-hero">
          <span className="facturacion-cfdi-sat-conc-hero-icon" aria-hidden>
            <GitCompareArrows size={28} />
          </span>
          <div className="min-w-0">
            <h2 className="facturacion-cfdi-sat-conc-title">Conciliación de pagos</h2>
            <p className="facturacion-cfdi-sat-conc-lead">
              Suba el Excel de <strong>CFDI recibidos</strong> (descarga masiva SAT), el estado de
              cuenta <strong>Banorte (.txt)</strong> y las transacciones <strong>Clara (.csv)</strong>.
              El sistema identificará pagos por UUID, RFC+monto o monto+proveedor y generará un
              Excel con el detalle y las facturas no localizadas.
            </p>
          </div>
        </div>

        <div className="facturacion-cfdi-sat-conc-grid">
          <ZonaArchivo
            id={cfdiId}
            label="CFDI recibidos (Excel)"
            hint="Archivo .xlsx de descarga masiva"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            icon={<FileSpreadsheet size={22} />}
            archivo={cfdi}
            disabled={procesando}
            onSelect={setCfdi}
          />
          <ZonaArchivo
            id={banorteId}
            label="Banorte (TXT)"
            hint="Estado de cuenta pipe-delimited"
            accept=".txt,text/plain"
            icon={<FileText size={22} />}
            archivo={banorte}
            disabled={procesando}
            onSelect={setBanorte}
          />
          <ZonaArchivo
            id={claraId}
            label="Clara (CSV)"
            hint="Exportación de transacciones"
            accept=".csv,text/csv"
            icon={<FileText size={22} />}
            archivo={clara}
            disabled={procesando}
            onSelect={setClara}
          />
        </div>

        {error ? (
          <p className="facturacion-cfdi-sat-status-error" role="alert">
            {error}
          </p>
        ) : null}
        {mensaje ? (
          <p className="facturacion-cfdi-sat-status-ok" role="status">
            {mensaje}
          </p>
        ) : null}

        <button
          type="button"
          className="facturacion-cfdi-btn-primary facturacion-cfdi-sat-btn-main facturacion-cfdi-sat-conc-btn"
          disabled={!listo || procesando}
          onClick={() => void generar()}
        >
          {procesando ? (
            <>
              <Loader2 size={18} className="facturacion-cfdi-spin" aria-hidden />
              Conciliando y generando Excel…
            </>
          ) : (
            <>
              <Upload size={18} aria-hidden />
              Generar conciliación Excel
            </>
          )}
        </button>

        <div className="facturacion-cfdi-sat-conc-nota">
          <p>
            <strong>Resultado:</strong> hoja Resumen, Conciliación (todas las facturas tipo I),
            No localizadas, y movimientos de Clara/Banorte sin factura asociada.
          </p>
          <p>
            <strong>Criterios:</strong> UUID en Clara → RFC+monto en Banorte → monto+comercio en
            Clara → monto+beneficiario en Banorte.
          </p>
        </div>
      </div>
    </FacturacionSatShell>
  )
}
