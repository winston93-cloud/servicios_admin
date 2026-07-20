import { Suspense } from 'react'
import Dif2Page from './Dif2Client'
import './dif2.css'

export const metadata = {
  title: 'Reporte Dif2 · Winston',
  description: 'Inscripciones admin — 2º diferido',
}

export default function Dif2RoutePage() {
  return (
    <Suspense
      fallback={
        <div className="dif2-shell">
          <div className="dif2-loading" role="status">
            Cargando…
          </div>
        </div>
      }
    >
      <Dif2Page />
    </Suspense>
  )
}
