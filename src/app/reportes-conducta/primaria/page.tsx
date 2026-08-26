'use client'

import RacNivelApp from '../components/RacNivelApp'
import { RAC_PRIMARIA } from '@/lib/rac/racNivelConfig'
import '../rac-nivel-base.css'
import './rac-primaria.css'

export default function RacPrimariaPage() {
  return <RacNivelApp config={RAC_PRIMARIA} themeClass="racn-page--primaria" />
}
