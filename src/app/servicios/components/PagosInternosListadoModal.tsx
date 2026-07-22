'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2, Search, X } from 'lucide-react'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  listarPagosInternosSerieNueva,
  PAGO_INTERNO_FOLIO_INICIAL,
  type PagoInternoListadoFila,
} from '@/lib/pagoInternoService'
import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'
import {
  exportarPagosInternosExcel,
  mapFilasParaExcel,
} from '@/lib/exportarPagosInternosExcel'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

function nombreAlumnoFila(p: PagoInternoListadoFila): string {
  if (p.alumno_id == null) return 'Externo / sin alumno'
  const ref = (p.alumno_ref ?? '').trim()
  if (ref === ALUMNO_REF_EXTERNO || ref.toLowerCase() === 'externo') {
    return 'Externo'
  }
  const partes = [p.alumno_nombre, p.alumno_app, p.alumno_apm]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
  if (partes.length === 0) return ref ? `Ref ${ref}` : `Alumno #${p.alumno_id}`
  return partes.join(' ')
}

function conceptoVisible(p: PagoInternoListadoFila): string {
  const base = (p.concepto_clase ?? '').trim() || `Concepto #${p.concepto_id}`
  const extra = (p.concepto_otro ?? '').trim()
  return extra ? `${base} — ${extra}` : base
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatearMonto(n: number): string {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  })
}

function refAlumno(p: PagoInternoListadoFila): string {
  const ref = (p.alumno_ref ?? '').trim()
  if (!ref || ref === ALUMNO_REF_EXTERNO || ref.toLowerCase() === 'externo') return '—'
  return ref
}

export default function PagosInternosListadoModal({ abierto, onCerrar }: Props) {
  const { opcionesCatalogo } = useCicloEscolar()
  const [filas, setFilas] = useState<PagoInternoListadoFila[]>([])
  const [cargando, setCargando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [busquedaFolio, setBusquedaFolio] = useState('')
  const [errorExport, setErrorExport] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const lista = await listarPagosInternosSerieNueva({ limite: 1000 })
      setFilas(lista)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!abierto) return
    setBusquedaFolio('')
    setErrorExport(null)
    void cargar()
  }, [abierto, cargar])

  const filtradas = useMemo(() => {
    const q = busquedaFolio.trim()
    if (!q) return filas
    return filas.filter((p) => String(p.pago_folio).includes(q))
  }, [filas, busquedaFolio])

  const totalVisible = useMemo(
    () => filtradas.reduce((acc, p) => acc + (Number(p.pago_importe) || 0), 0),
    [filtradas]
  )

  const etiquetaCicloFila = useCallback(
    (p: PagoInternoListadoFila) =>
      p.pago_ciclo_escolar != null
        ? etiquetaCicloEscolar(p.pago_ciclo_escolar, opcionesCatalogo) ||
          String(p.pago_ciclo_escolar)
        : '—',
    [opcionesCatalogo]
  )

  const onExcel = async () => {
    if (filtradas.length === 0 || exportando) return
    setErrorExport(null)
    setExportando(true)
    try {
      await exportarPagosInternosExcel({
        filas: mapFilasParaExcel(filtradas, {
          nombre: nombreAlumnoFila,
          concepto: conceptoVisible,
          fecha: formatearFecha,
          ciclo: etiquetaCicloFila,
          ref: refAlumno,
        }),
        folioDesde: PAGO_INTERNO_FOLIO_INICIAL,
      })
    } catch (e) {
      console.error(e)
      setErrorExport('No se pudo generar el Excel. Intenta de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  if (!abierto) return null

  return (
    <div className="pi-modal-backdrop" role="presentation" onClick={onCerrar}>
      <div
        className="pi-modal pi-modal--listado"
        role="dialog"
        aria-labelledby="pi-listado-titulo"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pi-modal-header">
          <h2 id="pi-listado-titulo">Listado de pagos internos</h2>
          <button type="button" className="pi-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={22} />
          </button>
        </header>

        <div className="pi-listado-toolbar">
          <label className="pi-catalogo-busqueda pi-listado-busqueda">
            <span className="pi-catalogo-busqueda-label">Buscar por folio</span>
            <span className="pi-listado-busqueda-input">
              <Search size={16} aria-hidden />
              <input
                type="search"
                inputMode="numeric"
                value={busquedaFolio}
                onChange={(e) => setBusquedaFolio(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={`Ej. ${PAGO_INTERNO_FOLIO_INICIAL}`}
                autoComplete="off"
                autoFocus
              />
            </span>
          </label>

          <div className="pi-listado-toolbar-meta">
            <p className="pi-listado-hint">
              Folios desde {PAGO_INTERNO_FOLIO_INICIAL}, orden ascendente
              {!cargando
                ? ` · ${filtradas.length} registro${filtradas.length === 1 ? '' : 's'}`
                : ''}
            </p>
            <button
              type="button"
              className="pi-btn pi-btn--excel"
              onClick={() => void onExcel()}
              disabled={cargando || exportando || filtradas.length === 0}
              title="Exportar la relación visible a Excel"
            >
              {exportando ? (
                <Loader2 className="pi-spin" size={16} aria-hidden />
              ) : (
                <FileSpreadsheet size={16} aria-hidden />
              )}
              Excel
            </button>
          </div>
        </div>

        {errorExport && (
          <p className="pi-listado-export-error" role="alert">
            {errorExport}
          </p>
        )}

        {cargando ? (
          <div className="pi-modal-loading">
            <Loader2 className="pi-spin" size={22} aria-hidden />
            Cargando pagos…
          </div>
        ) : filtradas.length === 0 ? (
          <p className="pi-empty pi-listado-empty">
            {busquedaFolio.trim()
              ? `Sin pagos con folio que contenga «${busquedaFolio.trim()}».`
              : `Sin pagos internos desde el folio ${PAGO_INTERNO_FOLIO_INICIAL}.`}
          </p>
        ) : (
          <>
            <div className="pi-listado-tabla-wrap">
              <table className="pi-tabla pi-tabla--listado">
                <thead>
                  <tr>
                    <th scope="col">Folio</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Alumno</th>
                    <th scope="col">Concepto</th>
                    <th scope="col">Ciclo</th>
                    <th scope="col" className="pi-tabla-num">
                      Importe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p) => (
                    <tr key={p.pago_id}>
                      <td>
                        <span className="pi-tabla-folio-badge">{p.pago_folio}</span>
                      </td>
                      <td className="pi-listado-fecha">{formatearFecha(p.pago_fecha)}</td>
                      <td>
                        <span className="pi-listado-alumno">{nombreAlumnoFila(p)}</span>
                        {refAlumno(p) !== '—' ? (
                          <span className="pi-listado-ref">{refAlumno(p)}</span>
                        ) : null}
                      </td>
                      <td className="pi-listado-concepto">{conceptoVisible(p)}</td>
                      <td>
                        <span className="pi-listado-ciclo">{etiquetaCicloFila(p)}</span>
                      </td>
                      <td className="pi-tabla-num pi-listado-importe">
                        {formatearMonto(p.pago_importe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="pi-listado-footer">
              <span>
                {filtradas.length} registro{filtradas.length === 1 ? '' : 's'}
              </span>
              <strong>Total: {formatearMonto(totalVisible)}</strong>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
