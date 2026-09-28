'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import { Resaltar, norm } from '@/app/talleres/components/busqueda'
import {
  ACCESOS_USUARIOS_PERMITIDOS,
  CATEGORIAS_ACCESO,
  ETIQUETA_ACCION,
  etiquetaCategoria,
  type AccesoAutorizado,
  type AccesoBitacora,
} from '@/lib/accesos/accesosTypes'
import AccesoModal from './components/AccesoModal'
import { IconoCategoria } from './components/IconoCategoria'
import './accesos.css'

const INACTIVIDAD_MS = 10 * 60 * 1000
const MOSTRAR_MS = 20 * 1000
const LIMPIAR_PORTAPAPELES_MS = 30 * 1000

export default function AccesosPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <AccesosView />
    </ProtectedRoute>
  )
}

class CerradaError extends Error {}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...portalSessionFetchHeaders(), ...(init?.headers ?? {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401 && json.cerrada) throw new CerradaError(json.error)
  if (!res.ok) throw new Error(json.error || 'No se pudo completar la operación.')
  return json as T
}

function AccesosView() {
  const router = useRouter()
  const { session } = useAuth()
  const permitido = ACCESOS_USUARIOS_PERMITIDOS.includes(Number(session?.usuario_id) || 0)
  const [estado, setEstado] = useState<'cargando' | 'cerrada' | 'abierta'>('cargando')
  const [expira, setExpira] = useState(0)

  const cerrar = useCallback(async (llamarApi = true) => {
    if (llamarApi) await fetch('/api/accesos/sesion', { method: 'DELETE', credentials: 'same-origin' }).catch(() => null)
    setEstado('cerrada')
    setExpira(0)
  }, [])

  useEffect(() => {
    if (!permitido) return
    api<{ abierta: boolean; expira?: number }>('/api/accesos/sesion')
      .then((r) => {
        setEstado(r.abierta ? 'abierta' : 'cerrada')
        setExpira(r.expira ?? 0)
      })
      .catch(() => setEstado('cerrada'))
  }, [permitido])

  if (!permitido) {
    return (
      <Marco onVolver={() => router.push('/dashboard')}>
        <div className="ac-vacio">
          <Lock size={28} aria-hidden />
          <p>Esta sección solo está disponible para usuarios autorizados.</p>
        </div>
      </Marco>
    )
  }

  return (
    <Marco
      onVolver={() => router.push('/dashboard')}
      onCerrar={estado === 'abierta' ? () => void cerrar() : undefined}
      expira={estado === 'abierta' ? expira : 0}
    >
      {estado === 'cargando' ? (
        <div className="ac-vacio">
          <Loader2 size={24} className="ac-spin" aria-hidden /> Cargando…
        </div>
      ) : estado === 'cerrada' ? (
        <Candado
          onAbierta={(exp) => {
            setExpira(exp)
            setEstado('abierta')
          }}
        />
      ) : (
        <Boveda expira={expira} onCerrada={() => void cerrar(false)} onCerrar={() => void cerrar()} />
      )}
    </Marco>
  )
}

function Marco({
  children,
  onVolver,
  onCerrar,
  expira = 0,
}: {
  children: React.ReactNode
  onVolver: () => void
  onCerrar?: () => void
  expira?: number
}) {
  return (
    <div className="ac-page">
      <div className="ac-bg" aria-hidden />
      <div className="ac-shell">
        <header className="ac-topbar">
          <button type="button" className="ac-back" onClick={onVolver}>
            <ArrowLeft size={16} aria-hidden /> Dashboard
          </button>
          <div className="ac-topbar-der">
            {onCerrar ? <BotonCerrar expira={expira} onCerrar={onCerrar} /> : null}
            <ThemeToggle />
          </div>
        </header>
        <div className="ac-hero">
          <p className="ac-kicker">Seguridad</p>
          <h1 className="ac-title">Accesos Autorizados</h1>
          <p className="ac-lead">Usuarios y contraseñas de equipos, correos y sistemas, guardados de forma segura.</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function BotonCerrar({ expira, onCerrar }: { expira: number; onCerrar: () => void }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])
  const min = Math.max(0, Math.ceil((expira - ahora) / 60000))
  return (
    <button type="button" className="ac-lock-btn" onClick={onCerrar} title="Cerrar la bóveda ahora">
      <Lock size={15} aria-hidden />
      <span>Cerrar</span>
      {expira ? <span className="ac-lock-min">{min} min</span> : null}
    </button>
  )
}

function Candado({ onAbierta }: { onAbierta: (expira: number) => void }) {
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abrir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const r = await api<{ expira: number }>('/api/accesos/sesion', { method: 'POST', body: JSON.stringify({ password }) })
      setPassword('')
      onAbierta(r.expira)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="ac-candado" onSubmit={abrir}>
      <div className="ac-candado-icono" aria-hidden>
        <ShieldCheck size={34} />
      </div>
      <h2>La bóveda está cerrada</h2>
      <p>Por seguridad, escribe <strong>la misma contraseña con la que entras al portal</strong> para ver los accesos.</p>
      <label className="ac-field">
        <span>Tu contraseña del portal</span>
        <div className="ac-input-wrap">
          <input
            type={ver ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          <button type="button" className="ac-input-ico" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'}>
            {ver ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      </label>
      {error ? <p className="ac-error" role="alert">{error}</p> : null}
      <button type="submit" className="ac-btn ac-btn-primario ac-btn-ancho" disabled={!password.trim() || enviando}>
        {enviando ? <Loader2 size={16} className="ac-spin" aria-hidden /> : <KeyRound size={16} aria-hidden />}
        Abrir bóveda
      </button>
      <p className="ac-nota">Se cerrará sola a los 30 minutos o tras 10 minutos sin usarla.</p>
    </form>
  )
}

type Visible = { password: string; hasta: number }

function sinId(m: Record<number, Visible>, id: number): Record<number, Visible> {
  const copia = { ...m }
  delete copia[id]
  return copia
}

function Boveda({ expira, onCerrada, onCerrar }: { expira: number; onCerrada: () => void; onCerrar: () => void }) {
  const [tab, setTab] = useState<'accesos' | 'bitacora'>('accesos')
  const [accesos, setAccesos] = useState<AccesoAutorizado[] | null>(null)
  const [bitacora, setBitacora] = useState<AccesoBitacora[] | null>(null)
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState<string>('')
  const [modal, setModal] = useState<{ abierto: boolean; acceso: AccesoAutorizado | null }>({ abierto: false, acceso: null })
  const [borrar, setBorrar] = useState<AccesoAutorizado | null>(null)
  const [visibles, setVisibles] = useState<Record<number, Visible>>({})
  const [copiado, setCopiado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const busquedaRef = useRef<HTMLInputElement>(null)

  const manejar = useCallback(
    (e: unknown) => {
      if (e instanceof CerradaError) {
        onCerrada()
        return
      }
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Ocurrió un error.' })
    },
    [onCerrada]
  )

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ accesos: AccesoAutorizado[] }>('/api/accesos')
      setAccesos(r.accesos)
    } catch (e) {
      manejar(e)
    }
  }, [manejar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (tab !== 'bitacora') return
    api<{ bitacora: AccesoBitacora[] }>('/api/accesos?bitacora=1')
      .then((r) => setBitacora(r.bitacora))
      .catch(manejar)
  }, [tab, manejar])

  useEffect(() => {
    let ultimo = Date.now()
    const marcar = () => {
      ultimo = Date.now()
    }
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    eventos.forEach((ev) => window.addEventListener(ev, marcar, { passive: true }))
    const t = window.setInterval(() => {
      if (Date.now() - ultimo > INACTIVIDAD_MS) onCerrar()
      else if (expira && Date.now() > expira) onCerrada()
    }, 15000)
    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, marcar))
      window.clearInterval(t)
    }
  }, [expira, onCerrar, onCerrada])

  useEffect(() => {
    const ids = Object.keys(visibles)
    if (!ids.length) return
    const t = window.setInterval(() => {
      setVisibles((prev) => {
        const ahora = Date.now()
        const sig = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.hasta > ahora))
        return Object.keys(sig).length === Object.keys(prev).length ? prev : sig
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [visibles])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 4500)
    return () => window.clearTimeout(t)
  }, [aviso])

  useEffect(() => {
    if (!copiado) return
    const t = window.setTimeout(() => setCopiado(null), 2000)
    return () => window.clearTimeout(t)
  }, [copiado])

  const conteos = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of accesos ?? []) m.set(a.categoria, (m.get(a.categoria) ?? 0) + 1)
    return m
  }, [accesos])

  const filtrados = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean)
    return (accesos ?? []).filter((a) => {
      if (categoria && a.categoria !== categoria) return false
      if (!tokens.length) return true
      const hay = norm(
        [a.plataforma, a.usuario, a.url, a.responsable, a.notas, etiquetaCategoria(a.categoria)].filter(Boolean).join(' ')
      )
      return tokens.every((t) => hay.includes(t))
    })
  }, [accesos, q, categoria])

  const copiarTexto = async (texto: string, clave: string, mensaje: string, limpiar = false) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      setAviso({ tipo: 'ok', texto: mensaje })
      if (limpiar) {
        window.setTimeout(() => {
          navigator.clipboard.readText?.().then((actual) => {
            if (actual === texto) void navigator.clipboard.writeText('')
          }).catch(() => null)
        }, LIMPIAR_PORTAPAPELES_MS)
      }
    } catch {
      setAviso({ tipo: 'error', texto: 'El navegador no permitió copiar. Usa «Ver» y cópiala a mano.' })
    }
  }

  const obtenerPassword = async (a: AccesoAutorizado, accion: 'ver' | 'copiar') => {
    setOcupado(a.id)
    try {
      const r = await api<{ password: string }>('/api/accesos', { method: 'POST', body: JSON.stringify({ accion, id: a.id }) })
      return r.password
    } catch (e) {
      manejar(e)
      return null
    } finally {
      setOcupado(null)
    }
  }

  const alternarVer = async (a: AccesoAutorizado) => {
    if (visibles[a.id]) {
      setVisibles((v) => sinId(v, a.id))
      return
    }
    const password = await obtenerPassword(a, 'ver')
    if (password != null) setVisibles((v) => ({ ...v, [a.id]: { password, hasta: Date.now() + MOSTRAR_MS } }))
  }

  const copiarPassword = async (a: AccesoAutorizado) => {
    const password = visibles[a.id]?.password ?? (await obtenerPassword(a, 'copiar'))
    if (password != null) await copiarTexto(password, `p${a.id}`, 'Contraseña copiada. Se borrará del portapapeles en 30 segundos.', true)
  }

  const guardar = async (body: Record<string, unknown>) => {
    const r = await api<{ acceso: AccesoAutorizado }>('/api/accesos', {
      method: 'POST',
      body: JSON.stringify({ accion: 'guardar', ...body }),
    }).catch((e) => {
      if (e instanceof CerradaError) onCerrada()
      throw e
    })
    setAccesos((prev) => {
      const lista = (prev ?? []).filter((x) => x.id !== r.acceso.id)
      return [...lista, r.acceso].sort((x, y) => x.plataforma.localeCompare(y.plataforma, 'es'))
    })
    setVisibles((v) => sinId(v, r.acceso.id))
    setBitacora(null)
    setAviso({ tipo: 'ok', texto: body.id ? 'Cambios guardados.' : 'Acceso registrado.' })
    setModal({ abierto: false, acceso: null })
  }

  const confirmarBorrar = async () => {
    if (!borrar) return
    setOcupado(borrar.id)
    try {
      await api(`/api/accesos?id=${borrar.id}`, { method: 'DELETE' })
      setAccesos((prev) => (prev ?? []).filter((x) => x.id !== borrar.id))
      setBitacora(null)
      setAviso({ tipo: 'ok', texto: `«${borrar.plataforma}» eliminado.` })
      setBorrar(null)
    } catch (e) {
      manejar(e)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <nav className="ac-tabs" role="tablist" aria-label="Secciones">
        <button type="button" role="tab" aria-selected={tab === 'accesos'} className="ac-tab" data-activo={tab === 'accesos' || undefined} onClick={() => setTab('accesos')}>
          <KeyRound size={16} aria-hidden /> Accesos
          {accesos ? <span className="ac-tab-n">{accesos.length}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'bitacora'} className="ac-tab" data-activo={tab === 'bitacora' || undefined} onClick={() => setTab('bitacora')}>
          <History size={16} aria-hidden /> Movimientos
        </button>
      </nav>

      {aviso ? (
        <div className={`ac-aviso ac-aviso-${aviso.tipo}`} role="status">
          {aviso.tipo === 'ok' ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
          {aviso.texto}
        </div>
      ) : null}

      {tab === 'accesos' ? (
        <section>
          <div className="ac-toolbar">
            <label className="ac-buscar">
              <Search size={18} aria-hidden />
              <input
                ref={busquedaRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar: correo, banco, wifi, nombre de usuario…"
                aria-label="Buscar accesos"
              />
              {q ? (
                <button type="button" className="ac-buscar-x" onClick={() => { setQ(''); busquedaRef.current?.focus() }} aria-label="Limpiar búsqueda">
                  <X size={16} aria-hidden />
                </button>
              ) : null}
            </label>
            <button type="button" className="ac-btn ac-btn-primario" onClick={() => setModal({ abierto: true, acceso: null })}>
              <Plus size={18} aria-hidden /> Nuevo acceso
            </button>
          </div>

          <div className="ac-chips" role="group" aria-label="Filtrar por tipo">
            <button type="button" className="ac-chip" data-activo={!categoria || undefined} onClick={() => setCategoria('')}>
              Todos <span>{accesos?.length ?? 0}</span>
            </button>
            {CATEGORIAS_ACCESO.filter((c) => conteos.get(c.id)).map((c) => (
              <button key={c.id} type="button" className="ac-chip" data-activo={categoria === c.id || undefined}
                onClick={() => setCategoria(categoria === c.id ? '' : c.id)}>
                <IconoCategoria categoria={c.id} size={14} /> {c.corta} <span>{conteos.get(c.id)}</span>
              </button>
            ))}
          </div>

          {!accesos ? (
            <div className="ac-vacio"><Loader2 size={22} className="ac-spin" aria-hidden /> Cargando accesos…</div>
          ) : !filtrados.length ? (
            <div className="ac-vacio">
              <Search size={26} aria-hidden />
              {accesos.length ? (
                <>
                  <p>No hay accesos que coincidan con «{q || etiquetaCategoria(categoria)}».</p>
                  <button type="button" className="ac-btn" onClick={() => { setQ(''); setCategoria('') }}>Ver todos</button>
                </>
              ) : (
                <>
                  <p>Todavía no hay accesos registrados.</p>
                  <button type="button" className="ac-btn ac-btn-primario" onClick={() => setModal({ abierto: true, acceso: null })}>
                    <Plus size={16} aria-hidden /> Registrar el primero
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="ac-grid">
              {filtrados.map((a) => {
                const vis = visibles[a.id]
                return (
                  <li key={a.id} className="ac-card">
                    <div className="ac-card-head">
                      <span className="ac-card-ico" data-cat={a.categoria}><IconoCategoria categoria={a.categoria} size={20} /></span>
                      <div className="ac-min0">
                        <h3 className="ac-card-title"><Resaltar texto={a.plataforma} q={q} /></h3>
                        <p className="ac-card-sub">
                          {etiquetaCategoria(a.categoria)}
                          {a.responsable ? <> · <Resaltar texto={a.responsable} q={q} /></> : null}
                        </p>
                      </div>
                      <div className="ac-card-acciones">
                        <button type="button" className="ac-ico-btn" onClick={() => setModal({ abierto: true, acceso: a })} aria-label={`Editar ${a.plataforma}`} title="Editar">
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button type="button" className="ac-ico-btn ac-ico-peligro" onClick={() => setBorrar(a)} aria-label={`Eliminar ${a.plataforma}`} title="Eliminar">
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </div>

                    <dl className="ac-datos">
                      <div className="ac-dato">
                        <dt>Usuario</dt>
                        <dd>
                          <span className="ac-valor">{a.usuario ? <Resaltar texto={a.usuario} q={q} /> : <em className="ac-muted">Sin usuario</em>}</span>
                          {a.usuario ? (
                            <button type="button" className="ac-mini" onClick={() => void copiarTexto(a.usuario, `u${a.id}`, 'Usuario copiado.')}>
                              {copiado === `u${a.id}` ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} Copiar
                            </button>
                          ) : null}
                        </dd>
                      </div>
                      <div className="ac-dato">
                        <dt>Contraseña</dt>
                        <dd>
                          {a.tiene_password ? (
                            <>
                              <span className="ac-valor ac-pass" data-visible={vis ? true : undefined}>
                                {vis ? vis.password : '••••••••••'}
                              </span>
                              <button type="button" className="ac-mini" onClick={() => void alternarVer(a)} disabled={ocupado === a.id}>
                                {ocupado === a.id ? <Loader2 size={15} className="ac-spin" aria-hidden /> : vis ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                                {vis ? 'Ocultar' : 'Ver'}
                              </button>
                              <button type="button" className="ac-mini" onClick={() => void copiarPassword(a)} disabled={ocupado === a.id}>
                                {copiado === `p${a.id}` ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} Copiar
                              </button>
                            </>
                          ) : (
                            <button type="button" className="ac-pendiente" onClick={() => setModal({ abierto: true, acceso: a })}>
                              Sin contraseña · agregar
                            </button>
                          )}
                        </dd>
                      </div>
                    </dl>

                    {a.url ? (
                      <a className="ac-url" href={/^https?:\/\//i.test(a.url) ? a.url : `https://${a.url}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} aria-hidden /> <Resaltar texto={a.url} q={q} />
                      </a>
                    ) : null}
                    {a.notas ? <p className="ac-notas"><Resaltar texto={a.notas} q={q} /></p> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="ac-bitacora">
          {!bitacora ? (
            <div className="ac-vacio"><Loader2 size={22} className="ac-spin" aria-hidden /> Cargando movimientos…</div>
          ) : !bitacora.length ? (
            <div className="ac-vacio"><History size={24} aria-hidden /><p>Sin movimientos todavía.</p></div>
          ) : (
            <ol className="ac-bit-lista">
              {bitacora.map((b) => (
                <li key={b.id} className="ac-bit-item" data-accion={b.accion}>
                  <time dateTime={b.created_at}>
                    {new Date(b.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                  <span>
                    <strong>{b.usuario_nombre ?? 'Alguien'}</strong> {ETIQUETA_ACCION[b.accion] ?? b.accion}
                    {b.plataforma ? <> <em>«{b.plataforma}»</em></> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {modal.abierto ? (
        <AccesoModal acceso={modal.acceso} onCerrar={() => setModal({ abierto: false, acceso: null })} onGuardar={guardar} />
      ) : null}

      {borrar ? (
        <div className="ac-overlay" role="presentation" onClick={() => setBorrar(null)}>
          <div className="ac-modal ac-modal-chico" role="dialog" aria-modal="true" aria-labelledby="ac-borrar-t" onClick={(e) => e.stopPropagation()}>
            <h2 id="ac-borrar-t">¿Eliminar «{borrar.plataforma}»?</h2>
            <p>Se borrará el usuario y la contraseña guardados. Esta acción no se puede deshacer.</p>
            <div className="ac-modal-pie">
              <button type="button" className="ac-btn" onClick={() => setBorrar(null)}>Cancelar</button>
              <button type="button" className="ac-btn ac-btn-peligro" onClick={() => void confirmarBorrar()} disabled={ocupado === borrar.id}>
                {ocupado === borrar.id ? <Loader2 size={16} className="ac-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />} Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
