'use client'

import Link from 'next/link'
import { Gauge } from 'lucide-react'
import { useEstadoPanelGlobal } from '@/lib/panelControl/estadoGlobal'

const LEYENDA = {
  normal: 'todo bien',
  precaucion: 'hay advertencias',
  alarma: 'hay fallas',
} as const

export default function SalaControlBoton() {
  const estado = useEstadoPanelGlobal()
  const etiqueta = `Sala de Control Principal${estado ? `: ${LEYENDA[estado]}` : ''}`

  return (
    <Link
      href="/panel-control"
      className="dashboard-sala-btn"
      data-estado={estado ?? 'sin-lectura'}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Gauge size={18} strokeWidth={2} aria-hidden />
      <span className="dashboard-sala-btn-txt">Sala de Control Principal</span>
    </Link>
  )
}
