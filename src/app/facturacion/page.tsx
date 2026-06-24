'use client'

import FacturacionShell from './components/FacturacionShell'

export default function FacturacionPage() {
  return (
    <FacturacionShell
      subtitle="Selecciona una operación. Timbrado individual y por mes ya están en Fase 3."
    >
      <p className="facturacion-cfdi-footnote" role="status">
        Fases 3–4 operativas en este módulo. <code>cfdiwinston</code> sigue en producción hasta
        nuevo aviso; el sync final de <code>datos_facturacion</code> desde MySQL será al go-live.
      </p>
    </FacturacionShell>
  )
}
