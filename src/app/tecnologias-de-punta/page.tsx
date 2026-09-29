import type { Metadata } from 'next'
import TecnologiasDePuntaView from './TecnologiasDePuntaView'

export const metadata: Metadata = {
  title: 'Enlaces de X · Tecnologías de punta',
  description: 'Publicaciones de X sobre IA, agentes, Cursor y desarrollo compartidas por Dirección General al equipo de Sistemas del Instituto Winston Churchill.',
  openGraph: {
    title: 'Enlaces de X · Tecnologías de punta',
    description: 'Lo más relevante de IA y desarrollo, curado por Dirección General.',
  },
}

export default function TecnologiasDePuntaPage() {
  return <TecnologiasDePuntaView />
}
