'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  CATEGORIAS,
  parsearEnlaceX,
  type BorradorEnlaceX,
  type CategoriaEnlace,
  type EnlaceX,
} from '@/lib/enlacesX/enlacesXTypes'
import { fetchAdmin } from './adminFetch'

type Campos = { titulo: string; resumen: string; nota: string; autor: string; categoria: CategoriaEnlace | '' }
const VACIO: Campos = { titulo: '', resumen: '', nota: '', autor: '', categoria: '' }

export default function FormAlta({
  pin,
  onGuardado,
  onPinInvalido,
}: {
  pin: string
  onGuardado: (e: EnlaceX) => void
  onPinInvalido: () => void
}) {
  const [url, setUrl] = useState('')
  const [borrador, setBorrador] = useState<BorradorEnlaceX | null>(null)
  const [campos, setCampos] = useState<Campos>(VACIO)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urlValida = parsearEnlaceX(url) !== null
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setCampos((c) => ({ ...c, [k]: v }))

  async function autocompletar() {
    setError(null)
    if (!urlValida) {
      setError('Pega el enlace de una publicación de X, por ejemplo https://x.com/cursor_ai/status/…')
      return
    }
    setLeyendo(true)
    const r = await fetchAdmin<{ borrador: BorradorEnlaceX }>('/api/enlaces-x/autocompletar', pin, {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
    setLeyendo(false)
    if (r.status === 401) return onPinInvalido()
    if (!r.ok) return setError(r.error)
    const b = r.data.borrador
    setBorrador(b)
    setCampos({ titulo: b.titulo, resumen: b.resumen, nota: '', autor: b.autor, categoria: b.categoria })
    if (!b.autocompletadoIA) setError('No se pudo traducir automáticamente; completa el título y el resumen a mano.')
  }

  async function guardar() {
    if (!borrador) return
    setError(null)
    if (!campos.titulo.trim()) return setError('Escribe el título.')
    if (!campos.categoria) return setError('Elige una categoría.')
    setGuardando(true)
    const r = await fetchAdmin<{ enlace: EnlaceX }>('/api/enlaces-x', pin, {
      method: 'POST',
      body: JSON.stringify({ enlace: borrador.enlace, ...campos }),
    })
    setGuardando(false)
    if (r.status === 401) return onPinInvalido()
    if (!r.ok) return setError(r.error)
    onGuardado(r.data.enlace)
  }

  return (
    <form
      className="tp-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (borrador) void guardar()
        else void autocompletar()
      }}
    >
      <label className="tp-campo">
        <span>Enlace de la publicación en X</span>
        <div className="tp-campo-fila">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (borrador) {
                setBorrador(null)
                setCampos(VACIO)
              }
            }}
            placeholder="https://x.com/usuario/status/…"
            autoFocus
            required
          />
          <button type="button" className="tp-accion" onClick={autocompletar} disabled={leyendo || !url.trim()}>
            {leyendo ? <Loader2 size={16} className="tp-girar" aria-hidden /> : <Sparkles size={16} aria-hidden />}
            <span>{leyendo ? 'Leyendo…' : 'Autocompletar'}</span>
          </button>
        </div>
        <small>La IA lee la publicación, la traduce al español y sugiere título y categoría. Tú lo revisas antes de guardar.</small>
      </label>

      {leyendo && (
        <div className="tp-form-cargando" role="status">
          <Loader2 size={18} className="tp-girar" aria-hidden /> Leyendo la publicación y traduciendo…
        </div>
      )}

      {error && <p className="tp-form-error" role="alert">{error}</p>}

      {borrador && (
        <>
          <label className="tp-campo">
            <span>Título en español</span>
            <input value={campos.titulo} onChange={(e) => set('titulo', e.target.value)} maxLength={200} required />
          </label>
          <label className="tp-campo">
            <span>Resumen</span>
            <textarea value={campos.resumen} onChange={(e) => set('resumen', e.target.value)} rows={4} maxLength={2000} />
          </label>
          <fieldset className="tp-campo">
            <legend>Categoría</legend>
            <div className="tp-form-cats">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  className="tp-chip"
                  data-cat={c.valor}
                  aria-pressed={campos.categoria === c.valor}
                  onClick={() => set('categoria', c.valor)}
                >
                  <i aria-hidden /> {c.etiqueta}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="tp-campo">
            <span>Nota de Dirección General <em>(opcional)</em></span>
            <textarea
              value={campos.nota}
              onChange={(e) => set('nota', e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Ej. Revisen esto e intégrenlo a sus agentes."
            />
          </label>
          <label className="tp-campo">
            <span>Autor en X</span>
            <input value={campos.autor} onChange={(e) => set('autor', e.target.value)} maxLength={120} />
            <small>@{borrador.cuenta}</small>
          </label>
          {borrador.textoOriginal && (
            <details className="tp-original">
              <summary>Ver texto original</summary>
              <p>{borrador.textoOriginal}</p>
            </details>
          )}
          <button type="submit" className="tp-accion tp-accion--ancha" disabled={guardando}>
            {guardando && <Loader2 size={16} className="tp-girar" aria-hidden />}
            {guardando ? 'Guardando…' : 'Guardar publicación'}
          </button>
        </>
      )}
    </form>
  )
}
