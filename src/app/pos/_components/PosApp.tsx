'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ClipboardCheck,
  Coffee,
  FileBarChart,
  LogOut,
  Package,
  ShoppingBag,
  Users,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { EVENTO_SESION_POS_EXPIRADA, posApi } from '@/lib/pos/posApi'
import { fechaLarga, fechaMx, type PosProducto } from '@/lib/pos/posTipos'
import VentaView from './VentaView'
import ConsultaDiariaView from './ConsultaDiariaView'
import ProductosView from './ProductosView'
import ExternosView from './ExternosView'
import ReportesView from './ReportesView'
import { ToastProvider } from './Toast'

type Vista = 'venta' | 'consulta' | 'productos' | 'externos' | 'reportes'

const VISTAS: { id: Vista; etiqueta: string; corta: string; icono: typeof ShoppingBag }[] = [
  { id: 'venta', etiqueta: 'Punto de venta', corta: 'Venta', icono: ShoppingBag },
  { id: 'consulta', etiqueta: 'Consulta diaria', corta: 'Entregas', icono: ClipboardCheck },
  { id: 'reportes', etiqueta: 'Reportes', corta: 'Reportes', icono: FileBarChart },
  { id: 'productos', etiqueta: 'Productos', corta: 'Productos', icono: Package },
  { id: 'externos', etiqueta: 'Externos', corta: 'Externos', icono: Users },
]

export default function PosApp({ onSesionCerrada }: { onSesionCerrada: () => void }) {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>('venta')
  const [productos, setProductos] = useState<PosProducto[]>([])
  const [errorCatalogo, setErrorCatalogo] = useState('')
  const hoy = fechaMx()

  const cargarProductos = useCallback(async () => {
    try {
      setProductos(await posApi.productos())
      setErrorCatalogo('')
    } catch (e) {
      setErrorCatalogo(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.')
    }
  }, [])

  useEffect(() => {
    void cargarProductos()
  }, [cargarProductos])

  useEffect(() => {
    const expirada = () => onSesionCerrada()
    window.addEventListener(EVENTO_SESION_POS_EXPIRADA, expirada)
    return () => window.removeEventListener(EVENTO_SESION_POS_EXPIRADA, expirada)
  }, [onSesionCerrada])

  const salir = async () => {
    try {
      await fetch('/api/pos/auth', { method: 'DELETE', cache: 'no-store' })
    } finally {
      onSesionCerrada()
    }
  }

  return (
    <ToastProvider>
      <div className="cj">
        <header className="cj-top">
          <div className="cj-top-inner">
            <div className="cj-brand">
              <span className="cj-brand-icon" aria-hidden>
                <Coffee size={20} strokeWidth={1.8} />
              </span>
              <div className="cj-brand-text">
                <span className="cj-brand-kicker">Caja · Alimentación escolar</span>
                <span className="cj-brand-title">Desayunos</span>
              </div>
            </div>

            <nav className="cj-tabs" aria-label="Secciones del punto de venta">
              {VISTAS.map(({ id, etiqueta, corta, icono: Icono }) => (
                <button
                  key={id}
                  type="button"
                  className={`cj-tab${vista === id ? ' is-active' : ''}`}
                  aria-current={vista === id ? 'page' : undefined}
                  onClick={() => setVista(id)}
                >
                  <Icono size={17} aria-hidden />
                  <span className="cj-tab-largo">{etiqueta}</span>
                  <span className="cj-tab-corto">{corta}</span>
                </button>
              ))}
            </nav>

            <div className="cj-top-actions">
              <span className="cj-today" title="Fecha de hoy (hora de México)">
                {fechaLarga(hoy)}
              </span>
              <ThemeToggle />
              <button
                type="button"
                className="cj-icon-btn"
                onClick={() => router.push('/dashboard')}
                title="Volver al dashboard"
                aria-label="Volver al dashboard"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                className="cj-icon-btn"
                onClick={salir}
                title="Cerrar caja"
                aria-label="Cerrar sesión de caja"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {errorCatalogo ? (
          <div className="cj-banner cj-banner--error" role="alert">
            {errorCatalogo}
            <button type="button" className="cj-link" onClick={() => void cargarProductos()}>
              Reintentar
            </button>
          </div>
        ) : null}

        <main className="cj-main">
          <div hidden={vista !== 'venta'}>
            <VentaView productos={productos} activa={vista === 'venta'} />
          </div>
          {vista === 'consulta' && <ConsultaDiariaView productos={productos} />}
          {vista === 'reportes' && <ReportesView />}
          {vista === 'productos' && <ProductosView onCambio={cargarProductos} />}
          {vista === 'externos' && <ExternosView />}
        </main>
      </div>
    </ToastProvider>
  )
}
