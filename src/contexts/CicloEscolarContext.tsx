'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ciclosParaSelector,
  listarCiclosEscolares,
  opcionesDesdeCiclos,
  type CicloEscolarRegistro,
} from '@/lib/ciclosEscolaresService'

const CICLO_FALLBACK = 22

interface CicloEscolarContextValue {
  ciclos: CicloEscolarRegistro[]
  /** Ciclo con el que se filtran alumnos (cambiable en el selector superior). */
  cicloSeleccionado: number
  /** Ciclo marcado como actual en BD (`es_actual`); solo se edita en el catálogo. */
  cicloActualSistema: number
  etiquetaCicloActualSistema: string
  opcionesSelector: { valor: number; etiqueta: string }[]
  opcionesCatalogo: { valor: number; etiqueta: string }[]
  cargando: boolean
  error: string | null
  setCicloSeleccionado: (valor: number) => void
  recargarCiclos: () => Promise<void>
}

const CicloEscolarContext = createContext<CicloEscolarContextValue | null>(null)

function valorCicloActualSistema(ciclos: CicloEscolarRegistro[]): number {
  const actual = ciclos.find((c) => c.es_actual)
  return actual?.valor ?? CICLO_FALLBACK
}

export function CicloEscolarProvider({ children }: { children: ReactNode }) {
  const [ciclos, setCiclos] = useState<CicloEscolarRegistro[]>([])
  const [cicloSeleccionado, setCicloSeleccionadoState] = useState(CICLO_FALLBACK)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cicloActualSistema = useMemo(() => valorCicloActualSistema(ciclos), [ciclos])

  const etiquetaCicloActualSistema = useMemo(() => {
    const hit = ciclos.find((c) => c.valor === cicloActualSistema)
    return hit?.nombre ?? '—'
  }, [ciclos, cicloActualSistema])

  const opcionesSelector = useMemo(() => {
    const lista = ciclosParaSelector(ciclos, cicloActualSistema)
    return opcionesDesdeCiclos(lista)
  }, [ciclos, cicloActualSistema])

  const opcionesCatalogo = useMemo(() => {
    const activos = ciclos.filter((c) => c.activo)
    return opcionesDesdeCiclos(activos.length ? activos : ciclos)
  }, [ciclos])

  const recargarCiclos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const lista = await listarCiclosEscolares()
      setCiclos(lista)
      // Siempre arrancar en el ciclo activo del sistema (es_actual en catálogo).
      setCicloSeleccionadoState(valorCicloActualSistema(lista))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los ciclos escolares.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    recargarCiclos()
  }, [recargarCiclos])

  const setCicloSeleccionado = useCallback(
    (valor: number) => {
      const permitidos = ciclosParaSelector(ciclos, cicloActualSistema).map((c) => c.valor)
      if (!permitidos.includes(valor)) return
      setCicloSeleccionadoState(valor)
    },
    [ciclos, cicloActualSistema]
  )

  const value = useMemo(
    () => ({
      ciclos,
      cicloSeleccionado,
      cicloActualSistema,
      etiquetaCicloActualSistema,
      opcionesSelector,
      opcionesCatalogo,
      cargando,
      error,
      setCicloSeleccionado,
      recargarCiclos,
    }),
    [
      ciclos,
      cicloSeleccionado,
      cicloActualSistema,
      etiquetaCicloActualSistema,
      opcionesSelector,
      opcionesCatalogo,
      cargando,
      error,
      setCicloSeleccionado,
      recargarCiclos,
    ]
  )

  return <CicloEscolarContext.Provider value={value}>{children}</CicloEscolarContext.Provider>
}

export function useCicloEscolar(): CicloEscolarContextValue {
  const ctx = useContext(CicloEscolarContext)
  if (!ctx) {
    throw new Error('useCicloEscolar debe usarse dentro de CicloEscolarProvider')
  }
  return ctx
}
