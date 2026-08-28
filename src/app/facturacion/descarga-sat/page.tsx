import { redirect } from 'next/navigation'

/** Ruta legacy → módulo SAT. */
export default function FacturacionDescargaSatRedirectPage() {
  redirect('/facturacion/sat/descarga-masiva')
}
