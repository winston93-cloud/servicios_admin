'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2, Search, X } from 'lucide-react'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { useAuth } from '@/contexts/AuthContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  accesoPagosInternosUsuario,
  ETIQUETA_PLANTEL_PAGOS_INTERNOS,
  folioInicialPlantel,
  listarPagosInternosPorPlanteles,
  type PagoInternoListadoFila,
  type PlantelPagosInternos,
} from '@/lib/pagoInternoService'
import { ALUMNO_REF_EXTERNO, esAlumnoRefExterno } from '@/lib/alumnoBusquedaServicios'
import {
  exportarPagosInternosExcel,
  mapFilasParaExcel,
} from '@/lib/exportarPagosInternosExcel'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
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
  const { user } = useAuth()
  const { opcionesCatalogo } = useCicloEscolar()
  const acceso = useMemo(
    () => accesoPagosInternosUsuario(user?.usuario_username),
    [user?.usuario_username]
  )
  const planteles = acceso.plantelesVisibles

  const [plantelTab, setPlantelTab] = useState<PlantelPagosInternos>(planteles[0] ?? 'winston')
  const [filas, setFilas] = useState<PagoInternoListadoFila[]>([])
  const [cargando, setCargando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [busquedaFolio, setBusquedaFolio] = useState('')
  const [busquedaNombre, setBusquedaNombre] = useState('')
  const [busquedaControl, setBusquedaControl] = useState('')
  const [errorExport, setErrorExport] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const lista = await listarPagosInternosPorPlanteles(planteles, { limite: 1000 })
      setFilas(lista)
    } finally {
      setCargando(false)
    }
  }, [planteles])

  useEffect(() => {
    if (!abierto) return
    setBusquedaFolio('')
    setBusquedaNombre('')
    setBusquedaControl('')
    setErrorExport(null)
    setPlantelTab(planteles[0] ?? 'winston')
    void cargar()
  }, [abierto, cargar, planteles])

  const hayFiltros = Boolean(
    busquedaFolio.trim() || busquedaNombre.trim() || busquedaControl.trim()
  )

  const filtradasBase = useMemo(() => {
    const folioQ = busquedaFolio.trim()
    const nombreQ = normalizarTexto(busquedaNombre)
    const controlQ = busquedaControl.trim().toLowerCase()

    return filas.filter((p) => {
      if (folioQ && !String(p.pago_folio).includes(folioQ)) return false

      if (nombreQ) {
        const nombre = normalizarTexto(nombreAlumnoFila(p))
        if (!nombre.includes(nombreQ)) return false
      }

      if (controlQ) {
        const ref = (p.alumno_ref ?? '').trim().toLowerCase()
        const q = controlQ.toLowerCase()
        if (q === ALUMNO_REF_EXTERNO || q === 'externo') {
          if (!esAlumnoRefExterno(p.alumno_ref)) return false
        } else if (!ref || !ref.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [filas, busquedaFolio, busquedaNombre, busquedaControl])

  const filtradasTab = useMemo(() => {
    return filtradasBase.filter((p) => p.plantel_serie === plantelTab)
  }, [filtradasBase, plantelTab])

  const totalVisible = useMemo(
    () => filtradasTab.reduce((acc, p) => acc + (Number(p.pago_importe) || 0), 0),
    [filtradasTab]
  )

  const etiquetaCicloFila = useCallback(
    (p: PagoInternoListadoFila) =>
      p.pago_ciclo_escolar != null
        ? etiquetaCicloEscolar(p.pago_ciclo_escolar, opcionesCatalogo) ||
          String(p.pago_ciclo_escolar)
        : '—',
    [opcionesCatalogo]
  )

  const mapExcel = useMemo(
    () => ({
      nombre: nombreAlumnoFila,
      concepto: conceptoVisible,
      fecha: formatearFecha,
      ciclo: etiquetaCicloFila,
      ref: refAlumno,
    }),
    [etiquetaCicloFila]
  )

  const onExcel = async () => {
    if (filtradasBase.length === 0 || exportando) return
    setErrorExport(null)
    setExportando(true)
    try {
      const hojas = planteles.map((plantel) => ({
        plantel,
        nombreHoja: ETIQUETA_PLANTEL_PAGOS_INTERNOS[plantel],
        filas: mapFilasParaExcel(
          filtradasBase.filter((p) => p.plantel_serie === plantel),
          mapExcel
        ),
      }))
      await exportarPagosInternosExcel({ hojas })
    } catch (e) {
      console.error(e)
      setErrorExport('No se pudo generar el Excel. Intenta de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  if (!abierto) return null

  const folioEjemplo = folioInicialPlantel(plantelTab)

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

        {planteles.length > 1 && (
          <div className="pi-listado-plantel-tabs" role="tablist" aria-label="Plantel">
            {planteles.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={plantelTab === p}
                className={plantelTab === p ? 'active' : ''}
                onClick={() => setPlantelTab(p)}
              >
                {ETIQUETA_PLANTEL_PAGOS_INTERNOS[p]}
                <span className="pi-listado-plantel-count">
                  {filtradasBase.filter((f) => f.plantel_serie === p).length}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="pi-listado-toolbar">
          <label className="pi-catalogo-busqueda pi-listado-busqueda">
            <span className="pi-catalogo-busqueda-label">Folio</span>
            <span className="pi-listado-busqueda-input">
              <Search size={16} aria-hidden />
              <input
                type="search"
                inputMode="numeric"
                value={busquedaFolio}
                onChange={(e) => setBusquedaFolio(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={`Ej. ${folioEjemplo}`}
                autoComplete="off"
                autoFocus
              />
            </span>
          </label>

          <label className="pi-catalogo-busqueda pi-listado-busqueda pi-listado-busqueda--nombre">
            <span className="pi-catalogo-busqueda-label">Nombre del alumno</span>
            <span className="pi-listado-busqueda-input">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={busquedaNombre}
                onChange={(e) => setBusquedaNombre(e.target.value)}
                placeholder="Nombre o apellido…"
                autoComplete="off"
              />
            </span>
          </label>

          <label className="pi-catalogo-busqueda pi-listado-busqueda pi-listado-busqueda--control">
            <span className="pi-catalogo-busqueda-label">No. de control</span>
            <span className="pi-listado-busqueda-input">
              <Search size={16} aria-hidden />
              <input
                type="search"
                inputMode="numeric"
                value={busquedaControl}
                onChange={(e) => setBusquedaControl(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Ej. 21805"
                autoComplete="off"
              />
            </span>
          </label>

          <div className="pi-listado-toolbar-meta">
            <button
              type="button"
              className="pi-btn pi-btn--excel"
              onClick={() => void onExcel()}
              disabled={cargando || exportando || filtradasBase.length === 0}
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
        ) : filtradasTab.length === 0 ? (
          <p className="pi-empty pi-listado-empty">
            {hayFiltros
              ? 'Sin pagos que coincidan con los filtros.'
              : `Sin pagos internos en ${ETIQUETA_PLANTEL_PAGOS_INTERNOS[plantelTab]} (serie desde ${folioEjemplo}).`}
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
                  {filtradasTab.map((p) => (
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
                {filtradasTab.length} registro{filtradasTab.length === 1 ? '' : 's'}
                {planteles.length > 1
                  ? ` · ${ETIQUETA_PLANTEL_PAGOS_INTERNOS[plantelTab]}`
                  : ''}
              </span>
              <strong>Total: {formatearMonto(totalVisible)}</strong>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
