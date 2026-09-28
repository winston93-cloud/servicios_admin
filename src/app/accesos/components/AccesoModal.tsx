'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, Save, Sparkles, X } from 'lucide-react'
import { CATEGORIAS_ACCESO, type AccesoAutorizado, type CategoriaAcceso } from '@/lib/accesos/accesosTypes'
import { IconoCategoria } from './IconoCategoria'

function generarPassword(largo = 16): string {
  const juego = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_+?'
  const bytes = crypto.getRandomValues(new Uint32Array(largo))
  return Array.from(bytes, (b) => juego[b % juego.length]).join('')
}

export default function AccesoModal({
  acceso,
  onCerrar,
  onGuardar,
}: {
  acceso: AccesoAutorizado | null
  onCerrar: () => void
  onGuardar: (body: Record<string, unknown>) => Promise<void>
}) {
  const editando = !!acceso
  const [plataforma, setPlataforma] = useState(acceso?.plataforma ?? '')
  const [categoria, setCategoria] = useState<CategoriaAcceso>(acceso?.categoria ?? 'sistema')
  const [usuario, setUsuario] = useState(acceso?.usuario ?? '')
  const [password, setPassword] = useState('')
  const [quitarPassword, setQuitarPassword] = useState(false)
  const [verPassword, setVerPassword] = useState(false)
  const [url, setUrl] = useState(acceso?.url ?? '')
  const [responsable, setResponsable] = useState(acceso?.responsable ?? '')
  const [notas, setNotas] = useState(acceso?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const primerCampo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primerCampo.current?.focus()
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plataforma.trim()) {
      setError('Escribe el nombre de la plataforma o equipo.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({
        id: acceso?.id,
        plataforma,
        categoria,
        usuario,
        password,
        quitar_password: editando && quitarPassword && !password,
        url,
        responsable,
        notas,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <div className="ac-overlay" role="presentation" onClick={onCerrar}>
      <form className="ac-modal" role="dialog" aria-modal="true" aria-labelledby="ac-modal-t" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <div className="ac-modal-head">
          <h2 id="ac-modal-t">{editando ? `Editar «${acceso.plataforma}»` : 'Nuevo acceso'}</h2>
          <button type="button" className="ac-ico-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="ac-modal-cuerpo">
          <fieldset className="ac-field">
            <legend>¿Qué tipo de acceso es?</legend>
            <div className="ac-cat-opciones">
              {CATEGORIAS_ACCESO.map((c) => (
                <label key={c.id} className="ac-cat-opcion" data-activo={categoria === c.id || undefined}>
                  <input type="radio" name="categoria" value={c.id} checked={categoria === c.id} onChange={() => setCategoria(c.id)} />
                  <IconoCategoria categoria={c.id} size={16} /> {c.corta}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="ac-field">
            <span>Plataforma o equipo *</span>
            <input ref={primerCampo} value={plataforma} onChange={(e) => setPlataforma(e.target.value)}
              placeholder="Ej. PC de Mario (Ubuntu), Gmail de Dirección, Banorte…" maxLength={160} required />
          </label>

          <div className="ac-fila-2">
            <label className="ac-field">
              <span>Usuario</span>
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Usuario o correo" autoComplete="off" maxLength={200} />
            </label>
            <label className="ac-field">
              <span>Contraseña</span>
              <div className="ac-input-wrap">
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (e.target.value) setQuitarPassword(false)
                  }}
                  placeholder={editando && acceso.tiene_password ? 'Déjala vacía para no cambiarla' : 'Contraseña'}
                  autoComplete="new-password"
                  maxLength={500}
                />
                <button type="button" className="ac-input-ico" onClick={() => setVerPassword((v) => !v)} aria-label={verPassword ? 'Ocultar' : 'Mostrar'}>
                  {verPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
              <span className="ac-field-acciones">
                <button type="button" className="ac-link" onClick={() => { setPassword(generarPassword()); setVerPassword(true); setQuitarPassword(false) }}>
                  <Sparkles size={14} aria-hidden /> Generar una segura
                </button>
                {editando && acceso.tiene_password ? (
                  <label className="ac-check">
                    <input type="checkbox" checked={quitarPassword} onChange={(e) => { setQuitarPassword(e.target.checked); if (e.target.checked) setPassword('') }} />
                    Quitar la contraseña guardada
                  </label>
                ) : null}
              </span>
            </label>
          </div>

          <div className="ac-fila-2">
            <label className="ac-field">
              <span>Página web (opcional)</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ej. mail.google.com" inputMode="url" maxLength={500} />
            </label>
            <label className="ac-field">
              <span>¿De quién es? (opcional)</span>
              <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Ej. Mario, Dirección, Caja" maxLength={160} />
            </label>
          </div>

          <label className="ac-field">
            <span>Notas (opcional)</span>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={2000}
              placeholder="Ej. PIN, preguntas de seguridad, para qué se usa…" />
          </label>

          {error ? <p className="ac-error" role="alert">{error}</p> : null}
        </div>

        <div className="ac-modal-pie">
          <button type="button" className="ac-btn" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="ac-btn ac-btn-primario" disabled={guardando}>
            {guardando ? <Loader2 size={16} className="ac-spin" aria-hidden /> : <Save size={16} aria-hidden />}
            {editando ? 'Guardar cambios' : 'Registrar acceso'}
          </button>
        </div>
      </form>
    </div>
  )
}
