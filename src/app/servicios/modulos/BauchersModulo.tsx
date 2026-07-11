'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  Calendar,
  FileText,
  Hash,
  Loader2,
  Receipt,
  Sparkles,
  User,
} from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import {
  formatearReferenciaBoucher,
  getPaymentConcept,
  normalizarConceptoNo,
  parseImporteBoucher,
  vigenciaBoucherPorDefecto,
} from '@/lib/boucherCore'
import { listarConceptosBoucher, conceptosBoucherParaSelect } from '@/lib/pagoColegiaturaService'
import { etiquetaNivelPrecioBoucher } from '@/lib/boucherCore'
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
  const mapaConceptos = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of conceptos) m.set(c.no, c.clase)
    return m
  }, [conceptos])
  const [precios, setPrecios] = useState<FilaTablaPrecios[]>([])
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [alumnoRef, setAlumnoRef] = useState('')
  const [nombreAlumno, setNombreAlumno] = useState('')

  const [concepto, setConcepto] = useState('0')
  const [referencia, setReferencia] = useState('')
  const [importeTexto, setImporteTexto] = useState('0.00')
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

  const importeNumero = useMemo(() => parseImporteBoucher(importeTexto), [importeTexto])

  const conceptoEtiqueta = useMemo(() => {
    if (concepto === '0') return 'Sin concepto'
    if (ignorarMesPago) return 'Colegiatura'
    const no = normalizarConceptoNo(concepto)
    return mapaConceptos.get(no) ?? getPaymentConcept(no)
  }, [concepto, ignorarMesPago, mapaConceptos])

  const referenciaValida = useMemo(() => {
    const d = referencia.replace(/\D/g, '')
    return d.length === 12 && !referencia.includes('NaN')
  }, [referencia])

  useEffect(() => {
    listarConceptosBoucher().then((lista) => {
      setConceptos(conceptosBoucherParaSelect(lista))
    })
  }, [])

  useEffect(() => {
    setCicloBoucher(cicloSeleccionado)
  }, [cicloSeleccionado])

  const cargarPrecios = useCallback(async (ciclo: number) => {
    setCargandoPrecios(true)
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
      setAlumnoRef(String(reg.alumno_ref))
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
        if (concepto === '0') setImporteTexto('0.00')
        return
      }

      setCalculando(true)
      setError(null)
      try {
        const body: Record<string, unknown> = {
          alumnoId,
          conceptoNo: normalizarConceptoNo(concepto),
          cicloEscolar: cicloBoucher,
        }
        if (importeOverride != null && importeOverride > 0) {
          body.importe = importeOverride
        }

        const res = await fetch('/api/bauchers/calcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error al calcular')

        if (importeOverride == null && !importeManual.current) {
          setImporteTexto(formatearMonto(json.importe))
        }
        setReferencia(String(json.referencia ?? '').replace(/\D/g, '').slice(0, 12))
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
    setImporteTexto(valor)
    importeManual.current = true
    if (calcTimer.current) clearTimeout(calcTimer.current)
    calcTimer.current = setTimeout(() => {
      const n = parseImporteBoucher(valor)
      if (n > 0) recalcular(n)
    }, 400)
  }

  const generarPdf = async () => {
    if (!alumnoId || concepto === '0') {
      setError('Selecciona un alumno y un concepto')
      return
    }
    if (!referenciaValida || importeNumero <= 0) {
      setError('Revisa el importe y espera a que se calcule la referencia de 12 dígitos')
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
          conceptoNo: normalizarConceptoNo(concepto),
          referencia: referencia.replace(/\D/g, ''),
          importe: importeNumero,
          vigencia,
          cicloEscolar: cicloBoucher,
          aplicarRecargos,
          ignorarMesPago,
          conceptoClase: conceptoEtiqueta,
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

  const listoParaGenerar =
    !!alumnoId && concepto !== '0' && referenciaValida && importeNumero > 0 && !calculando

  return (
    <div className="servicios-panel-inner bch-modulo">
      <header className="bch-hero">
        <div className="bch-hero-glow" aria-hidden />
        <div className="bch-hero-inner">
          <div className="bch-hero-icono" aria-hidden>
            <Receipt size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="bch-hero-kicker">
              <Sparkles size={14} aria-hidden />
              Pagos bancarios
            </p>
            <h1 className="bch-hero-titulo">Bauchers</h1>
          </div>
        </div>
      </header>

      <section className="bch-busqueda">
        <AlumnoAutocomplete
          etiqueta="Nombre del alumno / No. control"
          alumnoSeleccionado={alumnoSeleccionado}
          onSeleccionar={setAlumnoSeleccionado}
        />
      </section>

      <div className="bch-layout">
        <div className="bch-columna-form">
          {nombreAlumno && (
            <div className="bch-alumno-chip">
              <User size={16} aria-hidden />
              <div>
                <span className="bch-alumno-chip-label">Alumno seleccionado</span>
                <strong>{nombreAlumno}</strong>
                {alumnoRef && <span className="bch-alumno-chip-ref">No. {alumnoRef}</span>}
              </div>
            </div>
          )}

          <div className="bch-card">
            <h2 className="bch-card-titulo">Generar baucher</h2>

            <div className="bch-grid">
              <label className="bch-campo bch-campo--full">
                <span>Concepto de pago</span>
                <select value={concepto} onChange={(e) => setConcepto(e.target.value)}>
                  <option value="0">Sin concepto</option>
                {conceptos.map((c) => (
                  <option key={c.no} value={c.no}>
                    {c.no} — {c.clase}
                  </option>
                ))}
                </select>
              </label>

              <label className="bch-campo">
                <span>
                  <Banknote size={14} aria-hidden />
                  Importe
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={importeTexto}
                  onChange={(e) => onImporteChange(e.target.value)}
                  placeholder="0.00"
                />
              </label>

              <label className="bch-campo">
                <span>
                  <Calendar size={14} aria-hidden />
                  Vigencia
                </span>
                <input
                  type="date"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                />
              </label>

              <label className="bch-campo">
                <span>Ciclo escolar</span>
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
                <span>¿Aplicar recargos?</span>
                <select
                  value={aplicarRecargos ? '1' : '0'}
                  onChange={(e) => setAplicarRecargos(e.target.value === '1')}
                >
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </select>
              </label>

              <label className="bch-campo">
                <span>Ignorar mes de pago</span>
                <select
                  value={ignorarMesPago ? '1' : '0'}
                  onChange={(e) => setIgnorarMesPago(e.target.value === '1')}
                >
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </select>
              </label>
            </div>

            <div
              className={`bch-referencia-box ${referenciaValida ? 'bch-referencia-box--ok' : ''} ${calculando ? 'bch-referencia-box--loading' : ''}`}
            >
              <div className="bch-referencia-head">
                <Hash size={16} aria-hidden />
                <span>Referencia bancaria (12 dígitos)</span>
                {calculando && <Loader2 size={14} className="bch-spin" aria-hidden />}
              </div>
              <p className="bch-referencia-valor" aria-live="polite">
                {referenciaValida
                  ? formatearReferenciaBoucher(referencia)
                  : referencia.includes('NaN')
                    ? 'Error al calcular — revisa el importe'
                    : '— — — — — — — — — — — —'}
              </p>
              <p className="bch-referencia-hint">
                Incluye dígito del importe y 2 dígitos verificadores Banorte (algoritmo legacy).
              </p>
            </div>

            <button
              type="button"
              className="bch-btn-generar"
              disabled={generando || !listoParaGenerar}
              onClick={generarPdf}
            >
              {generando ? (
                <>
                  <Loader2 size={18} className="bch-spin" aria-hidden />
                  Generando PDF…
                </>
              ) : (
                <>
                  <FileText size={18} aria-hidden />
                  Generar baucher
                </>
              )}
            </button>

            {error && (
              <p className="bch-alerta bch-alerta--error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="bch-resumen">
            <dl>
              <div>
                <dt>Concepto en PDF</dt>
                <dd>{conceptoEtiqueta}</dd>
              </div>
              <div>
                <dt>Importe</dt>
                <dd>{importeNumero > 0 ? formatearMonto(importeNumero) : '—'}</dd>
              </div>
              <div>
                <dt>Ciclo</dt>
                <dd>{etiquetaCicloEscolar(cicloBoucher)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="bch-preview" aria-label="Vista previa del baucher">
          <div className="bch-preview-head">
            <FileText size={18} aria-hidden />
            <span>Vista previa</span>
          </div>
          {pdfUrl ? (
            <iframe title="Vista previa baucher" src={pdfUrl} className="bch-preview-iframe" />
          ) : (
            <div className="bch-preview-vacio">
              <div className="bch-preview-icono" aria-hidden>
                <Receipt size={48} strokeWidth={1.1} />
              </div>
              <p className="bch-preview-titulo">Sin PDF aún</p>
              <p className="bch-preview-texto">
                Busca un alumno, elige concepto y pulsa <strong>Generar baucher</strong>.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="bch-tabla-precios-wrap">
        <div className="bch-tabla-head">
          <h2>Precios por nivel</h2>
          <span className="bch-tabla-ciclo">{etiquetaCicloEscolar(cicloBoucher)}</span>
          {cargandoPrecios && <Loader2 size={14} className="bch-spin" aria-hidden />}
        </div>
        <div className="bch-tabla-scroll">
          <table className="bch-tabla">
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Inscripción</th>
                <th>Cuota agosto</th>
                <th>Colegiatura</th>
                <th>Material</th>
                <th>Seguro</th>
                <th>Cuota padres</th>
                <th>Cambridge</th>
              </tr>
            </thead>
            <tbody>
              {precios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="bch-tabla-vacio">
                    {cargandoPrecios ? 'Cargando precios…' : 'Sin precios para este ciclo'}
                  </td>
                </tr>
              ) : (
                precios.map((f) => (
                  <tr key={f.nivel}>
                    <td>
                      <span className="bch-nivel-pill">{etiquetaNivelPrecioBoucher(f.nivel)}</span>
                    </td>
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
      </section>
    </div>
  )
}
