'use client'

import RacNivelApp from '../components/RacNivelApp'
import { RAC_MATERNAL_KINDER } from '@/lib/rac/racNivelConfig'
import '../rac-nivel-base.css'
import './rac-maternal-kinder.css'

export default function RacMaternalKinderPage() {
  return <RacNivelApp config={RAC_MATERNAL_KINDER} themeClass="racn-page--maternal-kinder" />
}
