'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { sumarDias, textoSemana } from '@/lib/teamEnglish/teTypes'
import { teArchivoUrl } from '../teApi'

/** URL local de un archivo privado del bucket; null mientras carga o si falla. */
export function useArchivoUrl(key: string | null | undefined, conSesion = true): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    if (!key) {
      setUrl(null)
      return
    }
    teArchivoUrl(key, conSesion)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(null))
    return () => {
      vivo = false
    }
  }, [key, conSesion])
  return url
}

/** Foto si la hay; si no, el sticker propio; si no, el emoji. */
export function Avatar({ emoji, fotoKey, stickerKey, nombre, tam = 'md', conSesion = true }: {
  emoji: string
  fotoKey?: string | null
  stickerKey?: string | null
  nombre: string
  tam?: 'sm' | 'md' | 'lg'
  conSesion?: boolean
}) {
  const foto = useArchivoUrl(fotoKey, conSesion)
  const sticker = useArchivoUrl(fotoKey ? null : stickerKey, conSesion)
  const url = foto ?? sticker
  return (
    <span className="te-avatar" data-tam={tam} data-sticker={(!foto && !!sticker) || undefined} aria-hidden={!url}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={foto ? `Foto de ${nombre}` : `Sticker de ${nombre}`} /> : <span>{emoji}</span>}
    </span>
  )
}

export function StickerImg({ stickerKey, alt, conSesion = true }: { stickerKey: string; alt: string; conSesion?: boolean }) {
  const url = useArchivoUrl(stickerKey, conSesion)
  /* eslint-disable-next-line @next/next/no-img-element */
  return url ? <img className="te-sticker-img" src={url} alt={alt} /> : <Loader2 size={16} className="te-spin" aria-hidden />
}

/** Nombre completo con el apodo debajo («Miss Maru»). */
export function NombreTeacher({ t, como: Tag = 'strong', className }: { t: { nombre: string; apodo?: string | null }; como?: 'strong' | 'span' | 'h3'; className?: string }) {
  return (
    <span className="te-nombre-teacher te-min0">
      <Tag className={className}>{t.nombre}</Tag>
      {t.apodo ? <small className="te-apodo">«{t.apodo}»</small> : null}
    </span>
  )
}

export function Hoja({ abierta, titulo, emoji, onCerrar, children, pie, ancho }: {
  abierta: boolean
  /** Ventana centrada y amplia (expedientes) en lugar del panel lateral. */
  ancho?: boolean
  titulo: string
  emoji?: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  /** onCerrar cambia en cada render del padre; si fuera dependencia del efecto, cada tecla le quitaría el foco al input. */
  const cerrarRef = useRef(onCerrar)
  useEffect(() => {
    cerrarRef.current = onCerrar
  })
  useEffect(() => {
    if (!abierta) return
    const previo = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cerrarRef.current()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [abierta])
  if (!abierta) return null
  /** Fuera de las secciones animadas: un ancestro con transform encierra al position: fixed. */
  const destino = typeof document !== 'undefined' ? document.querySelector('.te-page') : null
  const hoja = (
    <div className="te-hoja-fondo" data-ancho={ancho || undefined} onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="te-hoja" data-ancho={ancho || undefined} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <header className="te-hoja-head">
          <h2 id={id}>
            {emoji ? <span aria-hidden>{emoji}</span> : null} {titulo}
          </h2>
          <button type="button" className="te-icon-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="te-hoja-body">{children}</div>
        {pie ? <footer className="te-hoja-pie">{pie}</footer> : null}
      </div>
    </div>
  )
  return destino ? createPortal(hoja, destino) : hoja
}

export function Campo({ etiqueta, children, completo, ayuda }: { etiqueta: string; children: ReactNode; completo?: boolean; ayuda?: string }) {
  return (
    <label className="te-campo" data-completo={completo || undefined}>
      <span className="te-campo-label">{etiqueta}</span>
      {children}
      {ayuda ? <span className="te-campo-ayuda">{ayuda}</span> : null}
    </label>
  )
}

export function Semana({ lunes, onCambiar, hoyLunes }: { lunes: string; onCambiar: (l: string) => void; hoyLunes: string }) {
  return (
    <div className="te-semana" role="group" aria-label="Semana">
      <button type="button" className="te-icon-btn" onClick={() => onCambiar(sumarDias(lunes, -7))} aria-label="Semana anterior">
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span className="te-semana-texto">
        <small>{lunes === hoyLunes ? 'Esta semana' : lunes > hoyLunes ? 'Próxima' : 'Semana'}</small>
        {textoSemana(lunes)}
      </span>
      <button type="button" className="te-icon-btn" onClick={() => onCambiar(sumarDias(lunes, 7))} aria-label="Semana siguiente">
        <ChevronRight size={18} aria-hidden />
      </button>
      {lunes !== hoyLunes ? (
        <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => onCambiar(hoyLunes)}>
          Hoy
        </button>
      ) : null}
    </div>
  )
}

export function Vacio({ emoji, titulo, children }: { emoji: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="te-vacio">
      <span className="te-vacio-emoji" aria-hidden>{emoji}</span>
      <p className="te-vacio-titulo">{titulo}</p>
      {children ? <div className="te-vacio-texto">{children}</div> : null}
    </div>
  )
}

export function SelectorArchivo({ etiqueta, onArchivo, archivo, aceptar }: { etiqueta: string; onArchivo: (f: File | null) => void; archivo: File | null; aceptar?: string }) {
  return (
    <label className="te-archivo">
      <input type="file" accept={aceptar} onChange={(e) => onArchivo(e.target.files?.[0] ?? null)} />
      <span aria-hidden>📎</span>
      <span className="te-archivo-texto">{archivo ? archivo.name : etiqueta}</span>
    </label>
  )
}

export const ACEPTAR_DOCS = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp'
