import { redirect } from 'next/navigation'

/**
 * El portal de pagos se unificó dentro del Portal de Inscripciones y Colegiaturas.
 * Esta ruta ahora redirige al portal unificado; las colegiaturas viven como pasos
 * dentro de /portal-inscripciones.
 */
export default function PortalPagosPage() {
  redirect('/portal-inscripciones')
}
