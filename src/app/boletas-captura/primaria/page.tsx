'use client'

import PortalCapturaNivel, { type ModuloPortal } from '../PortalCapturaNivel'

const MODULOS: ModuloPortal[] = [
  { id: 'primaria-es', titulo: 'Español', sigla: 'ES', desc: 'Maestras · 1° a 6°', docente: 'Maestra' },
  { id: 'primaria-en', titulo: 'Inglés', sigla: 'EN', desc: 'Teachers · 1° a 6°', docente: 'Teacher' },
]

export default function BoletasCapturaPrimariaPage() {
  return <PortalCapturaNivel slug="primaria" titulo="Primaria" modulos={MODULOS} />
}
