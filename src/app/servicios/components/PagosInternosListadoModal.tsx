'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  listarPagosInternosSerieNueva,
  PAGO_INTERNO_FOLIO_INICIAL,
  type PagoInternoListadoFila,
} from '@/lib/pagoInternoService'
import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'

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

export default function PagosInternosListadoModal({ abierto, onCerrar }: Props) {
  const { opcionesCatalogo } = useCicloEscolar()
  const [filas, setFilas] = useState<PagoInternoListadoFila[]>([])
  const [cargando, setCargando] = useState(false)
  const [busquedaFolio, setBusquedaFolio] = useState('')

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
    void cargar()
  }, [abierto, cargar])

  const filtradas = useMemo(() => {
    const q = busquedaFolio.trim()
    if (!q) return filas
    return filas.filter((p) => String(p.pago_folio).includes(q))
  }, [filas, busquedaFolio])

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

        <div className="pi-catalogo-toolbar">
          <label className="pi-catalogo-busqueda">
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
          <p className="pi-listado-hint">
            Folios desde {PAGO_INTERNO_FOLIO_INICIAL}, orden ascendente
            {!cargando ? ` · ${filtradas.length} registro${filtradas.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>

        {cargando ? (
          <div className="pi-modal-loading">
            <Loader2 className="pi-spin" size={22} aria-hidden />
            Cargando pagos…
          </div>
        ) : filtradas.length === 0 ? (
          <p className="pi-empty" style={{ margin: '12px 22px 28px' }}>
            {busquedaFolio.trim()
              ? `Sin pagos con folio que contenga «${busquedaFolio.trim()}».`
              : `Sin pagos internos desde el folio ${PAGO_INTERNO_FOLIO_INICIAL}.`}
          </p>
        ) : (
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
                    <td className="pi-tabla-folio">{p.pago_folio}</td>
                    <td>{formatearFecha(p.pago_fecha)}</td>
                    <td>
                      <span className="pi-listado-alumno">{nombreAlumnoFila(p)}</span>
                      {p.alumno_ref &&
                      p.alumno_ref.trim() !== ALUMNO_REF_EXTERNO &&
                      p.alumno_ref.trim().toLowerCase() !== 'externo' ? (
                        <span className="pi-listado-ref">{p.alumno_ref}</span>
                      ) : null}
                    </td>
                    <td>{conceptoVisible(p)}</td>
                    <td>
                      {p.pago_ciclo_escolar != null
                        ? etiquetaCicloEscolar(p.pago_ciclo_escolar, opcionesCatalogo) ||
                          String(p.pago_ciclo_escolar)
                        : '—'}
                    </td>
                    <td className="pi-tabla-num">{formatearMonto(p.pago_importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
