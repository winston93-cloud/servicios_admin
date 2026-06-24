import FacturacionTimbrarView from '../components/FacturacionTimbrarView'

export default function FacturacionPublicoGeneralPage() {
  return (
    <FacturacionTimbrarView
      modo="publico_mes"
      title="Público en general"
      subtitle="Timbrado masivo del mes con RFC genérico XAXX010101000 (todas las formas de pago)."
    />
  )
}
