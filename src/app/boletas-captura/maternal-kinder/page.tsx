'use client'

import type { GrupoCaptura } from '@/lib/boletasCapturaGrupos'
import PortalCapturaNivel, { type ModuloPortal } from '../PortalCapturaNivel'

const MODULOS: ModuloPortal[] = [
  { id: 'kinder-es', titulo: 'Español', sigla: 'ES', desc: 'Maestras · K1 a K3', docente: 'Maestra' },
  { id: 'kinder-en', titulo: 'Inglés', sigla: 'EN', desc: 'Teachers · Maternal y Kinder', docente: 'Teacher' },
]

/** Maternal no lleva boleta de español. */
const capturable = (g: GrupoCaptura) => !(g.modulo === 'kinder-es' && g.grado === 0)

const AVISO_MATERNAL = {
  titulo: 'Maternal no lleva boleta de español',
  texto: (grupos: string) =>
    `Tus grupos (${grupos}) no tienen boleta de español en este portal. Si crees que es un error, avísale a tu directora.`,
}

export default function BoletasCapturaMaternalKinderPage() {
  return (
    <PortalCapturaNivel
      slug="maternal-kinder"
      titulo="Maternal / Kinder"
      modulos={MODULOS}
      capturable={capturable}
      avisoSinBoleta={AVISO_MATERNAL}
    />
  )
}
