'use client'

import FacturacionShell from './components/FacturacionShell'

export default function FacturacionPage() {
  return (
    <FacturacionShell
      subtitle="Selecciona una operación. El timbrado real se habilitará en las fases 3 y 4."
    >
      <p className="facturacion-cfdi-footnote" role="status">
        Fase 1: menú integrado en Servicios Administrativos. Datos fiscales de papás y tablas de
        auditoría se conectarán en la Fase 2 (InsForge Winston Servicios).
      </p>
    </FacturacionShell>
  )
}
