'use client'

import { useSyncExternalStore } from 'react'

/** Estado general del panel según la última revisión de `PanelControlAlerta` (null = aún sin lectura). */
export type EstadoPanelGlobal = 'normal' | 'precaucion' | 'alarma' | null

let actual: EstadoPanelGlobal = null
const oyentes = new Set<() => void>()

export function publicarEstadoPanel(estado: EstadoPanelGlobal) {
  if (estado === actual) return
  actual = estado
  oyentes.forEach((o) => o())
}

function suscribir(o: () => void) {
  oyentes.add(o)
  return () => {
    oyentes.delete(o)
  }
}

export function useEstadoPanelGlobal(): EstadoPanelGlobal {
  return useSyncExternalStore(
    suscribir,
    () => actual,
    () => null,
  )
}
