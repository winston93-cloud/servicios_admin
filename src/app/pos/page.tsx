'use client'

import { useState } from 'react'
import PosClaveGate from './PosClaveGate'
import PosApp from './_components/PosApp'

export default function PosPage() {
  const [gateKey, setGateKey] = useState(0)
  return (
    <PosClaveGate key={gateKey}>
      <PosApp onSesionCerrada={() => setGateKey((k) => k + 1)} />
    </PosClaveGate>
  )
}
