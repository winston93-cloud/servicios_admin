'use client'

import FacturacionSatShell from '../components/FacturacionSatShell'

export default function FacturacionSatHubPage() {
  return (
    <FacturacionSatShell showHub>
      <p className="facturacion-cfdi-footnote" role="status">
        Elija una sección: <strong>Descarga masiva</strong> para exportar CFDI recibidos del SAT, o{' '}
        <strong>Conciliación</strong> cuando el flujo esté definido.
      </p>
    </FacturacionSatShell>
  )
}
