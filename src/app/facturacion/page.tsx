'use client'

import FacturacionShell from './components/FacturacionShell'

export default function FacturacionPage() {
  return (
    <FacturacionShell
      subtitle="Selecciona una operación. Timbrado individual y por mes ya están en Fase 3."
    >
      <p className="facturacion-cfdi-footnote" role="status">
        Fase 2: datos fiscales en InsForge (<code>/portal-facturacion</code>). Fase 3: timbrado
        por mes e individual (requiere credenciales PAC en Vercel). Cancelaciones y público general
        siguen en Fase 4.
      </p>
    </FacturacionShell>
  )
}
