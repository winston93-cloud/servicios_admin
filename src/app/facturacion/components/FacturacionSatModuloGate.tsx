'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import FacturacionSatModuloLogin from './FacturacionSatModuloLogin'

type SatModuloContextValue = {
  usuario: string | null
  cerrarSesion: () => Promise<void>
}

const SatModuloContext = createContext<SatModuloContextValue | null>(null)

export function useSatModuloAuth() {
  const ctx = useContext(SatModuloContext)
  if (!ctx) {
    throw new Error('useSatModuloAuth debe usarse dentro del módulo SAT.')
  }
  return ctx
}

type Props = {
  children: React.ReactNode
}

export default function FacturacionSatModuloGate({ children }: Props) {
  const [estado, setEstado] = useState<'cargando' | 'login' | 'ok'>('cargando')
  const [usuario, setUsuario] = useState<string | null>(null)

  const revisarSesion = useCallback(async () => {
    try {
      const res = await fetch('/api/sat/modulo-login', { credentials: 'include' })
      if (!res.ok) {
        setEstado('login')
        setUsuario(null)
        return
      }
      const data = (await res.json()) as { autenticado?: boolean; usuario?: string }
      if (data.autenticado && data.usuario) {
        setUsuario(data.usuario)
        setEstado('ok')
      } else {
        setEstado('login')
        setUsuario(null)
      }
    } catch {
      setEstado('login')
      setUsuario(null)
    }
  }, [])

  const cerrarSesion = useCallback(async () => {
    await fetch('/api/sat/modulo-logout', {
      method: 'POST',
      credentials: 'include',
    })
    setUsuario(null)
    setEstado('login')
  }, [])

  useEffect(() => {
    void revisarSesion()
  }, [revisarSesion])

  if (estado === 'cargando') {
    return (
      <div className="portal-access-loading">
        <div className="portal-access-loading-spinner" />
        <p>Verificando acceso al módulo SAT…</p>
      </div>
    )
  }

  if (estado === 'login') {
    return (
      <FacturacionSatModuloLogin
        onAutenticado={(u) => {
          setUsuario(u)
          setEstado('ok')
        }}
      />
    )
  }

  return (
    <SatModuloContext.Provider value={{ usuario, cerrarSesion }}>
      {children}
    </SatModuloContext.Provider>
  )
}
