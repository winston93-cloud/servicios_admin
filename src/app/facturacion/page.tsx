'use client'

import FacturacionShell from './components/FacturacionShell'

export default function FacturacionPage() {
  return (
    <FacturacionShell
      subtitle="Selecciona una operación. El timbrado real se habilitará en las fases 3 y 4."
    >
      <p className="facturacion-cfdi-footnote" role="status">
        Fase 2: datos fiscales de papás en InsForge (
        <code>/portal-facturacion</code>). Timbrado y cancelaciones siguen en el portal PHP
        hasta las fases 3–4.
      </p>
    </FacturacionShell>
  )
}
