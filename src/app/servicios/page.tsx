'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { ChevronRight, Menu, ArrowLeft, Shield } from 'lucide-react'
import {
  SERVICIOS_MENU,
  type ServiciosModuloId,
  esServiciosModuloId,
} from './menu'

function ServiciosModuloPlaceholder({ titulo }: { titulo: string }) {
  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header">
        <h1 className="servicios-panel-title">{titulo}</h1>
        <p className="servicios-panel-lead">
          Aquí se cargará el desarrollo de este módulo. Puedes sustituir este bloque por el
          componente correspondiente cuando esté listo.
        </p>
      </header>
      <div className="servicios-panel-card">
        <p className="servicios-panel-hint">
          Conecta formularios, tablas o llamadas a API en un componente dedicado e impórtalo
          según el identificador del menú.
        </p>
      </div>
    </div>
  )
}

/** Punto de extensión: añade un `case` por cada módulo con su pantalla real. */
function ServiciosPanelContenido({
  moduloId,
  titulo,
}: {
  moduloId: ServiciosModuloId
  titulo: string
}) {
  switch (moduloId) {
    default:
      return <ServiciosModuloPlaceholder titulo={titulo} />
  }
}

function ServiciosPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const moduloFromUrl = searchParams.get('modulo')
  const inicial = useMemo(() => {
    if (moduloFromUrl && esServiciosModuloId(moduloFromUrl)) return moduloFromUrl
    return SERVICIOS_MENU[0].id
  }, [moduloFromUrl])

  const [moduloActivo, setModuloActivo] = useState<ServiciosModuloId>(inicial)

  useEffect(() => {
    if (moduloFromUrl && esServiciosModuloId(moduloFromUrl)) {
      setModuloActivo(moduloFromUrl)
    }
  }, [moduloFromUrl])

  const seleccionarModulo = useCallback(
    (id: ServiciosModuloId) => {
      setModuloActivo(id)
      setSidebarOpen(false)
      const params = new URLSearchParams(searchParams.toString())
      params.set('modulo', id)
      router.replace(`/servicios?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const itemActivo = SERVICIOS_MENU.find((m) => m.id === moduloActivo) ?? SERVICIOS_MENU[0]

  const handleLogout = async () => {
    try {
      await logout()
      router.replace('/login')
    } catch {
      router.replace('/login')
    }
  }

  return (
    <div className="servicios-app">
      <button
        type="button"
        className="servicios-mobile-toggle"
        aria-label="Abrir menú de servicios"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu size={22} />
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="servicios-sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`servicios-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="servicios-sidebar-brand">
          <div className="servicios-sidebar-shield" aria-hidden>
            <Shield size={28} strokeWidth={1.5} />
          </div>
          <span className="servicios-sidebar-brand-text">Servicios</span>
        </div>

        <nav className="servicios-sidebar-nav" aria-label="Módulos de servicios">
          {SERVICIOS_MENU.map((item) => {
            const Icon = item.icon
            const active = item.id === moduloActivo
            return (
              <button
                key={item.id}
                type="button"
                className={`servicios-nav-item ${active ? 'active' : ''}`}
                onClick={() => seleccionarModulo(item.id)}
              >
                <Icon className="servicios-nav-icon" size={18} strokeWidth={1.75} aria-hidden />
                <span className="servicios-nav-label">{item.label}</span>
                {active && (
                  <ChevronRight className="servicios-nav-chevron" size={16} aria-hidden />
                )}
              </button>
            )
          })}
        </nav>

        <div className="servicios-sidebar-footer">
          {user?.usuario_nombre_completo && (
            <p className="servicios-sidebar-user">{user.usuario_nombre_completo}</p>
          )}
          <button type="button" className="servicios-sidebar-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="servicios-main">
        <div className="servicios-main-toolbar">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={18} aria-hidden />
            Volver al panel
          </button>
        </div>
        <div className="servicios-main-scroll">
          <ServiciosPanelContenido moduloId={moduloActivo} titulo={itemActivo.label} />
        </div>
      </main>
    </div>
  )
}

function ServiciosSuspenseFallback() {
  return (
    <div className="servicios-app servicios-app--loading">
      <div className="servicios-loading-msg">Cargando servicios…</div>
    </div>
  )
}

export default function ServiciosPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<ServiciosSuspenseFallback />}>
        <ServiciosPageInner />
      </Suspense>
    </ProtectedRoute>
  )
}
