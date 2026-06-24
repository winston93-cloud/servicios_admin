import FacturacionTimbrarView from '../components/FacturacionTimbrarView'

export default function FacturacionMesPage() {
  return (
    <FacturacionTimbrarView
      modo="mes"
      title="Facturas por mes"
      subtitle="Timbrado masivo del mes en curso (año actual) por forma de pago."
    />
  )
}
