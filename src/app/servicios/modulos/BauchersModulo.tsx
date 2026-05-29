'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Receipt } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { vigenciaBoucherPorDefecto } from '@/lib/boucherCore'
import { listarConceptosBoucher } from '@/lib/pagoColegiaturaService'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import type { FilaTablaPrecios } from '@/lib/boucherService'

function formatearMonto(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BauchersModulo() {
  const { cicloSeleccionado, opcionesCatalogo } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [conceptos, setConceptos] = useState<{ no: string; clase: string }[]>([])
  const [precios, setPrecios] = useState<FilaTablaPrecios[]>([])
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [nombreAlumno, setNombreAlumno] = useState('')

  const [concepto, setConcepto] = useState('0')
  const [referencia, setReferencia] = useState('')
  const [importe, setImporte] = useState('0.00')
  const [vigencia, setVigencia] = useState(vigenciaBoucherPorDefecto())
  const [cicloBoucher, setCicloBoucher] = useState(cicloSeleccionado)
  const [aplicarRecargos, setAplicarRecargos] = useState(false)
  const [ignorarMesPago, setIgnorarMesPago] = useState(false)

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [cargandoPrecios, setCargandoPrecios] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const importeManual = useRef(false)

  useEffect(() => {
    listarConceptosBoucher().then((lista) => {
      setConceptos(
        lista
          .filter((c) => c.concepto_tipo !== 3)
          .map((c) => ({
            no: String(c.concepto_no).padStart(2, '0'),
            clase: c.concepto_clase,
          }))
      )
    })
  }, [])

  useEffect(() => {
    setCicloBoucher(cicloSeleccionado)
  }, [cicloSeleccionado])

  const cargarPrecios = useCallback(async (ciclo: number) => {
    setCargandoPrecios(true)
    setError(null)
    try {
      const res = await fetch(`/api/bauchers/precios?ciclo=${ciclo}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar precios')
      setPrecios(json.filas ?? [])
    } catch (e) {
      setPrecios([])
      setError(e instanceof Error ? e.message : 'Error al cargar precios')
    } finally {
      setCargandoPrecios(false)
    }
  }, [])

  useEffect(() => {
    if (cicloBoucher) cargarPrecios(cicloBoucher)
  }, [cicloBoucher, cargarPrecios])

  useEffect(() => {
    if (!alumnoSeleccionado?.alumno_ref || resolviendoCiclo) return
    let cancel = false
    ;(async () => {
      const reg = await obtenerAlumnoPorRef(alumnoSeleccionado.alumno_ref, cicloSeleccionado)
      if (cancel || !reg) return
      setAlumnoId(reg.alumno_id)
      setNombreAlumno(
        `${reg.alumno_app} ${reg.alumno_apm} ${reg.alumno_nombre}`.trim().toUpperCase()
      )
      setReferencia('')
      setPdfUrl(null)
      importeManual.current = false
    })()
    return () => {
      cancel = true
    }
  }, [alumnoSeleccionado, cicloSeleccionado, resolviendoCiclo])

  const recalcular = useCallback(
    async (importeOverride?: number | null) => {
      if (!alumnoId || concepto === '0' || !cicloBoucher) {
        setReferencia('')
        if (concepto === '0') setImporte('0.00')
        return
      }

      setCalculando(true)
      setError(null)
      try {
        const body: Record<string, unknown> = {
          alumnoId,
          conceptoNo: concepto,
          cicloEscolar: cicloBoucher,
        }
        if (importeOverride != null) body.importe = importeOverride

        const res = await fetch('/api/bauchers/calcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error al calcular')

        if (importeOverride == null && !importeManual.current) {
          setImporte(formatearMonto(json.importe))
        }
        setReferencia(json.referencia ?? '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al calcular baucher')
      } finally {
        setCalculando(false)
      }
    },
    [alumnoId, concepto, cicloBoucher]
  )

  useEffect(() => {
    importeManual.current = false
    recalcular()
  }, [alumnoId, concepto, cicloBoucher, recalcular])

  const onImporteChange = (valor: string) => {
    setImporte(valor)
    importeManual.current = true
    if (calcTimer.current) clearTimeout(calcTimer.current)
    calcTimer.current = setTimeout(() => {
      const n = parseFloat(valor.replace(/,/g, ''))
      if (!Number.isNaN(n)) recalcular(n)
    }, 350)
  }

  const generarPdf = async () => {
    if (!alumnoId || concepto === '0') {
      setError('Selecciona un alumno y un concepto')
      return
    }
    const monto = parseFloat(importe.replace(/,/g, ''))
    if (!monto || !referencia) {
      setError('Importe y referencia son obligatorios')
      return
    }

    setGenerando(true)
    setError(null)
    try {
      const res = await fetch('/api/bauchers/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          nombreAlumno,
          conceptoNo: concepto,
          referencia,
          importe: monto,
          vigencia,
          cicloEscolar: cicloBoucher,
          aplicarRecargos,
          ignorarMesPago,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al generar PDF')

      const bytes = Uint8Array.from(atob(json.pdfBase64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/pdf' })
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      setPdfUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar baucher')
    } finally {
      setGenerando(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const opcionesCiclo = useMemo(
    () =>
      opcionesCatalogo.length
        ? opcionesCatalogo
        : [{ valor: cicloSeleccionado, etiqueta: etiquetaCicloEscolar(cicloSeleccionado) }],
    [opcionesCatalogo, cicloSeleccionado]
  )

  return (
    <div className="servicios-panel-inner bch-modulo">
      <header className="bch-encabezado">
        <div className="bch-encabezado-icono">
          <Receipt size={22} aria-hidden />
        </div>
        <div>
          <h1 className="bch-encabezado-h1">Bauchers</h1>
          <p className="bch-encabezado-lead">
            Genera bauchers de pago con referencia Banorte, igual que en el sistema legacy.
          </p>
        </div>
      </header>

      <div className="bch-layout">
        <section className="bch-panel">
          <AlumnoAutocomplete
            etiqueta="Nombre del alumno / No. control"
            alumnoSeleccionado={alumnoSeleccionado}
            onSeleccionar={setAlumnoSeleccionado}
          />

          <fieldset className="bch-formulario">
            <legend>Generar Baucher</legend>

            <label className="bch-campo">
              <span>Alumno</span>
              <input type="text" readOnly value={nombreAlumno} placeholder="Busca un alumno arriba…" />
            </label>

            <label className="bch-campo">
              <span>Concepto</span>
              <select value={concepto} onChange={(e) => setConcepto(e.target.value)}>
                <option value="0">Sin Concepto</option>
                {conceptos.map((c) => (
                  <option key={c.no} value={c.no}>
                    {c.clase}
                  </option>
                ))}
              </select>
            </label>

            <label className="bch-campo">
              <span>Referencia</span>
              <input type="text" readOnly value={referencia} placeholder="12 dígitos…" maxLength={12} />
            </label>

            <label className="bch-campo">
              <span>Importe</span>
              <input
                type="text"
                value={importe}
                onChange={(e) => onImporteChange(e.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="bch-campo">
              <span>Vigencia</span>
              <input
                type="date"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            </label>

            <label className="bch-campo">
              <span>Ciclo Escolar</span>
              <select
                value={cicloBoucher}
                onChange={(e) => setCicloBoucher(Number(e.target.value))}
              >
                {opcionesCiclo.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="bch-campo">
              <span>¿Aplicar Recargos?</span>
              <select
                value={aplicarRecargos ? '1' : '0'}
                onChange={(e) => setAplicarRecargos(e.target.value === '1')}
              >
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </label>

            <label className="bch-campo">
              <span>Ignorar Mes de pago</span>
              <select
                value={ignorarMesPago ? '1' : '0'}
                onChange={(e) => setIgnorarMesPago(e.target.value === '1')}
              >
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </label>

            <button
              type="button"
              className="bch-btn-generar"
              disabled={generando || calculando || !alumnoId || concepto === '0'}
              onClick={generarPdf}
            >
              {generando ? (
                <>
                  <Loader2 size={16} className="bch-spin" aria-hidden />
                  Generando…
                </>
              ) : (
                <>
                  <FileText size={16} aria-hidden />
                  Generar Baucher
                </>
              )}
            </button>

            {(calculando || cargandoPrecios) && (
              <p className="bch-estado">
                <Loader2 size={14} className="bch-spin" aria-hidden />
                {calculando ? 'Calculando referencia…' : 'Cargando precios…'}
              </p>
            )}
            {error && <p className="bch-error">{error}</p>}
          </fieldset>
        </section>

        <section className="bch-preview">
          {pdfUrl ? (
            <iframe title="Vista previa baucher" src={pdfUrl} className="bch-preview-iframe" />
          ) : (
            <div className="bch-preview-vacio">
              <FileText size={40} strokeWidth={1.2} aria-hidden />
              <p>El PDF aparecerá aquí al generar el baucher.</p>
            </div>
          )}
        </section>
      </div>

      <div className="bch-tabla-precios-wrap">
        <h2 className="bch-tabla-titulo">Precios por nivel (ciclo seleccionado)</h2>
        <div className="bch-tabla-scroll">
          <table className="bch-tabla">
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Inscripción</th>
                <th>Cuota Agosto</th>
                <th>Colegiatura</th>
                <th>Material Enero</th>
                <th>Seguro Escolar</th>
                <th>Cuota de Padres</th>
                <th>Certificado Cambridge</th>
              </tr>
            </thead>
            <tbody>
              {precios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="bch-tabla-vacio">
                    {cargandoPrecios ? 'Cargando…' : 'Sin precios para este ciclo'}
                  </td>
                </tr>
              ) : (
                precios.map((f) => (
                  <tr key={f.nivel}>
                    <td>{etiquetaNivelEscolar(f.nivel)}</td>
                    <td>{formatearMonto(f.inscripcion)}</td>
                    <td>{formatearMonto(f.agosto)}</td>
                    <td>{formatearMonto(f.colegiatura)}</td>
                    <td>{formatearMonto(f.material)}</td>
                    <td>{formatearMonto(f.seguro)}</td>
                    <td>{formatearMonto(f.cuotaPadres)}</td>
                    <td>{formatearMonto(f.cambridge)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
