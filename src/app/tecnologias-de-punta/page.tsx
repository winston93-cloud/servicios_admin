import type { Metadata } from 'next'
import { listarEnlaces } from '@/lib/enlacesX/enlacesXService'
import TecnologiasDePuntaView from './TecnologiasDePuntaView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Enlaces de X · Tecnologías de punta',
  description: 'Publicaciones de X sobre IA, agentes, Cursor y desarrollo compartidas por Dirección General al equipo de Sistemas del Instituto Winston Churchill.',
  openGraph: {
    title: 'Enlaces de X · Tecnologías de punta',
    description: 'Lo más relevante de IA y desarrollo, curado por Dirección General.',
  },
}

export default async function TecnologiasDePuntaPage() {
  const enlaces = await listarEnlaces().catch((e) => {
    console.error('tecnologias-de-punta:', e)
    return null
  })
  return <TecnologiasDePuntaView inicial={enlaces ?? []} errorCarga={enlaces === null} />
}
