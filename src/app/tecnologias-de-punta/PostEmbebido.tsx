'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type Twttr = {
  widgets: {
    createTweet: (id: string, el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLElement | undefined>
  }
}

let cargaWidgets: Promise<Twttr | null> | null = null

function cargarWidgets(): Promise<Twttr | null> {
  const w = window as unknown as { twttr?: Twttr }
  if (w.twttr?.widgets) return Promise.resolve(w.twttr)
  if (!cargaWidgets) {
    cargaWidgets = new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = 'https://platform.twitter.com/widgets.js'
      s.async = true
      s.onload = () => resolve(w.twttr?.widgets ? w.twttr : null)
      s.onerror = () => {
        cargaWidgets = null
        resolve(null)
      }
      document.head.appendChild(s)
    })
  }
  return cargaWidgets
}

/** Publicación de X incrustada con el widget oficial (x.com no permite iframes directos). */
export default function PostEmbebido({ tweetId, enlace }: { tweetId: string; enlace: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando')

  useEffect(() => {
    let vivo = true
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    setEstado('cargando')
    const limite = setTimeout(() => { if (vivo) setEstado((e) => (e === 'cargando' ? 'error' : e)) }, 15000)
    cargarWidgets().then(async (tw) => {
      if (!vivo) return
      if (!tw) return setEstado('error')
      const res = await tw.widgets.createTweet(tweetId, el, {
        theme: theme === 'dark' ? 'dark' : 'light',
        lang: 'es',
        dnt: true,
        align: 'center',
        conversation: 'none',
      }).catch(() => undefined)
      if (vivo) setEstado(res ? 'ok' : 'error')
    })
    return () => {
      vivo = false
      clearTimeout(limite)
    }
  }, [tweetId, theme])

  return (
    <div className="tp-embed">
      {estado === 'cargando' && (
        <div className="tp-embed-cargando" role="status">
          <Loader2 size={22} className="tp-girar" aria-hidden />
          <span>Cargando publicación de X…</span>
        </div>
      )}
      {estado === 'error' && (
        <div className="tp-embed-error">
          <p>No se pudo mostrar la publicación aquí. Puede que X la haya ocultado o que tu red bloquee el contenido de X.</p>
          <a className="tp-accion" href={enlace} target="_blank" rel="noopener noreferrer">
            Abrir en X <ArrowUpRight size={16} aria-hidden />
          </a>
        </div>
      )}
      <div ref={ref} className="tp-embed-host" hidden={estado === 'error'} />
    </div>
  )
}
