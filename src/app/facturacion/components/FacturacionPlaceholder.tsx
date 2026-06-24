'use client'

import { facturacionItemPorPath } from '@/lib/facturacionNav'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FacturacionShell from './FacturacionShell'

type Props = {
  segment: string
}

export default function FacturacionPlaceholder({ segment }: Props) {
  const router = useRouter()
  const path = `/facturacion/${segment}`
  const item = facturacionItemPorPath(path)

  return (
    <FacturacionShell
      title={item?.label ?? 'Facturación CFDI'}
      subtitle={item?.desc ?? 'Módulo en construcción'}
      showNav={false}
    >
      <div className="facturacion-cfdi-placeholder">
        <p className="facturacion-cfdi-placeholder-fase">
          Próximamente — Fase {item?.fase ?? '—'}
        </p>
        <p className="facturacion-cfdi-placeholder-text">
          Esta pantalla reemplazará la operación equivalente en el portal PHP{' '}
          <code>cfdiwinston</code>. Mientras tanto, usa el enlace del encabezado al portal legacy.
        </p>
        <div className="facturacion-cfdi-placeholder-actions">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/facturacion')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al menú CFDI
          </button>
          <Link href="/facturacion" className="facturacion-cfdi-link-btn">
            Ver todas las operaciones
          </Link>
        </div>
      </div>
    </FacturacionShell>
  )
}
