'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import type { CicloEscolarRegistro } from '@/lib/ciclosEscolaresService'
import type { FilaMatrizPortal, SeccionMatrizPortal } from '@/lib/portalPagosMatrizService'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { vigenciaBoucherPorDefecto } from '@/lib/boucherCore'
import PortalDocumentoModal, { type TipoDocumentoPortal } from './PortalDocumentoModal'
import PortalBoucherModal from './PortalBoucherModal'
import PortalTransferenciaModal, { type DatosTransferenciaPortal } from './PortalTransferenciaModal'
import PortalSpeiReciboModal from './PortalSpeiReciboModal'
import PortalPagosTablaSeccion from './PortalPagosTablaSeccion'

interface PortalColegiaturasSeccionesProps {
  alumnoId: number
  ciclo: CicloEscolarRegistro
  alumno: AlumnoRegistro
  secciones: SeccionMatrizPortal[]
  displayName?: string
  cargando?: boolean
  onActualizar?: () => void
}

function nombreCompletoAlumno(alumno: AlumnoRegistro, fallback?: string): string {
  const n = `${alumno.alumno_nombre ?? ''} ${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

/** Formato enlinea3: apellidos y nombre en mayúsculas */
function nombreAlumnoTransferencia(alumno: AlumnoRegistro, fallback?: string): string {
  const n = `${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''} ${alumno.alumno_nombre ?? ''}`.trim()
  return (n || fallback?.trim() || 'Alumno').toUpperCase()
}

export default function PortalColegiaturasSecciones({
  alumnoId,
  ciclo,
  alumno,
  secciones,
  displayName,
  cargando = false,
  onActualizar,
}: PortalColegiaturasSeccionesProps) {
  const [error, setError] = useState<string | null>(null)
  const [generandoBoucher, setGenerandoBoucher] = useState<string | null>(null)

  const [docModal, setDocModal] = useState<{
    abierto: boolean
    tipo: TipoDocumentoPortal
    url: string | null
    titulo: string
  }>({ abierto: false, tipo: 'pdf', url: null, titulo: '' })

  const [boucherModal, setBoucherModal] = useState<{
    abierto: boolean
    pdfUrl: string | null
    referencia: string | null
    concepto: string
  }>({ abierto: false, pdfUrl: null, referencia: null, concepto: '' })

  const [transferModal, setTransferModal] = useState<{
    abierto: boolean
    cargando: boolean
    datos: DatosTransferenciaPortal | null
  }>({ abierto: false, cargando: false, datos: null })

  const [speiModal, setSpeiModal] = useState<{
    abierto: boolean
    speiPdfUrl: string | null
    referenciaSpei: string | null
    concepto: string
  }>({ abierto: false, speiPdfUrl: null, referenciaSpei: null, concepto: '' })

  const imprimirBoucher = async (fila: FilaMatrizPortal) => {
    if (fila.pagado) return
    setGenerandoBoucher(fila.conceptoNo)
    setError(null)
    try {
      const calcRes = await fetch('/api/bauchers/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          conceptoNo: fila.conceptoNo,
          cicloEscolar: ciclo.valor,
        }),
      })
      const calc = await calcRes.json()
      if (!calcRes.ok) throw new Error(calc.error ?? 'No se pudo calcular la referencia.')

      const genRes = await fetch('/api/bauchers/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          conceptoNo: fila.conceptoNo,
          conceptoClase: fila.conceptoClase,
          cicloEscolar: ciclo.valor,
          vigencia: vigenciaBoucherPorDefecto(),
          importe: calc.importe,
          referencia: calc.referencia,
          nombreAlumno: nombreCompletoAlumno(alumno, displayName),
          aplicarRecargos: false,
          ignorarMesPago: false,
        }),
      })
      const gen = await genRes.json()
      if (!genRes.ok) throw new Error(gen.error ?? 'No se pudo generar el baucher.')

      setBoucherModal({
        abierto: true,
        pdfUrl: `data:application/pdf;base64,${gen.pdfBase64}`,
        referencia: gen.referencia,
        concepto: fila.conceptoClase,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar baucher.')
    }
    setGenerandoBoucher(null)
  }

  const abrirPagoEnLinea = async (fila: FilaMatrizPortal) => {
    if (fila.pagado) return
    setTransferModal({ abierto: true, cargando: true, datos: null })
    setError(null)
    try {
      let referencia =
        (fila.recargo ?? 0) > 0
          ? (fila.referenciaLinea ?? fila.referencia)
          : fila.referencia
      let importe =
        fila.importeLinea != null ? fila.importeLinea : (fila.importe ?? 0)
      if (!referencia) {
        const calcRes = await fetch('/api/bauchers/calcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alumnoId,
            conceptoNo: fila.conceptoNo,
            cicloEscolar: ciclo.valor,
          }),
        })
        const calc = await calcRes.json()
        if (!calcRes.ok) throw new Error(calc.error ?? 'No se pudo calcular la referencia.')
        referencia = (calc.referenciaLinea ?? calc.referencia) as string
        importe = Number(calc.importeLinea ?? calc.importe)
      }
      if (!referencia) throw new Error('No se obtuvo referencia de pago.')
      setTransferModal({
        abierto: true,
        cargando: false,
        datos: {
          alumno: nombreAlumnoTransferencia(alumno, displayName),
          grado: etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado),
          referenciaVentanilla: referencia,
          concepto: fila.conceptoClase,
          importe,
          alumnoId,
          conceptoNo: fila.conceptoNo,
          cicloEscolar: ciclo.valor,
          alumnoNivel: alumno.alumno_nivel,
        },
      })
    } catch (e) {
      setTransferModal({ abierto: false, cargando: false, datos: null })
      setError(e instanceof Error ? e.message : 'No se pudo abrir el pago en línea.')
    }
  }

  const abrirDoc = (tipo: TipoDocumentoPortal, url: string, concepto: string) => {
    setDocModal({
      abierto: true,
      tipo,
      url,
      titulo: tipo === 'pdf' ? `Factura PDF — ${concepto}` : `Factura XML — ${concepto}`,
    })
  }

  const sinConceptos = secciones.every((s) => s.filas.length === 0)

  return (
    <div className="portal-inscripciones-colegiaturas-bloque">
      {error && (
        <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
          {error}
        </div>
      )}

      {sinConceptos ? (
        <p className="portal-pagos-nota">
          No hay conceptos de colegiatura disponibles por el momento.
        </p>
      ) : (
        <div className="portal-matriz-contenedor">
          {secciones.map((seccion) => (
            <PortalPagosTablaSeccion
              key={seccion.id}
              seccion={seccion}
              generandoBoucher={generandoBoucher}
              onImprimirBoucher={(f) => void imprimirBoucher(f)}
              onPagoEnLinea={(f) => void abrirPagoEnLinea(f)}
              onVerPdf={(url, c) => abrirDoc('pdf', url, c)}
              onVerXml={(url, c) => abrirDoc('xml', url, c)}
            />
          ))}
        </div>
      )}

      {onActualizar && (
        <button
          type="button"
          className="portal-inscripciones-btn-sec"
          onClick={onActualizar}
          disabled={cargando}
        >
          <RefreshCw size={16} className={cargando ? 'portal-inscripciones-spin' : ''} aria-hidden />
          Actualizar colegiaturas
        </button>
      )}

      <PortalDocumentoModal
        abierto={docModal.abierto}
        tipo={docModal.tipo}
        url={docModal.url}
        titulo={docModal.titulo}
        onCerrar={() => setDocModal((s) => ({ ...s, abierto: false }))}
      />

      <PortalBoucherModal
        abierto={boucherModal.abierto}
        pdfUrl={boucherModal.pdfUrl}
        referencia={boucherModal.referencia}
        concepto={boucherModal.concepto}
        onCerrar={() => {
          setBoucherModal((s) => ({ ...s, abierto: false }))
          if (boucherModal.pdfUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(boucherModal.pdfUrl)
          }
        }}
      />

      <PortalTransferenciaModal
        abierto={transferModal.abierto}
        cargando={transferModal.cargando}
        datos={transferModal.datos}
        onCerrar={() => setTransferModal({ abierto: false, cargando: false, datos: null })}
        onSpeiGenerado={({ referenciaSpei, speiPdfUrl, concepto }) => {
          setSpeiModal({ abierto: true, speiPdfUrl, referenciaSpei, concepto })
        }}
      />

      <PortalSpeiReciboModal
        abierto={speiModal.abierto}
        speiPdfUrl={speiModal.speiPdfUrl}
        referenciaSpei={speiModal.referenciaSpei}
        concepto={speiModal.concepto}
        onCerrar={() =>
          setSpeiModal({ abierto: false, speiPdfUrl: null, referenciaSpei: null, concepto: '' })
        }
      />
    </div>
  )
}
