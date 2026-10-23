'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import {
  DASH_TEMAS_PADRES,
  DashTemaSwitch,
  useDashTema,
  type DashTema,
} from '@/components/dashboard/DashboardTemas'

const NOTA_PADRES =
  'Estas pantallas se ven en Original o Institucional; los demás estilos se eligen en tu inicio. Se guarda en este dispositivo.'

/** Estas pantallas solo tienen Original e Institucional: cualquier otro estilo del inicio se ve como Institucional. */
export function temaVistaPadres(tema: DashTema): DashTema {
  return tema === 'original' ? 'original' : 'institucional'
}

export function dataTemaPadres(tema: DashTema): DashTema | undefined {
  return tema === 'original' ? undefined : 'institucional'
}

export function PortalPadresTopbar({ volver }: { volver: string }) {
  const router = useRouter()
  const [tema, setTema] = useDashTema()
  return (
    <div className="portal-autorizados-topbar">
      <button type="button" className="servicios-back-btn" onClick={() => router.push(volver)}>
        <ArrowLeft size={16} aria-hidden />
        Volver al inicio
      </button>
      <div className="portal-padres-topbar-acciones">
        <DashTemaSwitch
          tema={temaVistaPadres(tema)}
          onCambiar={setTema}
          temas={DASH_TEMAS_PADRES}
          nota={NOTA_PADRES}
        />
        <ThemeToggle />
      </div>
    </div>
  )
}
