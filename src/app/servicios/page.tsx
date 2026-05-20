'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { ChevronRight, ChevronLeft, Menu, ArrowLeft, LogOut } from 'lucide-react'
import {
  SERVICIOS_MENU,
  type ServiciosModuloId,
  esServiciosModuloId,
} from './menu'
import { CicloEscolarProvider } from '@/contexts/CicloEscolarContext'
import AlumnosModulo from './modulos/AlumnosModulo'
import CiclosEscolaresModulo from './modulos/CiclosEscolaresModulo'
import MigracionModulo from './modulos/MigracionModulo'
import AsignarGruposModulo from './modulos/AsignarGruposModulo'
import BecasModulo from './modulos/BecasModulo'
import PagosInternosModulo from './modulos/PagosInternosModulo'
import CicloEscolarSelector from './components/CicloEscolarSelector'
import { AlumnoSeleccionadoProvider } from '@/contexts/AlumnoSeleccionadoContext'

const SIDEBAR_COLLAPSED_KEY = 'servicios-sidebar-collapsed'

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
    case 'migracion-tablas':
      return <MigracionModulo />
    case 'alumnos':
      return <AlumnosModulo />
    case 'catalogo-ciclos-escolares':
      return <CiclosEscolaresModulo />
    case 'asignar-grupos':
      return <AsignarGruposModulo />
    case 'becas':
      return <BecasModulo />
    case 'pagos-internos':
      return <PagosInternosModulo />
    case 'precios-pagos-internos':
      return <PagosInternosModulo abrirCatalogoInicial />
    default:
      return <ServiciosModuloPlaceholder titulo={titulo} />
  }
}

function ServiciosPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setSidebarCollapsed(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const moduloFromUrl = searchParams.get('modulo')
  const inicial = useMemo(() => {
    if (moduloFromUrl && esServiciosModuloId(moduloFromUrl)) return moduloFromUrl
    return 'alumnos'
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

  const itemActivo =
    SERVICIOS_MENU.find((m) => m.id === moduloActivo) ??
    SERVICIOS_MENU.find((m) => m.id === 'alumnos')!

  const handleLogout = async () => {
    try {
      await logout()
      router.replace('/login')
    } catch {
      router.replace('/login')
    }
  }

  return (
    <CicloEscolarProvider>
    <AlumnoSeleccionadoProvider>
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

      <aside
        className={`servicios-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'servicios-sidebar--collapsed' : ''}`}
        aria-label="Servicios administrativos"
      >
        <div className="servicios-sidebar-brand">
          <Image
            src="/logos/logo-winston-churchill.png"
            alt="Instituto Winston Churchill"
            width={64}
            height={48}
            className="servicios-sidebar-institution-logo"
            priority
          />
          <span className="servicios-sidebar-brand-text">Servicios Administrativos</span>
          <Image
            src="/logos/logo-winston-educativo.png"
            alt="Winston Educativo"
            width={64}
            height={48}
            className="servicios-sidebar-institution-logo"
            priority
          />
          <button
            type="button"
            className="servicios-sidebar-collapse"
            onClick={toggleSidebarCollapsed}
            aria-expanded={!sidebarCollapsed}
            aria-controls="servicios-modulos-nav"
            title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            )}
            <span className="servicios-sr-only">
              {sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            </span>
          </button>
        </div>

        <nav
          id="servicios-modulos-nav"
          className="servicios-sidebar-nav"
          aria-label="Módulos de servicios"
        >
          {SERVICIOS_MENU.map((item) => {
            const Icon = item.icon
            const active = item.id === moduloActivo
            return (
              <button
                key={item.id}
                type="button"
                className={`servicios-nav-item ${active ? 'active' : ''}`}
                title={item.label}
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
            <LogOut className="servicios-sidebar-logout-icon" size={18} strokeWidth={1.75} aria-hidden />
            <span className="servicios-sidebar-logout-text">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="servicios-main">
        <div className="servicios-main-toolbar servicios-main-toolbar--with-ciclo">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={18} aria-hidden />
            Volver al panel
          </button>
          <CicloEscolarSelector />
        </div>
        <div className="servicios-main-scroll">
          <ServiciosPanelContenido moduloId={moduloActivo} titulo={itemActivo.label} />
        </div>
      </main>
    </div>
    </AlumnoSeleccionadoProvider>
    </CicloEscolarProvider>
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
