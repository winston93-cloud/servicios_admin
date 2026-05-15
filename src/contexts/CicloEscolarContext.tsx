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

const STORAGE_KEY = 'servicios-ciclo-escolar-valor'
const CICLO_FALLBACK = 22

interface CicloEscolarContextValue {
  ciclos: CicloEscolarRegistro[]
  cicloSeleccionado: number
  cicloActualSistema: number
  opcionesSelector: { valor: number; etiqueta: string }[]
  opcionesCatalogo: { valor: number; etiqueta: string }[]
  cargando: boolean
  error: string | null
  setCicloSeleccionado: (valor: number) => void
  recargarCiclos: () => Promise<void>
}

const CicloEscolarContext = createContext<CicloEscolarContextValue | null>(null)

function leerCicloGuardado(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isNaN(n) ? null : n
  } catch {
    return null
  }
}

function guardarCicloLocal(valor: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(valor))
  } catch {
    /* ignore */
  }
}

export function CicloEscolarProvider({ children }: { children: ReactNode }) {
  const [ciclos, setCiclos] = useState<CicloEscolarRegistro[]>([])
  const [cicloSeleccionado, setCicloSeleccionadoState] = useState(CICLO_FALLBACK)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cicloActualSistema = useMemo(() => {
    const actual = ciclos.find((c) => c.es_actual)
    return actual?.valor ?? CICLO_FALLBACK
  }, [ciclos])

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

      const actual = lista.find((c) => c.es_actual)
      const valorActual = actual?.valor ?? CICLO_FALLBACK
      const permitidos = ciclosParaSelector(lista, valorActual).map((c) => c.valor)
      const guardado = leerCicloGuardado()

      let elegido = valorActual
      if (guardado != null && permitidos.includes(guardado)) {
        elegido = guardado
      } else if (permitidos.includes(valorActual)) {
        elegido = valorActual
      } else if (permitidos.length > 0) {
        elegido = permitidos[0]
      }

      setCicloSeleccionadoState(elegido)
      guardarCicloLocal(elegido)
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
      guardarCicloLocal(valor)
    },
    [ciclos, cicloActualSistema]
  )

  const value = useMemo(
    () => ({
      ciclos,
      cicloSeleccionado,
      cicloActualSistema,
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
