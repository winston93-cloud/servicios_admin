'use client'

import { useMemo, useState } from 'react'
import { Calculator, ChefHat, Download, FileDown, Loader2 } from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import { generarReporteDiarioPdf } from '@/lib/pos/reporteDiarioPdf'
import { exportarReporteContableExcel } from '@/lib/pos/reporteContableExcel'
import {
  dateAFechaIso,
  fechaCorta,
  fechaIsoADate,
  fechaMx,
  moneda,
  sumarDias,
  type PosReporteContable,
  type PosResumenServicio,
} from '@/lib/pos/posTipos'
import { useToast } from './Toast'

function rangoMes(base: string, delta = 0): [string, string] {
  const d = fechaIsoADate(base)
  const ini = new Date(d.getFullYear(), d.getMonth() + delta, 1, 12)
  const fin = new Date(d.getFullYear(), d.getMonth() + delta + 1, 0, 12)
  return [dateAFechaIso(ini), dateAFechaIso(fin)]
}

function rangoSemana(base: string): [string, string] {
  const dow = (fechaIsoADate(base).getDay() + 6) % 7
  const lunes = sumarDias(base, -dow)
  return [lunes, sumarDias(lunes, 4)]
}

export default function ReportesView() {
  const toast = useToast()
  const hoy = fechaMx()
  const [fechaCocina, setFechaCocina] = useState(hoy)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [[inicio, fin], setRango] = useState<[string, string]>(() => rangoMes(hoy))
  const [reporte, setReporte] = useState<PosReporteContable | null>(null)
  const [cargando, setCargando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const atajos: { etiqueta: string; rango: [string, string] }[] = [
    { etiqueta: 'Este mes', rango: rangoMes(hoy) },
    { etiqueta: 'Mes anterior', rango: rangoMes(hoy, -1) },
    { etiqueta: 'Esta semana', rango: rangoSemana(hoy) },
    { etiqueta: 'Hoy', rango: [hoy, hoy] },
  ]

  const hojaCocina = async () => {
    const ventana = window.open('', '_blank')
    setGenerandoPdf(true)
    try {
      const [pagos, productos] = await Promise.all([posApi.dia(fechaCocina), posApi.productos(true)])
      generarReporteDiarioPdf(fechaCocina, pagos, productos, ventana)
    } catch (e) {
      ventana?.close()
      toast(e instanceof Error ? e.message : 'No se pudo generar la hoja de cocina.', 'error')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const generar = async () => {
    setCargando(true)
    try {
      setReporte(await posApi.contable(inicio, fin))
    } catch (e) {
      setReporte(null)
      toast(e instanceof Error ? e.message : 'No se pudo generar el reporte.', 'error')
    } finally {
      setCargando(false)
    }
  }

  const exportar = async () => {
    if (!reporte) return
    setExportando(true)
    try {
      await exportarReporteContableExcel(reporte)
    } catch {
      toast('No se pudo crear el Excel.', 'error')
    } finally {
      setExportando(false)
    }
  }

  const porServicio = useMemo(() => {
    if (!reporte) return []
    const m = new Map<string, PosResumenServicio>()
    for (const d of reporte.dias) {
      for (const s of d.servicios) {
        const a = m.get(s.codigo) ?? { ...s, cantidad: 0, total: 0, ludi: 0, caja: 0 }
        a.cantidad += s.cantidad
        a.total += s.total
        a.ludi += s.ludi
        a.caja += s.caja
        m.set(s.codigo, a)
      }
    }
    const orden = new Map(reporte.catalogo.map((p) => [p.codigoReporte, p.orden]))
    return [...m.values()].sort((a, b) => (orden.get(a.codigo) ?? 99) - (orden.get(b.codigo) ?? 99))
  }, [reporte])

  return (
    <div className="cj-page">
      <header className="cj-page-head">
        <div>
          <h1 className="cj-h1">Reportes</h1>
          <p className="cj-muted">Hoja de cocina del día y corte contable con reparto Ludy / caja.</p>
        </div>
      </header>

      <div className="cj-report-grid">
        <section className="cj-card cj-report-card">
          <span className="cj-report-icon" aria-hidden>
            <ChefHat size={22} />
          </span>
          <h2>Hoja de cocina</h2>
          <p className="cj-muted cj-small">
            Desayunos por grado (incluye Kinder, Maternal, docentes y externos) + estancias, comidas y tareas.
          </p>
          <div className="cj-row">
            <input
              type="date"
              className="cj-input cj-input--date"
              value={fechaCocina}
              onChange={(e) => e.target.value && setFechaCocina(e.target.value)}
              aria-label="Fecha de la hoja de cocina"
            />
            <button type="button" className="cj-btn cj-btn--primary" onClick={() => void hojaCocina()} disabled={generandoPdf}>
              {generandoPdf ? <Loader2 size={16} className="cj-spin" aria-hidden /> : <FileDown size={16} aria-hidden />}
              Generar PDF
            </button>
          </div>
        </section>

        <section className="cj-card cj-report-card">
          <span className="cj-report-icon cj-report-icon--cyan" aria-hidden>
            <Calculator size={22} />
          </span>
          <h2>Reporte contable</h2>
          <p className="cj-muted cj-small">Ventas pagadas por fecha de servicio. Exporta el Excel con el formato de contabilidad.</p>
          <div className="cj-chips">
            {atajos.map((a) => (
              <button
                key={a.etiqueta}
                type="button"
                className={`cj-chip${a.rango[0] === inicio && a.rango[1] === fin ? ' is-on' : ''}`}
                onClick={() => setRango(a.rango)}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
          <div className="cj-row">
            <label className="cj-field cj-field--inline">
              <span>Del</span>
              <input type="date" className="cj-input cj-input--date" value={inicio} max={fin} onChange={(e) => e.target.value && setRango([e.target.value, fin])} />
            </label>
            <label className="cj-field cj-field--inline">
              <span>al</span>
              <input type="date" className="cj-input cj-input--date" value={fin} min={inicio} onChange={(e) => e.target.value && setRango([inicio, e.target.value])} />
            </label>
            <button type="button" className="cj-btn cj-btn--primary" onClick={() => void generar()} disabled={cargando}>
              {cargando ? <Loader2 size={16} className="cj-spin" aria-hidden /> : <Calculator size={16} aria-hidden />}
              Generar
            </button>
          </div>
        </section>
      </div>

      {reporte ? (
        <section className="cj-reporte" aria-label="Resultado del reporte contable">
          <div className="cj-reporte-head">
            <h2 className="cj-h2">
              {fechaCorta(reporte.inicio)} — {fechaCorta(reporte.fin)}
            </h2>
            <button type="button" className="cj-btn cj-btn--primary" onClick={() => void exportar()} disabled={exportando || !reporte.dias.length}>
              <Download size={16} aria-hidden /> {exportando ? 'Creando…' : 'Exportar Excel'}
            </button>
          </div>

          <div className="cj-kpis">
            <div className="cj-kpi cj-kpi--accent">
              <span className="cj-kpi-label">Total vendido</span>
              <span className="cj-kpi-value">{moneda(reporte.totalVendido)}</span>
            </div>
            <div className="cj-kpi">
              <span className="cj-kpi-label">Para Ludy</span>
              <span className="cj-kpi-value">{moneda(reporte.totalLudi)}</span>
            </div>
            <div className="cj-kpi">
              <span className="cj-kpi-label">Caja</span>
              <span className="cj-kpi-value">{moneda(reporte.totalCaja)}</span>
            </div>
            <div className="cj-kpi">
              <span className="cj-kpi-label">Días con venta</span>
              <span className="cj-kpi-value">
                {reporte.dias.length}
                <small>· {reporte.totalClientes} clientes</small>
              </span>
            </div>
          </div>

          {reporte.dias.length === 0 ? (
            <div className="cj-card cj-empty">
              <p>No hay ventas pagadas en este rango.</p>
            </div>
          ) : (
            <div className="cj-report-tables">
              <div className="cj-card cj-table-card">
                <h3 className="cj-table-title">Por servicio</h3>
                <div className="cj-table-scroll">
                  <table className="cj-table">
                    <thead>
                      <tr>
                        <th>Servicio</th>
                        <th className="is-num">Pagados</th>
                        <th className="is-num">Ingreso</th>
                        <th className="is-num">Ludy</th>
                        <th className="is-num">Caja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porServicio.map((s) => (
                        <tr key={s.codigo}>
                          <td className="cj-strong">{s.codigo}</td>
                          <td className="is-num">{s.cantidad}</td>
                          <td className="is-num">{moneda(s.total)}</td>
                          <td className="is-num">{moneda(s.ludi)}</td>
                          <td className="is-num">{moneda(s.caja)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cj-card cj-table-card">
                <h3 className="cj-table-title">Por día</h3>
                <div className="cj-table-scroll">
                  <table className="cj-table">
                    <thead>
                      <tr>
                        <th>Día</th>
                        <th className="is-num">Clientes</th>
                        <th className="is-num">Vendido</th>
                        <th className="is-num">Ludy</th>
                        <th className="is-num">Caja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.dias.map((d) => (
                        <tr key={d.fecha}>
                          <td className="cj-strong">{fechaCorta(d.fecha)}</td>
                          <td className="is-num">{d.totalClientes}</td>
                          <td className="is-num">{moneda(d.totalVendido)}</td>
                          <td className="is-num">{moneda(d.totalLudi)}</td>
                          <td className="is-num">{moneda(d.totalCaja)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
