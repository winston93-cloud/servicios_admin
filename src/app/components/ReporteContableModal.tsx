'use client'

import React, { useState, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { obtenerVentasPorPeriodo, procesarVentasPorDia, calcularResumenGeneral } from '@/lib/reporteContableService'
import { X, Download, Calendar, Calculator } from 'lucide-react'

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

// Función para calcular TODOS los días laborales del mes
function calcularDiasLaboralesDelMes(año: number, mes: number): number {
  const diasAsueto = [
    '2025-01-01', '2025-02-03', '2025-03-17', '2025-05-01', '2025-05-05',
    '2025-09-16', '2025-11-03', '2025-11-17', '2025-12-25'
  ]
  
  const ultimoDia = new Date(año, mes + 1, 0)
  const diasEnMes = ultimoDia.getDate()
  let diasLaborales = 0
  
  // Calcular TODOS los días laborales del mes (del 1 al último día)
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(año, mes, dia)
    const diaSemana = fecha.getDay() // 0 = domingo, 6 = sábado
    const fechaStr = `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    
    // No contar fines de semana (sábado = 6, domingo = 0)
    if (diaSemana !== 0 && diaSemana !== 6) {
      // No contar días de asueto
      if (!diasAsueto.includes(fechaStr)) {
        diasLaborales++
      }
    }
  }
  
  return diasLaborales
}

export default function ReporteContableModal({ isOpen, onClose }: ReporteContableModalProps) {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumenDias, setResumenDias] = useState<ResumenDia[]>([])
  const [totales, setTotales] = useState({ totalVendido: 0, totalLudi: 0, totalCaja: 0, totalAlumnos: 0, diasConVentas: 0 })

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
      const ventas = await obtenerVentasPorPeriodo(fechaInicio, fechaFin)
      const resumen = procesarVentasPorDia(ventas)
      const totalesCalculados = calcularResumenGeneral(resumen)

      setResumenDias(resumen)
      setTotales(totalesCalculados)
    } catch (error) {
      console.error('Error al generar reporte:', error)
      alert('No se pudieron obtener las ventas. Verifica tu conexión o intenta con otro rango de fechas.')
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = async () => {
    if (!resumenDias.length) return

    const workbook = new ExcelJS.Workbook()

    // Generar hojas para cada día del mes (como en el Excel original)
    // Parsear fechas correctamente para evitar problemas de zona horaria
    const [añoInicio, mesInicio, diaInicio] = fechaInicio.split('-').map(Number)
    const [añoFin, mesFin, diaFin] = fechaFin.split('-').map(Number)
    
    const fechaInicioObj = new Date(añoInicio, mesInicio - 1, diaInicio)
    const fechaFinObj = new Date(añoFin, mesFin - 1, diaFin)
    const diasEnMes = Math.ceil((fechaFinObj.getTime() - fechaInicioObj.getTime()) / (1000 * 60 * 60 * 24)) + 1

    for (let i = 0; i < diasEnMes; i++) {
      const fechaActual = new Date(añoInicio, mesInicio - 1, diaInicio + i)
      const fechaStr = fechaActual.toISOString().split('T')[0]
      const diaDelMes = fechaActual.getDate()

      // Buscar datos para este día
      const diaData = resumenDias.find(d => d.fecha === fechaStr)

      const worksheet = workbook.addWorksheet(`Día ${diaDelMes}`)

      // Configurar anchos de columna para mejor visualización
      worksheet.columns = [
        { width: 35 }, // DÍAS POR MES (más ancho para el texto largo)
        { width: 12 }, // PAGADOS
        { width: 15 }, // SERVICIO
        { width: 15 }, // INGRESO
        { width: 12 }, // $ LUDI
        { width: 12 }, // CAJA
        { width: 10 }, // % LUDI
        { width: 10 }  // % CAJA
      ]

      // Servicios fijos del Excel original con colores exactos de la imagen
      const servicios = [
        { codigo: 'DCH', precio: 51, ludi: 45, caja: 6, color: 'FFE4CC' }, // Naranja claro/durazno
        { codigo: 'DG', precio: 61, ludi: 55, caja: 6, color: 'FFD9E1F2' }, // Azul claro
        { codigo: 'COMIDA', precio: 57, ludi: 50, caja: 7, color: 'FFE2EFDA' }, // Morado claro
        { codigo: 'MEDIA', precio: 25, ludi: 25, caja: 0, color: 'FFD9E1F2' }, // Azul claro (igual que DG)
        { codigo: 'ESTANCIA 5', precio: 112, ludi: 80, caja: 32, color: 'FFFCE4D6' }, // Rosa claro
        { codigo: 'ESTANCIA 7', precio: 132, ludi: 80, caja: 52, color: 'FFD9E1F2' }, // Azul claro (igual que DG/MEDIA)
        { codigo: 'TAREA 5', precio: 50, ludi: 0, caja: 50, color: 'FFE2EFDA' }, // Morado claro (igual que COMIDA)
        { codigo: 'TAREA 7', precio: 70, ludi: 0, caja: 70, color: 'FFF2F2F2' }, // Gris claro
        { codigo: 'EST. MES 5', precio: 106, ludi: 80, caja: 26, color: 'FFD9D9D9' }, // Verde oliva/marrón claro
        { codigo: 'EST. MES 7', precio: 119, ludi: 80, caja: 39, color: 'FFC6E0B4' } // Verde claro
      ]

      // FILA 1: Headers
      const headerRow = worksheet.getRow(1)
      headerRow.values = ['DÍAS POR MES', 'PAGADOS', 'SERVICIO', 'INGRESO', '$ LUDI', 'CAJA', '% LUDI', '% CAJA']
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      // FILA 2+: Servicios EMPEZANDO EN FILA 2
      console.log('🔧 Generando servicios para día', diaDelMes, '- Total servicios:', servicios.length)
      
      servicios.forEach((servicio, index) => {
        const ventaDelDia = diaData?.servicios.find(s => s.codigo === servicio.codigo)
        const cantidad = ventaDelDia?.cantidad || 0

        // Cálculos exactos como me explicaste
        const ingreso = cantidad * servicio.precio
        const ludi = cantidad * servicio.ludi
        const caja = cantidad * servicio.caja
        
        // Calcular porcentajes
        const porcentajeLudi = servicio.precio > 0 ? Math.round((servicio.ludi / servicio.precio) * 100) : 0
        const porcentajeCaja = servicio.precio > 0 ? Math.round((servicio.caja / servicio.precio) * 100) : 0

        console.log(`📊 Servicio ${index + 1}: ${servicio.codigo} - Cantidad: ${cantidad}, Color: ${servicio.color}`)

        // Usar fila específica (fila 2 + index) - empezar en fila 2 (subido 2 filas)
        const rowIndex = 2 + index
        const servicioRow = worksheet.getRow(rowIndex)
        servicioRow.values = [
          '', // DÍAS POR MES - vacío pero con fondo negro
          cantidad, // PAGADOS - número de pedidos pagados
          servicio.codigo, // SERVICIO - tipo de servicio
          ingreso, // INGRESO - cantidad × precio
          ludi, // $ LUDI - lo que se paga a la cocinera
          caja, // CAJA - lo que resta después de pagar a la cocinera
          porcentajeLudi, // % LUDI - porcentaje de Ludi
          porcentajeCaja // % CAJA - porcentaje de Caja
        ]

        // Aplicar color de fondo y centrado a TODAS las celdas de la fila
        servicioRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) {
            // Columna A con fondo negro - igual que mes y día
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else {
            // Resto de columnas con color del servicio
            cell.fill = { 
              type: 'pattern', 
              pattern: 'solid', 
              fgColor: { argb: servicio.color }
            }
            cell.font = { color: { argb: 'FF000000' }, bold: false }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            
                  // Aplicar formato de moneda MX a columnas monetarias
                  if (colNumber === 4 || colNumber === 5 || colNumber === 6) { // INGRESO, $ LUDI, CAJA
                    cell.numFmt = '"$"#,##0.00'
                  }
                  // Aplicar formato de porcentaje a columnas de porcentaje
                  if (colNumber === 7 || colNumber === 8) { // % LUDI, % CAJA
                    cell.numFmt = '0%'
                  }
          }
        })
        
        console.log(`✅ Aplicado color ${servicio.color} a fila ${servicioRow.number} para servicio ${servicio.codigo}`)
      })

      // AGREGAR MES Y DÍA EN LAS FILAS CORRECTAS DESPUÉS DE LOS SERVICIOS
      // Siempre usar la fecha actual del día que estamos generando
      console.log(`🔍 Día ${diaDelMes}: fechaActual = ${fechaActual.toISOString()}, fechaStr = ${fechaStr}`)
      
      // Usar los meses directamente para evitar problemas de zona horaria
      const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
      const mesNombre = meses[fechaActual.getMonth()]
      console.log(`📅 Mes generado: ${mesNombre} (índice ${fechaActual.getMonth()})`)
      
      // Mes en fila 4 (tercer servicio) - EN BLANCO
      const mesRow = worksheet.getRow(4)
      mesRow.getCell(1).value = mesNombre // "AGO" en BLANCO
      mesRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
      mesRow.getCell(1).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 18 }
      mesRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      // Día en fila 7 (sexto servicio) - BAJADO 2 FILAS
      const diaRow = worksheet.getRow(7)
      diaRow.getCell(1).value = diaDelMes
      diaRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
      diaRow.getCell(1).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 18 }
      diaRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      // FILA FINAL: Totales DESPUÉS de todas las partidas (dinámico)
      const totalIngreso = diaData?.totalVendido || 0
      const totalLudi = diaData?.totalLudi || 0
      const totalCaja = diaData?.totalCaja || 0

      // Fila de totales al final, después de todos los servicios (2 + servicios.length)
      const totalesRowIndex = 2 + servicios.length
      const totalesRow = worksheet.getRow(totalesRowIndex)
      totalesRow.values = [
        'Aquí NO se ingresan estancias mensuales pagadas hoy',
        '',
        '',
        totalIngreso,
        totalLudi,
        totalCaja,
        '', // % LUDI vacío para totales
        ''  // % CAJA vacío para totales
      ]

      // Formato para toda la fila de totales
      totalesRow.eachCell((cell, colNumber) => {
        if (colNumber >= 4 && colNumber <= 6) { // Solo las columnas de INGRESO, $ LUDI, CAJA
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          // Aplicar formato de moneda MX a los totales
          cell.numFmt = '"$"#,##0.00'
        } else if (colNumber === 1) {
          // Para la primera celda con el texto largo
          cell.font = { color: { argb: 'FF000000' } } // Texto negro
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
        }
      })





      // BLOQUE POR ADELANTADO (después de los totales)
      const filaInicioAdelantado = totalesRowIndex + 2 // 2 filas de separación
      
      // Crear todas las filas del bloque POR ADELANTADO primero
      servicios.forEach((servicio, index) => {
        const filaAdelantado = filaInicioAdelantado + index
        const adelantadoRow = worksheet.getRow(filaAdelantado)
        
        adelantadoRow.values = [
          '', // DÍAS POR MES - vacío (fondo negro)
          '', // PAGADOS - vacío (sin cantidades)
          servicio.codigo, // SERVICIO - tipo de servicio
          0, // INGRESO - $0 (sin cantidades)
          0, // $ LUDI - $0 (sin cantidades)
          0, // CAJA - $0 (sin cantidades)
          servicio.precio > 0 ? Math.round((servicio.ludi / servicio.precio) * 100) : 0, // % LUDI
          servicio.precio > 0 ? Math.round((servicio.caja / servicio.precio) * 100) : 0  // % CAJA
        ]

        // Aplicar formato a las filas POR ADELANTADO
        adelantadoRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) {
            // Columna A con fondo negro para todas las filas de servicios
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else {
            // Resto de columnas con color del servicio
            cell.fill = { 
              type: 'pattern', 
              pattern: 'solid', 
              fgColor: { argb: servicio.color }
            }
            cell.font = { color: { argb: 'FF000000' }, bold: false }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            
            // Aplicar formato de moneda MX a columnas monetarias
            if (colNumber >= 4 && colNumber <= 6) { // INGRESO, $ LUDI, CAJA
              cell.numFmt = '"$"#,##0.00'
            }
            // Aplicar formato de porcentaje a columnas de porcentaje
            if (colNumber === 7 || colNumber === 8) { // % LUDI, % CAJA
              cell.numFmt = '0%'
            }
          }
        })
      })

      // Colocar "POR" en una celda y "ADELANTADO" 2 filas abajo (bajado 2 filas más)
      const filaPor = filaInicioAdelantado + 2
      const filaAdelantado = filaInicioAdelantado + 4
      
      // Celda con "POR"
      const celdaPor = worksheet.getCell(filaPor, 1)
      celdaPor.value = 'POR'
      celdaPor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
      celdaPor.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 18 }
      celdaPor.alignment = { horizontal: 'center', vertical: 'middle' }
      
      // Celda con "ADELANTADO" 2 filas abajo
      const celdaAdelantado = worksheet.getCell(filaAdelantado, 1)
      celdaAdelantado.value = 'ADELANTADO'
      celdaAdelantado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
      celdaAdelantado.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 18 }
      celdaAdelantado.alignment = { horizontal: 'center', vertical: 'middle' }
      
             // Aplicar fondo negro a las celdas intermedias si las hay
             if (filaAdelantado > filaPor + 1) {
               const celdaIntermedia = worksheet.getCell(filaPor + 1, 1)
               celdaIntermedia.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
               celdaIntermedia.font = { color: { argb: 'FFFFFFFF' }, bold: true }
               celdaIntermedia.alignment = { horizontal: 'center', vertical: 'middle' }
             }
             
             // Aplicar color café claro a las filas 21, 22 y 23 de la columna A
             for (let fila = 21; fila <= 23; fila++) {
               const celda = worksheet.getCell(fila, 1)
               celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD2B48C' } } // Color café claro (tan)
               celda.font = { color: { argb: 'FF000000' }, bold: true } // Texto negro
               celda.alignment = { horizontal: 'center', vertical: 'middle' }
             }
             
             // Agregar texto "ALUMNOS" a la celda A21
             const celdaA21 = worksheet.getCell(21, 1)
             celdaA21.value = 'ALUMNOS'

             // CALENDARIO DEL LADO DERECHO (columnas J-O)
             // Obtener el mes y año de la fecha actual
             const año = fechaActual.getFullYear()
             const mes = fechaActual.getMonth()
             const nombreMes = meses[mes]
             
             // Calcular el primer día del mes y cuántos días tiene
             const primerDia = new Date(año, mes, 1)
             const ultimoDia = new Date(año, mes + 1, 0)
             const diasEnMes = ultimoDia.getDate()
             const diaSemanaInicio = primerDia.getDay() // 0 = domingo, 1 = lunes, etc.
             
             // TABLA DE TOTALES CON DISEÑO UI/UX (J6-P8)
             // Calcular totales del día actual
             const totalVendidoTabla = diaData?.totalVendido || 0
             const totalCajaTabla = diaData?.totalCaja || 0
             const totalLudiTabla = diaData?.totalLudi || 0
             
             // Crear tabla cuadriculada con diseño moderno y elegante (J6-M8)
             // Fondo degradado elegante para toda la tabla
             for (let row = 6; row <= 8; row++) {
               for (let col = 10; col <= 13; col++) {
                 const celda = worksheet.getCell(row, col)
                 // Fondo gris muy claro elegante
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
               }
             }
             
             // Aplicar fondo a las celdas de valores monetarios (columna L)
             for (let row = 6; row <= 8; row++) {
               const celdaValor = worksheet.getCell(row, 12)
               celdaValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
             }
             
             // Bordes modernos y elegantes para celdas fusionadas
             
             // Aplicar bordes a las celdas fusionadas (J-K), valores (L) y fecha (M)
             for (let row = 6; row <= 8; row++) {
               // Celdas J-K fusionadas
               const celdaFusionada = worksheet.getCell(row, 10)
               celdaFusionada.border = {
                 top: { style: row === 6 ? 'medium' : 'thin', color: { argb: row === 6 ? 'FF475569' : 'FFE2E8F0' } },
                 left: { style: 'medium', color: { argb: 'FF475569' } },
                 bottom: { style: row === 8 ? 'medium' : 'thin', color: { argb: row === 8 ? 'FF475569' : 'FFE2E8F0' } },
                 right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
               }
               
               // Celda L (valores monetarios)
               const celdaValor = worksheet.getCell(row, 12)
               celdaValor.border = {
                 top: { style: row === 6 ? 'medium' : 'thin', color: { argb: row === 6 ? 'FF475569' : 'FFE2E8F0' } },
                 left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                 bottom: { style: row === 8 ? 'medium' : 'thin', color: { argb: row === 8 ? 'FF475569' : 'FFE2E8F0' } },
                 right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
               }
               
               // Celda M (fecha)
               const celdaFecha = worksheet.getCell(row, 13)
               celdaFecha.border = {
                 top: { style: row === 6 ? 'medium' : 'thin', color: { argb: row === 6 ? 'FF475569' : 'FFE2E8F0' } },
                 left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                 bottom: { style: row === 8 ? 'medium' : 'thin', color: { argb: row === 8 ? 'FF475569' : 'FFE2E8F0' } },
                 right: { style: 'medium', color: { argb: 'FF475569' } }
               }
             }
             
             // Fusionar celdas para que el texto completo sea visible
             
             // NUEVA TABLA DE RESUMEN ARRIBA DEL TOTAL VENDIDO (J2-L4)
             // Crear tabla con diseño similar a la principal
             for (let row = 2; row <= 4; row++) {
               for (let col = 10; col <= 12; col++) { // Columnas J, K, L
                 const celda = worksheet.getCell(row, col)
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } // Fondo blanco
                 celda.border = {
                   top: { style: 'thin', color: { argb: 'FF000000' } },
                   left: { style: 'thin', color: { argb: 'FF000000' } },
                   bottom: { style: 'thin', color: { argb: 'FF000000' } },
                   right: { style: 'thin', color: { argb: 'FF000000' } }
                 }
               }
             }
             
             // Fila 1: MENOS ADELANTOS Y DEVOLUCIONES - Fusionar J2-K2 para el texto
             worksheet.mergeCells('J2:K2')
             const menosAdelantosLabel = worksheet.getCell('J2')
             menosAdelantosLabel.value = 'MENOS ADELANTOS Y DEVOLUCIONES'
             menosAdelantosLabel.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente moderna
             }
             menosAdelantosLabel.alignment = { horizontal: 'left', vertical: 'middle' }
             
             // Valor de MENOS ADELANTOS Y DEVOLUCIONES en L2
             const menosAdelantosValue = worksheet.getCell('L2')
             menosAdelantosValue.value = 4204 // Valor de ejemplo
             menosAdelantosValue.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FFDC2626' }, // Rojo para valores negativos
               name: 'Segoe UI' // Fuente moderna
             }
             menosAdelantosValue.alignment = { horizontal: 'right', vertical: 'middle' }
             menosAdelantosValue.numFmt = '"$"#,##0'
             
             // Fila 2: TOTAL CAJA - Fusionar J3-K3 para el texto
             worksheet.mergeCells('J3:K3')
             const totalCajaLabel2 = worksheet.getCell('J3')
             totalCajaLabel2.value = 'TOTAL CAJA'
             totalCajaLabel2.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente moderna
             }
             totalCajaLabel2.alignment = { horizontal: 'left', vertical: 'middle' }
             
             // Valor de TOTAL CAJA en L3
             const totalCajaValue2 = worksheet.getCell('L3')
             totalCajaValue2.value = 1949 // Valor de ejemplo
             totalCajaValue2.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF059669' }, // Verde elegante para valores
               name: 'Segoe UI' // Fuente moderna
             }
             totalCajaValue2.alignment = { horizontal: 'right', vertical: 'middle' }
             totalCajaValue2.numFmt = '"$"#,##0'
             
             // Fila 3: TOTAL LUDI - Fusionar J4-K4 para el texto
             worksheet.mergeCells('J4:K4')
             const totalLudiLabel2 = worksheet.getCell('J4')
             totalLudiLabel2.value = 'TOTAL LUDI'
             totalLudiLabel2.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente moderna
             }
             totalLudiLabel2.alignment = { horizontal: 'left', vertical: 'middle' }
             
             // Valor de TOTAL LUDI en L4
             const totalLudiValue2 = worksheet.getCell('L4')
             totalLudiValue2.value = 2255 // Valor de ejemplo
             totalLudiValue2.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF059669' }, // Verde elegante para valores
               name: 'Segoe UI' // Fuente moderna
             }
             totalLudiValue2.alignment = { horizontal: 'right', vertical: 'middle' }
             totalLudiValue2.numFmt = '"$"#,##0'
             
             // TABLAS ADICIONALES DEL LADO DERECHO (N2-O5)
             // Tabla 1: DEVS. WINSTON (N2-O3)
             // Crear tabla con diseño elegante
             for (let row = 2; row <= 3; row++) {
               for (let col = 14; col <= 15; col++) { // Columnas N, O
                 const celda = worksheet.getCell(row, col)
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } // Fondo blanco
                 celda.border = {
                   top: { style: 'thin', color: { argb: 'FF000000' } },
                   left: { style: 'thin', color: { argb: 'FF000000' } },
                   bottom: { style: 'thin', color: { argb: 'FF000000' } },
                   right: { style: 'thin', color: { argb: 'FF000000' } }
                 }
               }
             }
             
             // Header DEVS. WINSTON - Fusionar N2-O2 con diseño especial
             worksheet.mergeCells('N2:O2')
             const devsWinstonLabel = worksheet.getCell('N2')
             devsWinstonLabel.value = 'DEVS. WINSTON'
             devsWinstonLabel.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF1E40AF' }, // Azul elegante
               name: 'Segoe UI' // Fuente moderna
             }
             devsWinstonLabel.alignment = { horizontal: 'center', vertical: 'middle' }
             devsWinstonLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } // Fondo gris claro
             
             // Fila vacía para DEVS. WINSTON (N3-O3 fusionada)
             worksheet.mergeCells('N3:O3')
             const devsWinstonEmpty = worksheet.getCell('N3')
             devsWinstonEmpty.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } // Fondo blanco
             
             // Tabla 2: DEVS. LUDI (N4-O5)
             // Crear tabla con diseño elegante
             for (let row = 4; row <= 5; row++) {
               for (let col = 14; col <= 15; col++) { // Columnas N, O
                 const celda = worksheet.getCell(row, col)
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } // Fondo blanco
                 celda.border = {
                   top: { style: 'thin', color: { argb: 'FF000000' } },
                   left: { style: 'thin', color: { argb: 'FF000000' } },
                   bottom: { style: 'thin', color: { argb: 'FF000000' } },
                   right: { style: 'thin', color: { argb: 'FF000000' } }
                 }
               }
             }
             
             // Header DEVS. LUDI - Fusionar N4-O4 con diseño especial
             worksheet.mergeCells('N4:O4')
             const devsLudiLabel = worksheet.getCell('N4')
             devsLudiLabel.value = 'DEVS. LUDI'
             devsLudiLabel.font = { 
               bold: true, 
               size: 10, 
               color: { argb: 'FF7C3AED' }, // Morado elegante
               name: 'Segoe UI' // Fuente moderna
             }
             devsLudiLabel.alignment = { horizontal: 'center', vertical: 'middle' }
             devsLudiLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } // Fondo gris claro
             
             // Fila vacía para DEVS. LUDI (N5-O5 fusionada)
             worksheet.mergeCells('N5:O5')
             const devsLudiEmpty = worksheet.getCell('N5')
             devsLudiEmpty.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } // Fondo blanco
             
             // Fila 1: TOTAL VENDIDO - Fusionar J6-K6 para el texto
             worksheet.mergeCells('J6', 'K6')
             const totalVendidoLabel = worksheet.getCell('J6')
             totalVendidoLabel.value = 'TOTAL VENDIDO'
             totalVendidoLabel.font = { 
               bold: true, 
               size: 12, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente moderna
             }
             totalVendidoLabel.alignment = { horizontal: 'left', vertical: 'middle' }
             
             // Agregar el valor de TOTAL VENDIDO en la columna L
             const totalVendidoValue = worksheet.getCell('L6')
             totalVendidoValue.value = totalVendidoTabla
             totalVendidoValue.font = { 
               bold: true, 
               size: 13, 
               color: { argb: 'FF059669' }, // Verde elegante para valores
               name: 'Segoe UI' // Fuente moderna
             }
             totalVendidoValue.alignment = { horizontal: 'right', vertical: 'middle' }
             totalVendidoValue.numFmt = '"$"#,##0'
             
             const mesLabel = worksheet.getCell('M6')
             mesLabel.value = mesNombre
             mesLabel.font = { 
               bold: true, 
               size: 13, 
               color: { argb: 'FF7C3AED' }, // Morado elegante para fecha
               name: 'Segoe UI' // Fuente moderna
             }
             mesLabel.alignment = { horizontal: 'center', vertical: 'middle' }
             
             // Fila 2: TOTAL CAJA - Fusionar J7-K7 para el texto
             worksheet.mergeCells('J7', 'K7')
             const totalCajaLabel = worksheet.getCell('J7')
             totalCajaLabel.value = 'TOTAL CAJA'
             totalCajaLabel.font = { 
               bold: true, 
               size: 12, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente moderna
             }
             totalCajaLabel.alignment = { horizontal: 'left', vertical: 'middle' }
             
             // Agregar el valor de TOTAL CAJA en la columna L
             const totalCajaValue = worksheet.getCell('L7')
             totalCajaValue.value = totalCajaTabla
             totalCajaValue.font = { 
               bold: true, 
               size: 13, 
               color: { argb: 'FF059669' }, // Verde elegante para valores
               name: 'Segoe UI' // Fuente moderna
             }
             totalCajaValue.alignment = { horizontal: 'right', vertical: 'middle' }
             totalCajaValue.numFmt = '"$"#,##0'
             
             const diaLabel = worksheet.getCell('M7')
             diaLabel.value = diaDelMes
             diaLabel.font = { 
               bold: true, 
               size: 13, 
               color: { argb: 'FF7C3AED' }, // Morado elegante para fecha
               name: 'Segoe UI' // Fuente moderna
             }
             diaLabel.alignment = { horizontal: 'center', vertical: 'middle' }
             
             // Fila 3: TOTAL LUDI - Fusionar J8-K8 para el texto
             worksheet.mergeCells('J8', 'K8')
             const totalLudiLabel = worksheet.getCell('J8')
             totalLudiLabel.value = 'TOTAL LUDI'
             totalLudiLabel.font = { 
               bold: true, 
               size: 12, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente moderna
             }
             totalLudiLabel.alignment = { horizontal: 'left', vertical: 'middle' }
             
             // Agregar el valor de TOTAL LUDI en la columna L
             const totalLudiValue = worksheet.getCell('L8')
             totalLudiValue.value = totalLudiTabla
             totalLudiValue.font = { 
               bold: true, 
               size: 13, 
               color: { argb: 'FF059669' }, // Verde elegante para valores
               name: 'Segoe UI' // Fuente moderna
             }
             totalLudiValue.alignment = { horizontal: 'right', vertical: 'middle' }
             totalLudiValue.numFmt = '"$"#,##0'

             // TABLA ADICIONAL DEL LADO DERECHO (N6-O7) - OTRO INGRESO con 2 filas
             // Crear tabla con diseño similar a la principal, para "OTRO INGRESO"
             for (let row = 6; row <= 7; row++) { // Filas 6 y 7
               for (let col = 14; col <= 15; col++) { // Columnas N y O
                 const celda = worksheet.getCell(row, col)
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } // Fondo blanco
                 celda.border = {
                   top: { style: 'thin', color: { argb: 'FF000000' } },
                   left: { style: 'thin', color: { argb: 'FF000000' } },
                   bottom: { style: 'thin', color: { argb: 'FF000000' } },
                   right: { style: 'thin', color: { argb: 'FF000000' } }
                 }
               }
             }
             
             // Contenido de la tabla adicional: OTRO INGRESO
             // Fusionar celdas N6:O6 para el label
             worksheet.mergeCells('N6:O6')
             const otroIngresoLabel = worksheet.getCell('N6')
             otroIngresoLabel.value = 'OTRO INGRESO'
             otroIngresoLabel.font = { bold: true, size: 12, color: { argb: 'FF000000' } }
             otroIngresoLabel.alignment = { horizontal: 'center', vertical: 'middle' }
             
             // Valor monetario en N7:O7 fusionado
             worksheet.mergeCells('N7:O7')
             const otroIngresoValue = worksheet.getCell('N7')
             otroIngresoValue.value = 500 // Valor de ejemplo
             otroIngresoValue.font = { bold: true, size: 12, color: { argb: 'FF000000' } }
             otroIngresoValue.alignment = { horizontal: 'center', vertical: 'middle' }
             otroIngresoValue.numFmt = '"$"#,##0.00'
             // Fondo amarillo para esta celda
             otroIngresoValue.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }

             // MARCO "DÍAS EST MENSUAL" - diseño bonito y cool centrado
             // Calcular TODOS los días laborales del mes
             const diasLaboralesTotales = calcularDiasLaboralesDelMes(año, mes)
             
             // Marco bonito y cool (J10-P12) - centrado arriba del calendario
             
             // Fondo principal del marco - gris elegante
             for (let row = 10; row <= 12; row++) {
               for (let col = 10; col <= 16; col++) {
                 const celda = worksheet.getCell(row, col)
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } // Gris muy claro elegante
               }
             }
             
             // Borde exterior elegante - gris oscuro
             // Borde superior
             for (let col = 10; col <= 16; col++) {
               const celda = worksheet.getCell(10, col)
               celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } } // Gris oscuro elegante
             }
             
             // Borde inferior
             for (let col = 10; col <= 16; col++) {
               const celda = worksheet.getCell(12, col)
               celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } } // Gris oscuro elegante
             }
             
             // Bordes laterales
             for (let row = 10; row <= 12; row++) {
               const celdaIzq = worksheet.getCell(row, 10)
               const celdaDer = worksheet.getCell(row, 16)
               celdaIzq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } }
               celdaDer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } }
             }
             
             // Restaurar fondo elegante para las celdas internas
             for (let row = 11; row <= 11; row++) {
               for (let col = 11; col <= 15; col++) {
                 const celda = worksheet.getCell(row, col)
                 celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
               }
             }
             
             // Contenido del marco - diseño cool y centrado (3 columnas a la derecha)
             const contenidoDiasEst = worksheet.getCell('M11')
             contenidoDiasEst.value = `DÍAS EST MENSUAL: ${diasLaboralesTotales} días`
             contenidoDiasEst.font = { 
               bold: true, 
               size: 13, 
               color: { argb: 'FF1E293B' }, // Gris muy oscuro elegante
               name: 'Segoe UI' // Fuente más elegante
             }
             contenidoDiasEst.alignment = { 
               horizontal: 'center', 
               vertical: 'middle' 
             }
             contenidoDiasEst.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
             
             // Efecto de sombra sutil y elegante
             for (let col = 10; col <= 16; col++) {
               const celda = worksheet.getCell(13, col)
               celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } // Sombra muy sutil
             }

             // Título del calendario - a la altura del bloque POR ADELANTADO
             worksheet.mergeCells('J14', 'P14') // Fusionar celdas J14 a P14 (misma fila que POR ADELANTADO)
             const tituloCalendario = worksheet.getCell('J14')
             tituloCalendario.value = `${nombreMes} ${año}`
             tituloCalendario.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
             tituloCalendario.alignment = { horizontal: 'center', vertical: 'middle' }
             tituloCalendario.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90E2' } } // Azul
             
             // Headers de días de la semana
             const diasSemana = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB']
             diasSemana.forEach((dia, index) => {
               const celda = worksheet.getCell(15, 10 + index) // Fila 15, columna J + index
               celda.value = dia
               celda.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
               celda.alignment = { horizontal: 'center', vertical: 'middle' }
               celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } } // Azul oscuro
             })
             
             // Generar días del calendario
             let diaActual = 1
             let filaActual = 16
             
             // Días de asueto en México (2025)
             const diasAsueto = [
               '2025-01-01', '2025-02-03', '2025-03-17', '2025-05-01', '2025-05-05',
               '2025-09-16', '2025-11-03', '2025-11-17', '2025-12-25'
             ]
             
             // Crear 6 filas para el calendario (máximo de semanas en un mes)
             for (let semana = 0; semana < 6; semana++) {
               for (let dia = 0; dia < 7; dia++) {
                 const columna = 10 + dia // J = 10, K = 11, L = 12, M = 13, N = 14, O = 15, P = 16
                 const celda = worksheet.getCell(filaActual, columna)
                 
                 if (semana === 0 && dia < diaSemanaInicio) {
                   // Celdas vacías antes del primer día del mes
                   celda.value = ''
                   celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } } // Gris muy claro
                 } else if (diaActual <= diasEnMes) {
                   // Días del mes
                   celda.value = diaActual
                   celda.font = { bold: true, size: 11 }
                   celda.alignment = { horizontal: 'center', vertical: 'middle' }
                   
                   // Verificar si es fin de semana (sábado o domingo)
                   const esSabado = dia === 6
                   const esDomingo = dia === 0
                   
                   // Verificar si es día de asueto
                   const fechaDia = `${año}-${String(mes + 1).padStart(2, '0')}-${String(diaActual).padStart(2, '0')}`
                   const esAsueto = diasAsueto.includes(fechaDia)
                   
                   if (esAsueto) {
                     // Día de asueto - fondo rojo
                     celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } }
                     celda.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
                   } else if (esSabado) {
                     // Sábado - fondo azul claro
                     celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF85C1E9' } }
                     celda.font = { bold: true, size: 11, color: { argb: 'FF000000' } }
                   } else if (esDomingo) {
                     // Domingo - fondo azul medio
                     celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3498DB' } }
                     celda.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
                   } else {
                     // Día laboral - fondo blanco
                     celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
                     celda.font = { bold: true, size: 11, color: { argb: 'FF000000' } }
                   }
                   
                   diaActual++
                 } else {
                   // Celdas vacías después del último día del mes
                   celda.value = ''
                   celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } } // Gris muy claro
                 }
               }
               filaActual++
             }
             
             // Leyenda del calendario
             const leyendaRow = filaActual + 1
             const leyendaTitulo = worksheet.getCell(`J${leyendaRow}`)
             leyendaTitulo.value = 'LEYENDA:'
             leyendaTitulo.font = { bold: true, size: 10, color: { argb: 'FF000000' } }
             
             const leyenda1 = worksheet.getCell(`J${leyendaRow + 1}`)
             leyenda1.value = '🔴 Días de asueto'
             leyenda1.font = { size: 9, color: { argb: 'FF000000' } }
             
             const leyenda2 = worksheet.getCell(`J${leyendaRow + 2}`)
             leyenda2.value = '🔵 Sábados y domingos'
             leyenda2.font = { size: 9, color: { argb: 'FF000000' } }
      
      // Eliminar filas vacías después de la fila de totales
      const ultimaFilaConDatos = totalesRowIndex
      const totalFilas = worksheet.rowCount
      if (totalFilas > ultimaFilaConDatos) {
        worksheet.spliceRows(ultimaFilaConDatos + 1, totalFilas - ultimaFilaConDatos)
      }
    }

    // Hoja TOTAL MES
    const totalesWs = workbook.addWorksheet('TOTAL MES')
    totalesWs.addRow(['TOTAL MES'])
    totalesWs.addRow(['Total vendido', totales.totalVendido])
    totalesWs.addRow(['Total caja', totales.totalCaja])
    totalesWs.addRow(['Total Ludi', totales.totalLudi])
    totalesWs.addRow(['Total alumnos', totales.totalAlumnos])

    const nombre = `REPORTE_CONTABLE_${fechaInicio}_${fechaFin}.xlsx`
    const buffer = await workbook.xlsx.writeBuffer()

    // Descargar el archivo
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    window.URL.revokeObjectURL(url)
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
                <p>📄 Haz clic en &quot;Exportar Excel&quot; para descargar el reporte completo</p>
              </div>
            ) : (
              <div>
                <p>📅 Selecciona el rango de fechas</p>
                <p>🔍 Haz clic en &quot;Generar reporte&quot; para procesar los datos</p>
                <p>📊 El reporte se exportará como Excel con la estructura original</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}