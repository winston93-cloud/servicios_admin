'use client'

import { useEffect, useState } from 'react'
import { X, Download, Calendar, Calculator } from 'lucide-react'
import * as XLSX from 'xlsx'
import { generarReporteContable } from '@/lib/reporteContableService'

interface ReporteContableModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ResumenServicio {
  servicio: string
  codigo: string
  precio: number
  cantidad: number
  total: number
  ludi: number
  caja: number
}

interface ResumenDia {
  fecha: string
  servicios: ResumenServicio[]
  totalVendido: number
  totalLudi: number
  totalCaja: number
  totalAlumnos: number
}

export default function ReporteContableModal({ isOpen, onClose }: ReporteContableModalProps) {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumenDias, setResumenDias] = useState<ResumenDia[]>([])
  const [totales, setTotales] = useState({ totalVendido: 0, totalLudi: 0, totalCaja: 0, totalAlumnos: 0 })

  // Inicializa al mes actual
  useEffect(() => {
    const hoy = new Date()
    const first = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const last = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    setFechaInicio(first.toISOString().split('T')[0])
    setFechaFin(last.toISOString().split('T')[0])
  }, [])

  const obtenerVentas = async () => {
    if (!fechaInicio || !fechaFin) return
    setLoading(true)
    try {
      const { resumenDias, resumenGeneral } = await generarReporteContable(fechaInicio, fechaFin)
      setResumenDias(resumenDias)
      setTotales(resumenGeneral)
    } catch (e) {
      console.error(e)
      alert('No se pudieron obtener las ventas. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = () => {
    if (!resumenDias.length) return

    const wb = XLSX.utils.book_new()

    // Generar hojas para cada día del mes (como en el Excel original)
    const fechaInicioObj = new Date(fechaInicio)
    const fechaFinObj = new Date(fechaFin)
    const diasEnMes = Math.ceil((fechaFinObj.getTime() - fechaInicioObj.getTime()) / (1000 * 60 * 60 * 24)) + 1

    for (let i = 0; i < diasEnMes; i++) {
      const fechaActual = new Date(fechaInicioObj)
      fechaActual.setDate(fechaInicioObj.getDate() + i)
      const fechaStr = fechaActual.toISOString().split('T')[0]
      const diaDelMes = i + 1
      
      // Buscar datos para este día
      const diaData = resumenDias.find(d => d.fecha === fechaStr)
      
      const rows: (string | number)[][] = []
      
      // Estructura exacta del Excel original - Replicando la estructura real
      // Fila 1: Headers principales
      rows.push(['DÍAS POR MES', 'PAGADOS', 'SERVICIO', 'PRECIO', 'LUDI', 'CAJA', 'INGRESO', '$ LUDI', 'CAJA', 'TOTAL'])
      
      // Fila 2: Mes y día
      rows.push([fechaActual.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase(), '', '', '', '', '', '', '', '', ''])
      
      // Fila 3: Vacía
      rows.push([])
      
      // Sección DÍAS POR MES - Estructura exacta del Excel
      rows.push(['DÍAS POR MES'])
      rows.push(['PAGADOS', 'SERVICIO', 'PRECIO', 'LUDI', 'CAJA', 'INGRESO', '$ LUDI', 'CAJA', 'TOTAL'])
      
      // Servicios fijos del Excel original
      const serviciosFijos = [
        { codigo: 'DCH', precio: 51, ludi: 45, caja: 6 },
        { codigo: 'DG', precio: 61, ludi: 55, caja: 6 },
        { codigo: 'COMIDA', precio: 87, ludi: 80, caja: 7 },
        { codigo: 'MEDIA', precio: 25, ludi: 0, caja: 25 },
        { codigo: 'ESTANCIA 5', precio: 112, ludi: 80, caja: 32 },
        { codigo: 'ESTANCIA 7', precio: 132, ludi: 80, caja: 52 },
        { codigo: 'TAREA 5', precio: 50, ludi: 0, caja: 50 },
        { codigo: 'TAREA 7', precio: 70, ludi: 0, caja: 70 },
        { codigo: 'EST. MES 5', precio: 106, ludi: 80, caja: 26 },
        { codigo: 'EST. MES 7', precio: 119, ludi: 80, caja: 39 }
      ]
      
      serviciosFijos.forEach(servicio => {
        const ventaDelDia = diaData?.servicios.find(s => s.codigo === servicio.codigo)
        const cantidad = ventaDelDia?.cantidad || 0
        const total = ventaDelDia?.total || 0
        
        rows.push([
          cantidad,
          servicio.codigo,
          servicio.precio,
          servicio.ludi,
          servicio.caja,
          total,
          servicio.ludi * cantidad,
          servicio.caja * cantidad,
          total
        ])
      })
      
      rows.push([])
      rows.push(['TOTAL VENDIDO', '', '', '', '', '', diaData?.totalVendido || 0])
      rows.push(['TOTAL CAJA', '', '', '', '', '', diaData?.totalCaja || 0])
      rows.push(['TOTAL LUDI', '', '', '', '', '', diaData?.totalLudi || 0])
      rows.push(['TOTAL ALUMNOS', '', '', '', '', '', diaData?.totalAlumnos || 0])
      
      rows.push([])
      
      // Sección POR ADELANTADO
      rows.push(['POR ADELANTADO'])
      rows.push(['PAGADOS', 'SERVICIO', 'PRECIO', 'LUDI', 'CAJA', 'INGRESO', '$ LUDI', 'CAJA', 'TOTAL'])
      rows.push([])
      
      // Sección PAGOS DEL DÍA DE HOY
      rows.push(['PAGOS DEL DÍA DE HOY'])
      if (diaData) {
        const dch = diaData.servicios.find(s => s.codigo === 'DCH')
        const dg = diaData.servicios.find(s => s.codigo === 'DG')
        const comida = diaData.servicios.find(s => s.codigo === 'COMIDA')
        
        if (dch) rows.push(['DCH:', dch.total])
        if (dg) rows.push(['DG:', dg.total])
        if (comida) rows.push(['COMIDA:', comida.total])
      }
      
      rows.push([])
      
      // Sección COBRADOS POR ADELANTADO
      rows.push(['COBRADOS POR ADELANTADO'])
      if (diaData) {
        const est5 = diaData.servicios.find(s => s.codigo === 'ESTANCIA 5')
        const est7 = diaData.servicios.find(s => s.codigo === 'ESTANCIA 7')
        const tarea5 = diaData.servicios.find(s => s.codigo === 'TAREA 5')
        
        if (est5) rows.push(['ESTANCIA 5:', est5.total])
        if (est7) rows.push(['ESTANCIA 7:', est7.total])
        if (tarea5) rows.push(['TAREA 5:', tarea5.total])
      }
      
      rows.push([])
      
      // Sección SERVICIOS PAGADOS EN DÍAS PASADOS
      rows.push(['SERVICIOS PAGADOS EN DÍAS PASADOS'])
      if (diaData) {
        const estMes5 = diaData.servicios.find(s => s.codigo === 'EST. MES 5')
        const estMes7 = diaData.servicios.find(s => s.codigo === 'EST. MES 7')
        const tarea7 = diaData.servicios.find(s => s.codigo === 'TAREA 7')
        
        if (estMes5) rows.push(['EST. MES 5:', estMes5.total])
        if (estMes7) rows.push(['EST. MES 7:', estMes7.total])
        if (tarea7) rows.push(['TAREA 7:', tarea7.total])
      }
      
      rows.push([])
      
      // Sección TOTAL PAGADO
      rows.push(['TOTAL PAGADO'])
      rows.push(['DEL DÍA DE HOY:', diaData?.totalVendido || 0])
      rows.push(['POR ADELANTADO:', 0])
      rows.push(['PAGADOS PREVIAMENTE:', 0])
      rows.push(['DEVOLUCIONES:', 0])
      rows.push(['TOTAL =', diaData?.totalVendido || 0])
      
      rows.push([])
      rows.push(['FIRMA DE RECIBIDO: _________________________'])

      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, `Día ${diaDelMes}`)
    }

    // Hoja TOTAL MES
    const totalesWs = XLSX.utils.aoa_to_sheet([
      ['TOTAL MES'],
      ['Total vendido', totales.totalVendido],
      ['Total caja', totales.totalCaja],
      ['Total Ludi', totales.totalLudi],
      ['Total alumnos', totales.totalAlumnos]
    ])
    XLSX.utils.book_append_sheet(wb, totalesWs, 'TOTAL MES')

    const nombre = `REPORTE_CONTABLE_${fechaInicio}_${fechaFin}.xlsx`
    XLSX.writeFile(wb, nombre)
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', width: '95%', maxWidth: 1200, maxHeight: '90vh', borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)', color: '#fff', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={22} />
            <strong>Reporte Contable</strong>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(90vh - 64px)' }}>
          {/* Filtros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, alignItems: 'end', marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={obtenerVentas} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#7c3aed', color: '#fff', border: 0, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', opacity: loading ? .6 : 1 }}>
                <Calendar size={16} /> {loading ? 'Generando…' : 'Generar reporte'}
              </button>
              {resumenDias.length > 0 && (
                <button onClick={exportarExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#059669', color: '#fff', border: 0, borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                  <Download size={16} /> Exportar Excel
                </button>
              )}
            </div>
          </div>

          {/* Mensaje simple */}
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>
            {resumenDias.length > 0 ? (
              <div>
                <p>✅ Reporte generado exitosamente</p>
                <p>📊 {resumenDias.length} días procesados</p>
                <p>💰 Total vendido: ${totales.totalVendido.toLocaleString()}</p>
                <p>📄 Haz clic en "Exportar Excel" para descargar el reporte completo</p>
              </div>
            ) : (
              <div>
                <p>📅 Selecciona el rango de fechas</p>
                <p>🔍 Haz clic en "Generar reporte" para procesar los datos</p>
                <p>📊 El reporte se exportará como Excel con la estructura original</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
