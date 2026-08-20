'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Pencil, Printer, Save, X } from 'lucide-react'
import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'
import {
  actualizarPagoInterno,
  esConceptoCuotaPadresMasManuales,
  esConceptoManuales,
  mensajeManualesRequiereCuotaPadres,
  nivelGradoDesdeAlumno,
  resolverPrecioInterno,
  type ConceptoInterno,
  type PagoInternoRegistro,
} from '@/lib/pagoInternoService'

type AlumnoCtx = {
  alumno_ref: string | number
  alumno_nivel: number | string | null
  alumno_grado?: number | string | null
}

type OpcionCiclo = { valor: number; etiqueta: string }

interface Props {
  abierto: boolean
  pago: PagoInternoRegistro | null
  nombreAlumno: string
  conceptos: ConceptoInterno[]
  opcionesCiclo: OpcionCiclo[]
  alumno: AlumnoCtx | null
  cuotaPadresPagada: boolean
  procesando?: boolean
  onCerrar: () => void
  onGuardado: (pago: PagoInternoRegistro, imprimir: boolean) => void | Promise<void>
}

export default function PagosInternosEditarModal({
  abierto,
  pago,
  nombreAlumno,
  conceptos,
  opcionesCiclo,
  alumno,
  cuotaPadresPagada,
  procesando = false,
  onCerrar,
  onGuardado,
}: Props) {
  const tituloId = useId()
  const [conceptoId, setConceptoId] = useState(0)
  const [conceptoOtro, setConceptoOtro] = useState('')
  const [importe, setImporte] = useState<number | ''>('')
  const [fechaPago, setFechaPago] = useState('')
  const [cicloPago, setCicloPago] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imprimirTrasGuardar, setImprimirTrasGuardar] = useState(false)

  const conceptosEditables = useMemo(
    () =>
      conceptos.filter(
        (c) => !esConceptoCuotaPadresMasManuales(c.concepto_id, c.concepto_clase)
      ),
    [conceptos]
  )

  useEffect(() => {
    if (!abierto || !pago) return
    setConceptoId(Number(pago.concepto_id) || 0)
    setConceptoOtro(pago.concepto_otro ?? '')
    setImporte(Number(pago.pago_importe))
    setFechaPago(String(pago.pago_fecha ?? '').slice(0, 10))
    setCicloPago(Number(pago.pago_ciclo_escolar) || 0)
    setError(null)
    setGuardando(false)
    setImprimirTrasGuardar(false)
  }, [abierto, pago])

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando && !procesando) onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCerrar, guardando, procesando])

  const aplicarPrecio = useCallback(
    async (idConcepto: number, ciclo: number) => {
      if (!alumno || idConcepto <= 0 || ciclo < 1) return
      const esExterno = String(alumno.alumno_ref ?? '').trim() === ALUMNO_REF_EXTERNO
      const { nivel, grado } = nivelGradoDesdeAlumno(alumno.alumno_nivel, alumno.alumno_grado)
      const precio = await resolverPrecioInterno(idConcepto, ciclo, nivel, grado, {
        cualquierNivel: esExterno,
      })
      if (precio != null) setImporte(precio)
    },
    [alumno]
  )

  const onCambioConcepto = async (id: number) => {
    setConceptoId(id)
    await aplicarPrecio(id, cicloPago)
  }

  const conceptoSel = conceptosEditables.find((c) => c.concepto_id === conceptoId)
  const bloqueoManuales =
    conceptoSel != null &&
    esConceptoManuales(conceptoSel.concepto_id, conceptoSel.concepto_clase) &&
    !cuotaPadresPagada

  const guardar = async (imprimir: boolean) => {
    if (!pago) return
    if (conceptoId <= 0 || importe === '' || importe < 0) {
      setError('Completa concepto y monto.')
      return
    }
    if (!fechaPago) {
      setError('Indica la fecha de pago.')
      return
    }
    if (bloqueoManuales) {
      setError(mensajeManualesRequiereCuotaPadres())
      return
    }
    setGuardando(true)
    setImprimirTrasGuardar(imprimir)
    setError(null)
    try {
      const res = await actualizarPagoInterno({
        pagoId: pago.pago_id,
        concepto_id: conceptoId,
        concepto_otro: conceptoOtro,
        pago_importe: Number(importe),
        pago_fecha: fechaPago,
        pago_ciclo_escolar: cicloPago,
      })
      if (!res.ok) {
        setError(res.mensaje)
        return
      }
      await onGuardado(res.pago, imprimir)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
      setImprimirTrasGuardar(false)
    }
  }

  if (!abierto || !pago || typeof document === 'undefined') return null

  const ocupado = guardando || procesando

  return createPortal(
    <div
      className="pi-edit-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !ocupado) onCerrar()
      }}
    >
      <div
        className="pi-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <header className="pi-edit-modal__head">
          <div className="pi-edit-modal__badge" aria-hidden>
            <Pencil size={20} />
          </div>
          <div className="pi-edit-modal__titles">
            <h2 id={tituloId}>Modificar pago</h2>
            <p>
              Folio <strong>№ {pago.pago_folio}</strong> · {nombreAlumno}
            </p>
          </div>
          <button
            type="button"
            className="pi-edit-modal__close"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <form
          className="pi-edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            void guardar(true)
          }}
        >
          <label>
            Alumno
            <input type="text" readOnly value={nombreAlumno} className="pi-input pi-input--ro" />
          </label>
          <label>
            Folio
            <input
              type="number"
              readOnly
              className="pi-input pi-input--ro"
              value={pago.pago_folio}
              title="El folio no se modifica (protege el talón)"
              aria-label="Folio del recibo (no editable)"
            />
          </label>
          <label>
            Concepto
            <select
              className="pi-select"
              value={conceptoId || ''}
              disabled={ocupado}
              onChange={(e) => void onCambioConcepto(Number(e.target.value))}
            >
              <option value="">No seleccionado</option>
              {conceptosEditables.map((c) => (
                <option key={c.concepto_id} value={c.concepto_id}>
                  {c.concepto_clase}
                </option>
              ))}
            </select>
          </label>
          <label>
            Concepto extra
            <input
              type="text"
              className="pi-input"
              maxLength={50}
              placeholder="Texto extra al concepto…"
              value={conceptoOtro}
              disabled={ocupado}
              onChange={(e) => setConceptoOtro(e.target.value)}
            />
          </label>
          <label>
            Monto
            <input
              type="number"
              min={0}
              step={0.01}
              className="pi-input"
              value={importe}
              disabled={ocupado}
              onChange={(e) =>
                setImporte(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </label>
          <label>
            Fecha de pago
            <input
              type="date"
              className="pi-input"
              value={fechaPago}
              disabled={ocupado}
              onChange={(e) => setFechaPago(e.target.value)}
            />
          </label>
          <label>
            Ciclo escolar
            <select
              className="pi-select"
              value={String(cicloPago)}
              disabled={ocupado}
              onChange={(e) => {
                const c = Number(e.target.value)
                setCicloPago(c)
                if (conceptoId > 0) void aplicarPrecio(conceptoId, c)
              }}
            >
              {opcionesCiclo.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>

          {bloqueoManuales && (
            <p className="pi-msg pi-msg--error" role="alert">
              {mensajeManualesRequiereCuotaPadres()}
            </p>
          )}
          {error && (
            <p className="pi-msg pi-msg--error" role="alert">
              {error}
            </p>
          )}

          <footer className="pi-edit-modal__foot">
            <button
              type="button"
              className="pi-edit-btn pi-edit-btn--ghost"
              onClick={onCerrar}
              disabled={ocupado}
            >
              Volver
            </button>
            <button
              type="button"
              className="pi-edit-btn pi-edit-btn--secondary"
              disabled={ocupado || bloqueoManuales}
              onClick={() => void guardar(false)}
            >
              {guardando && !imprimirTrasGuardar ? (
                <Loader2 size={16} className="pi-spin" aria-hidden />
              ) : (
                <Save size={16} aria-hidden />
              )}
              Guardar
            </button>
            <button
              type="submit"
              className="pi-edit-btn pi-edit-btn--primary"
              disabled={ocupado || bloqueoManuales}
            >
              {guardando && imprimirTrasGuardar ? (
                <Loader2 size={16} className="pi-spin" aria-hidden />
              ) : (
                <Printer size={16} aria-hidden />
              )}
              Guardar/Imprimir
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  )
}
