'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OctagonAlert, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import { PANEL_CONTROL_USUARIOS, type MedidorProceso, type PanelControlRespuesta } from '@/lib/panelControl/tipos'
import type { PanelUniformesRespuesta } from '@/lib/panelControl/uniformes'
import './panel-control-alerta.css'

const REVISION_MS = 60_000
const CLAVE_VISTO = 'servicios-admin-panel-alerta-vista'

type Falla = Pick<MedidorProceso, 'id' | 'nombre' | 'estado' | 'resumen'>

function leerVistas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTO) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function guardarVistas(claves: string[]) {
  try {
    if (claves.length) localStorage.setItem(CLAVE_VISTO, JSON.stringify(claves))
    else localStorage.removeItem(CLAVE_VISTO)
  } catch {}
}

const clave = (f: Falla) => `${f.id}:${f.estado}`

/** Aviso amarillo (precaución) o rojo (alarma) de la infraestructura, en cualquier pantalla; solo para quien ve el panel de control. */
export default function PanelControlAlerta() {
  const { session } = useAuth()
  const pathname = usePathname()
  const permitido = PANEL_CONTROL_USUARIOS.includes(Number(session?.usuario_id) || 0)
  const enPanel = pathname?.startsWith('/panel-control') ?? false
  const tituloId = useId()
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const [fallas, setFallas] = useState<Falla[]>([])
  const [abierto, setAbierto] = useState(false)

  const revisar = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const leer = async <T,>(url: string): Promise<T | null> => {
        const res = await fetch(url, { cache: 'no-store', headers: portalSessionFetchHeaders() })
        return res.ok ? ((await res.json()) as T) : null
      }
      const [servicios, uniformes] = await Promise.all([
        leer<PanelControlRespuesta>('/api/panel-control').catch(() => null),
        leer<PanelUniformesRespuesta>('/api/panel-control/uniformes').catch(() => null),
      ])
      if (!servicios && !uniformes) return
      const actuales: Falla[] = [
        ...(servicios?.medidores ?? []),
        ...(servicios?.sistemas ?? []),
        ...(uniformes?.medidores ?? []).map((m) => ({ ...m, nombre: `Uniformes · ${m.nombre}` })),
      ]
        .filter((m) => m.estado === 'precaucion' || m.estado === 'alarma')
        .map(({ id, nombre, estado, resumen }) => ({ id, nombre, estado, resumen }))
        .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'alarma' ? -1 : 1))
      const vistas = leerVistas()
      const vigentes = vistas.filter((v) => actuales.some((f) => clave(f) === v))
      if (vigentes.length !== vistas.length) guardarVistas(vigentes)
      setFallas(actuales)
      if (actuales.some((f) => !vigentes.includes(clave(f)))) setAbierto(true)
      else if (!actuales.length) setAbierto(false)
    } catch {}
  }, [])

  useEffect(() => {
    if (!permitido || enPanel) return
    void revisar()
    const t = window.setInterval(() => void revisar(), REVISION_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void revisar()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [permitido, enPanel, revisar])

  const cerrar = useCallback(() => {
    guardarVistas(fallas.map(clave))
    setAbierto(false)
  }, [fallas])

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => cerrarRef.current?.focus(), 40)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [abierto, cerrar])

  if (!permitido || enPanel || !abierto || !fallas.length) return null

  const alarma = fallas.some((f) => f.estado === 'alarma')
  const Icono = alarma ? OctagonAlert : TriangleAlert

  return (
    <div className="pca-root" data-nivel={alarma ? 'alarma' : 'precaucion'} role="presentation">
      <button type="button" className="pca-fondo" aria-label="Cerrar aviso" onClick={cerrar} />
      <div className="pca-panel" role="alertdialog" aria-modal="true" aria-labelledby={tituloId}>
        <header className="pca-cabeza">
          <span className="pca-icono" aria-hidden>
            <Icono size={30} strokeWidth={2.4} />
          </span>
          <div className="pca-cabeza-texto">
            <h2 id={tituloId} className="pca-titulo">
              {alarma ? 'Falla en la infraestructura' : 'Advertencia en la infraestructura'}
            </h2>
            <p className="pca-sub">
              {alarma
                ? 'Hay piezas en rojo: un proceso no está respondiendo o falla seguido.'
                : 'Hay piezas en amarillo: responden, pero lento o con fallos ocasionales.'}
            </p>
          </div>
          <button ref={cerrarRef} type="button" className="pca-cerrar" onClick={cerrar} aria-label="Cerrar">
            <X size={22} aria-hidden />
          </button>
        </header>

        <ul className="pca-lista">
          {fallas.map((f) => (
            <li key={f.id} className="pca-item" data-estado={f.estado}>
              <span className="pca-lampara" aria-hidden />
              <span className="pca-item-texto">
                <strong>{f.nombre}</strong>
                <span>{f.resumen}</span>
              </span>
              <span className="pca-item-estado">{f.estado === 'alarma' ? 'Falla' : 'Advertencia'}</span>
            </li>
          ))}
        </ul>

        <footer className="pca-pie">
          <button type="button" className="pca-boton" onClick={cerrar}>
            Entendido
          </button>
          <Link href="/panel-control" className="pca-boton pca-boton--pri" onClick={cerrar}>
            Ver Main Control Room
          </Link>
        </footer>
      </div>
    </div>
  )
}
