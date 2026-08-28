'use client'

import { GitCompareArrows } from 'lucide-react'
import FacturacionSatShell from './FacturacionSatShell'

export default function FacturacionConciliacionView() {
  return (
    <FacturacionSatShell
      title="Conciliación"
      subtitle="Sección en preparación — el flujo operativo se definirá con contabilidad"
    >
      <div className="facturacion-cfdi-placeholder facturacion-cfdi-sat-conciliacion">
        <div className="facturacion-cfdi-sat-conciliacion-icon" aria-hidden>
          <GitCompareArrows size={36} />
        </div>
        <p className="facturacion-cfdi-placeholder-fase">Próximamente</p>
        <p className="facturacion-cfdi-placeholder-text">
          Aquí irá la <strong>conciliación</strong> de comprobantes y movimientos fiscales. La
          descarga masiva de CFDI recibidos ya está disponible en la pestaña{' '}
          <strong>Descarga masiva</strong>.
        </p>
      </div>
    </FacturacionSatShell>
  )
}
