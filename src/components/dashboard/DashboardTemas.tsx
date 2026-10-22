'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Check, Palette } from 'lucide-react'

export type DashTema = 'original' | 'institucional' | 'campus' | 'bauhaus' | 'revista' | 'aurora'

/** «original» es el diseño de siempre; Institucional y Campus son de la marca (Poppins y sus colores). */
export const DASH_TEMAS: { id: DashTema; nombre: string; sub: string }[] = [
  { id: 'original', nombre: 'Original', sub: 'El diseño de siempre' },
  { id: 'institucional', nombre: 'Institucional', sub: 'Las barras inclinadas de la marca sobre corte azul' },
  { id: 'campus', nombre: 'Campus', sub: 'Azul rey con bloques naranja, lima y gris' },
  { id: 'bauhaus', nombre: 'Bauhaus', sub: 'Círculos, cuadros y colores primarios' },
  { id: 'revista', nombre: 'Revista', sub: 'Portada editorial con número gigante' },
  { id: 'aurora', nombre: 'Aurora', sub: 'Luces de colores y tarjetas de cristal' },
]

const CLAVE = 'servicios-admin-dashboard-tema'
const EVENTO = 'dash-tema'

function leer(): DashTema {
  try {
    const v = window.localStorage.getItem(CLAVE)
    return DASH_TEMAS.some((t) => t.id === v) ? (v as DashTema) : 'original'
  } catch {
    return 'original'
  }
}

function suscribir(cb: () => void): () => void {
  window.addEventListener('storage', cb)
  window.addEventListener(EVENTO, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(EVENTO, cb)
  }
}

/** Estilo del dashboard en este navegador (localStorage, independiente del claro/oscuro). */
export function useDashTema(): [DashTema, (t: DashTema) => void] {
  const tema = useSyncExternalStore(suscribir, leer, () => 'original' as DashTema)
  const cambiar = (t: DashTema) => {
    try {
      window.localStorage.setItem(CLAVE, t)
    } catch {
      /* modo privado: solo dura la sesión */
    }
    window.dispatchEvent(new Event(EVENTO))
  }
  return [tema, cambiar]
}

export function DashTemaSwitch({ tema, onCambiar }: { tema: DashTema; onCambiar: (t: DashTema) => void }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const actual = DASH_TEMAS.find((t) => t.id === tema) ?? DASH_TEMAS[0]

  useEffect(() => {
    if (!abierto) return
    lista.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      caja.current?.querySelector<HTMLButtonElement>('.dash-tema-btn')?.focus()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('touchstart', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('touchstart', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const i = DASH_TEMAS.findIndex((t) => t.id === tema)
    const sig = DASH_TEMAS[(i + paso + DASH_TEMAS.length) % DASH_TEMAS.length]
    onCambiar(sig.id)
    requestAnimationFrame(() => lista.current?.querySelector<HTMLButtonElement>(`[data-tema-op="${sig.id}"]`)?.focus())
  }

  return (
    <div className="dash-tema" ref={caja}>
      <button
        type="button"
        className="dash-tema-btn"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={id}
        title={`Estilo del panel: ${actual.nombre}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <Palette size={18} strokeWidth={2.25} aria-hidden />
        <span className="dash-tema-btn-txt">
          <span>Estilo</span>
          <small>Cambia el diseño de tu inicio</small>
        </span>
        <span className="dash-tema-nuevo">Nuevo</span>
      </button>
      {abierto ? (
        <div className="dash-tema-pop" id={id}>
          <p className="dash-tema-pop-titulo">Elige el estilo de tu panel</p>
          <div className="dash-tema-lista" role="radiogroup" aria-label="Estilo del panel" ref={lista} onKeyDown={mover}>
            {DASH_TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === tema}
                tabIndex={t.id === tema ? 0 : -1}
                data-tema-op={t.id}
                className="dash-tema-op"
                onClick={() => onCambiar(t.id)}
              >
                <span className="dash-tema-muestra" data-muestra={t.id} aria-hidden />
                <span className="dash-tema-op-txt">
                  <b>{t.nombre}</b>
                  <small>{t.sub}</small>
                </span>
                {t.id === tema ? <Check size={18} aria-hidden className="dash-tema-check" /> : null}
              </button>
            ))}
          </div>
          <p className="dash-tema-pop-nota">Solo cambia esta pantalla de inicio. Se combina con claro/oscuro y se guarda en este dispositivo.</p>
        </div>
      ) : null}
    </div>
  )
}
