'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  FORMAS_PAGO_COLEGIATURA,
  conceptosBoucherParaSelect,
  crearPagoColegiaturaManual,
  type ConceptoBoucher,
  type FormaPagoColegiatura,
} from '@/lib/pagoColegiaturaService'

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface PagosColegiaturaManualFormProps {
  alumnoRef: string
  nombreAlumno: string
  cicloInicial: number
  cicloActualSistema: number
  opcionesCiclo: { valor: number; etiqueta: string }[]
  cargandoCiclos: boolean
  conceptos: ConceptoBoucher[]
  onExito: () => void
  onError: (mensaje: string | null) => void
}

export default function PagosColegiaturaManualForm({
  alumnoRef,
  nombreAlumno,
  cicloInicial,
  cicloActualSistema,
  opcionesCiclo,
  cargandoCiclos,
  conceptos,
  onExito,
  onError,
}: PagosColegiaturaManualFormProps) {
  const opcionesConcepto = useMemo(
    () => conceptosBoucherParaSelect(conceptos),
    [conceptos]
  )

  const [conceptoNo, setConceptoNo] = useState('')
  const [importe, setImporte] = useState('')
  const [recargo, setRecargo] = useState('0')
  const [fechaPago, setFechaPago] = useState(hoyIso)
  const [formaPago, setFormaPago] = useState<FormaPagoColegiatura>('PaymentClabe')
  const [cicloPago, setCicloPago] = useState(cicloInicial)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    setCicloPago(cicloInicial)
  }, [cicloInicial])

  useEffect(() => {
    if (opcionesConcepto.length > 0 && !conceptoNo) {
      setConceptoNo(opcionesConcepto[0].no)
    }
  }, [opcionesConcepto, conceptoNo])

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      onError(null)
      setMensaje(null)

      const monto = Number(importe)
      const montoRecargo = Number(recargo)
      if (!conceptoNo || !Number.isFinite(monto) || monto < 0) {
        onError('Selecciona concepto e ingresa un monto válido.')
        return
      }
      if (!Number.isFinite(montoRecargo) || montoRecargo < 0) {
        onError('Los recargos deben ser un número válido.')
        return
      }

      setGuardando(true)
      const alumno = await obtenerAlumnoPorRef(alumnoRef, cicloPago)
      if (!alumno) {
        setGuardando(false)
        onError('El alumno no tiene inscripción en el ciclo escolar seleccionado.')
        return
      }

      const pagoNombre = nombreAlumno.trim().toUpperCase()
      const resultado = await crearPagoColegiaturaManual({
        alumnoId: alumno.alumno_id,
        alumnoRef,
        pagoNombre,
        conceptoNo,
        cicloEscolar: cicloPago,
        importe: monto,
        recargo: montoRecargo,
        fechaPago,
        formaPago,
      })

      setGuardando(false)

      if (!resultado.ok) {
        onError(resultado.mensaje)
        return
      }

      setImporte('')
      setRecargo('0')
      setFechaPago(hoyIso())
      setMensaje(`Pago manual registrado. Referencia ${resultado.referencia}.`)
      onExito()
    },
    [
      alumnoRef,
      nombreAlumno,
      conceptoNo,
      importe,
      recargo,
      fechaPago,
      formaPago,
      cicloPago,
      onExito,
      onError,
    ]
  )

  return (
    <section className="pc-form-manual" aria-labelledby="pc-form-manual-titulo">
      <h2 id="pc-form-manual-titulo" className="pc-form-manual-titulo">
        Agregar pago extraviado o adelantado
      </h2>
      <p className="pc-form-manual-lead">
        El pago se registrará con estatus <strong>Agregado manual</strong> en el historial.
      </p>

      <form className="pc-form-manual-grid" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="pc-form-manual-field pc-form-manual-field--full">
          <label htmlFor="pc_manual_alumno" className="pc-form-manual-label">
            Alumno
          </label>
          <input
            id="pc_manual_alumno"
            type="text"
            className="pc-form-manual-input pc-form-manual-input--readonly"
            value={nombreAlumno}
            readOnly
          />
        </div>

        <div className="pc-form-manual-field pc-form-manual-field--concepto">
          <label htmlFor="pc_manual_concepto" className="pc-form-manual-label">
            Concepto
          </label>
          <select
            id="pc_manual_concepto"
            className="pc-form-manual-select"
            value={conceptoNo}
            onChange={(e) => setConceptoNo(e.target.value)}
            disabled={opcionesConcepto.length === 0}
          >
            {opcionesConcepto.length === 0 && <option value="">Sin catálogo</option>}
            {opcionesConcepto.map((c) => (
              <option key={c.no} value={c.no}>
                {c.clase}
              </option>
            ))}
          </select>
        </div>

        <div className="pc-form-manual-field pc-form-manual-field--monto">
          <label htmlFor="pc_manual_importe" className="pc-form-manual-label">
            Monto
          </label>
          <input
            id="pc_manual_importe"
            type="number"
            min={0}
            step={0.01}
            className="pc-form-manual-input"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="pc-form-manual-field pc-form-manual-field--monto">
          <label htmlFor="pc_manual_recargo" className="pc-form-manual-label">
            Recargos
          </label>
          <input
            id="pc_manual_recargo"
            type="number"
            min={0}
            step={0.01}
            className="pc-form-manual-input"
            value={recargo}
            onChange={(e) => setRecargo(e.target.value)}
          />
        </div>

        <div className="pc-form-manual-field pc-form-manual-field--fecha">
          <label htmlFor="pc_manual_fecha" className="pc-form-manual-label">
            Fecha de pago
          </label>
          <input
            id="pc_manual_fecha"
            type="date"
            className="pc-form-manual-input"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
          />
        </div>

        <div className="pc-form-manual-field pc-form-manual-field--forma">
          <label htmlFor="pc_manual_forma" className="pc-form-manual-label">
            Forma de pago
          </label>
          <select
            id="pc_manual_forma"
            className="pc-form-manual-select"
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value as FormaPagoColegiatura)}
          >
            {FORMAS_PAGO_COLEGIATURA.map((forma) => (
              <option key={forma} value={forma}>
                {forma}
              </option>
            ))}
          </select>
        </div>

        <div className="pc-form-manual-field pc-form-manual-field--ciclo">
          <label htmlFor="pc_manual_ciclo" className="pc-form-manual-label">
            Ciclo escolar
          </label>
          <select
            id="pc_manual_ciclo"
            className="pc-form-manual-select"
            value={String(cicloPago)}
            disabled={cargandoCiclos || opcionesCiclo.length === 0}
            onChange={(e) => setCicloPago(Number(e.target.value))}
          >
            {opcionesCiclo.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
                {o.valor === cicloActualSistema ? ' (activo)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="pc-form-manual-acciones">
          <button
            type="submit"
            className="pc-form-manual-btn"
            disabled={guardando || opcionesConcepto.length === 0}
          >
            {guardando ? (
              <Loader2 size={18} className="pc-spin" aria-hidden />
            ) : (
              <Save size={18} aria-hidden />
            )}
            Aplicar pago
          </button>
        </div>
      </form>

      {mensaje ? (
        <p className="pc-msg pc-msg--ok" role="status">
          {mensaje}
        </p>
      ) : null}
    </section>
  )
}
