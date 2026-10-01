'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut, Upload } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import type { PortalTeacherData } from '@/lib/teamEnglish/teService'
import { ESTADOS_PLANEACION, MODALIDADES, etiquetaGrado, fechaCorta, lunesDe, textoSemana } from '@/lib/teamEnglish/teTypes'
import { teAbrirArchivo } from '../teApi'
import { ACEPTAR_DOCS, Campo, Semana, SelectorArchivo, Vacio } from '../components/ui'
import '../team-english.css'

export default function PortalTeacherPage() {
  const [data, setData] = useState<PortalTeacherData | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'login' | 'listo'>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/team-english/teacher', { cache: 'no-store' })
      const json = await res.json()
      if (res.status === 401) {
        setEstado('login')
        return
      }
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar.')
      setData(json as PortalTeacherData)
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setEstado('login')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!ok) return
    const t = window.setTimeout(() => setOk(null), 3500)
    return () => window.clearTimeout(t)
  }, [ok])

  const salir = async () => {
    await fetch('/api/team-english/teacher/login', { method: 'DELETE' })
    setData(null)
    setEstado('login')
  }

  return (
    <div className="te-page">
      <div className="te-doodles" aria-hidden>
        {['⭐', '🌸', '☁️', '💖', '✨', '🌈', '🍓', '⭐'].map((e, i) => <span key={i} style={{ ['--i' as string]: i }}>{e}</span>)}
      </div>
      <div className="te-shell te-shell-angosto">
        <header className="te-topbar">
          <span className="te-marca"><span aria-hidden>🌈</span> Team English</span>
          <div className="te-topbar-der">
            {data ? (
              <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => void salir()}>
                <LogOut size={14} aria-hidden /> Salir
              </button>
            ) : null}
            <ThemeToggle />
          </div>
        </header>

        <div className="te-toasts" aria-live="polite">
          {error ? <p className="te-toast" data-tipo="error" role="alert"><span aria-hidden>🙈</span> {error}<button type="button" onClick={() => setError(null)} aria-label="Cerrar">×</button></p> : null}
          {ok ? <p className="te-toast" data-tipo="ok" role="status"><span aria-hidden>🎉</span> {ok}</p> : null}
        </div>

        {estado === 'cargando' ? (
          <p className="te-cargando"><Loader2 size={20} className="te-spin" aria-hidden /> Cargando…</p>
        ) : estado === 'login' || !data ? (
          <Login onEntrar={() => { setError(null); void cargar() }} onError={setError} />
        ) : (
          <Portal data={data} setData={setData} onOk={setOk} onError={setError} />
        )}
      </div>
    </div>
  )
}

function Login({ onEntrar, onError }: { onEntrar: () => void; onError: (e: string) => void }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    try {
      const res = await fetch('/api/team-english/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo entrar.')
      onEntrar()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="te-login" onSubmit={(e) => void entrar(e)}>
      <span className="te-login-emoji" aria-hidden>👩‍🏫</span>
      <h1 className="te-title">Hi, teacher!</h1>
      <p className="te-lead">Entra con tu mismo usuario y contraseña de boletas para subir tus planeaciones.</p>
      <Campo etiqueta="Usuario"><input className="te-input" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required /></Campo>
      <Campo etiqueta="Contraseña"><input className="te-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Campo>
      <button type="submit" className="te-btn te-btn-primary te-btn-ancho" disabled={enviando || !usuario || !password}>
        {enviando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '✨'} Entrar
      </button>
    </form>
  )
}

function Portal({ data, setData, onOk, onError }: {
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onOk: (t: string) => void
  onError: (t: string) => void
}) {
  const hoyLunes = lunesDe(data.hoy)
  const [lunes, setLunes] = useState(hoyLunes)
  const proximas = data.capacitaciones.filter((c) => c.estado === 'programada' && (c.fecha_fin ?? c.fecha_inicio) >= data.hoy)
  const nombreCorto = data.teacher.nombre.split(' ')[0]

  return (
    <>
      <section className="te-hero">
        <p className="te-kicker">Primaria · {data.teacher.grupos.join(', ') || 'Teacher'}</p>
        <h1 className="te-title">Hi, {nombreCorto}! <span className="te-title-emoji" aria-hidden>{data.teacher.emoji}</span></h1>
        <p className="te-lead">Sube tu planeación de la semana; tu directora la revisa antes de aplicarla.</p>
      </section>

      <div className="te-toolbar">
        <Semana lunes={lunes} onCambiar={setLunes} hoyLunes={hoyLunes} />
      </div>

      <ul className="te-planes">
        {data.teacher.grados.map((g, i) => (
          <li key={g} style={{ ['--i' as string]: i }}>
            <PlanGrado grado={g} lunes={lunes} data={data} setData={setData} onOk={onOk} onError={onError} />
          </li>
        ))}
      </ul>

      <h2 className="te-subtitulo">📜 Mis planeaciones recientes</h2>
      {!data.planeaciones.length ? (
        <Vacio emoji="📚" titulo="Aún no has subido planeaciones" />
      ) : (
        <ul className="te-historial">
          {data.planeaciones.map((p) => (
            <li key={p.id} data-estado={p.estado}>
              <span className="te-sello">{ESTADOS_PLANEACION[p.estado].emoji} {ESTADOS_PLANEACION[p.estado].etiqueta}</span>
              <span className="te-min0">
                <b>{etiquetaGrado(data.nivel, p.grado)} · {textoSemana(p.semana)}</b>
                {p.titulo ? <small>{p.titulo}</small> : null}
                {p.comentario ? <small className="te-plan-comentario">✏️ {p.comentario}</small> : null}
              </span>
              {p.archivo_key ? (
                <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(p.archivo_key!, false).catch((e) => onError(e.message))}>📎</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h2 className="te-subtitulo">🎓 Mis capacitaciones</h2>
      {!data.capacitaciones.length ? (
        <Vacio emoji="🎓" titulo="Sin capacitaciones registradas" />
      ) : (
        <ul className="te-historial">
          {data.capacitaciones.map((c) => {
            const p = c.participantes[0]
            return (
              <li key={c.id}>
                <span className="te-sello">{proximas.includes(c) ? '🗓️ Próxima' : c.estado === 'realizada' ? '🎉 Realizada' : c.estado === 'cancelada' ? '🚫 Cancelada' : '🗓️ Programada'}</span>
                <span className="te-min0">
                  <b>{c.titulo}</b>
                  <small>{fechaCorta(c.fecha_inicio)} · {c.tipo === 'interna' ? 'Interna' : 'Externa'} · {MODALIDADES[c.modalidad]}{c.horas ? ` · ${c.horas} h` : ''}{c.lugar ? ` · 📍 ${c.lugar}` : ''}</small>
                </span>
                {p?.constancia_key ? (
                  <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(p.constancia_key!, false).catch((e) => onError(e.message))}>🏅</button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function PlanGrado({ grado, lunes, data, setData, onOk, onError }: {
  grado: number
  lunes: string
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onOk: (t: string) => void
  onError: (t: string) => void
}) {
  const plan = data.planeaciones.find((p) => p.grado === grado && p.semana === lunes) ?? null
  const [titulo, setTitulo] = useState('')
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [editando, setEditando] = useState(false)
  const bloqueada = plan?.estado === 'aprobada'
  const mostrarForm = !plan || editando

  useEffect(() => {
    setEditando(false)
    setArchivo(null)
    setTitulo('')
    setNotas('')
  }, [lunes])

  const enviar = async () => {
    setEnviando(true)
    try {
      const form = new FormData()
      form.set('grado', String(grado))
      form.set('semana', lunes)
      form.set('titulo', titulo || plan?.titulo || '')
      form.set('notas', notas || plan?.notas || '')
      if (archivo) form.set('archivo', archivo)
      const res = await fetch('/api/team-english/teacher', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo subir.')
      setData(json as PortalTeacherData)
      setEditando(false)
      setArchivo(null)
      onOk('¡Planeación enviada! Tu directora la revisará. 💌')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEnviando(false)
    }
  }

  const estado = plan ? ESTADOS_PLANEACION[plan.estado] : null
  return (
    <article className="te-plan" data-estado={plan?.estado ?? 'falta'}>
      <header className="te-plan-head">
        <span className="te-grado-sticker" aria-hidden>{etiquetaGrado(data.nivel, grado)}</span>
        <div className="te-min0">
          <strong>Grado {etiquetaGrado(data.nivel, grado)}</strong>
          <small>{textoSemana(lunes)}</small>
        </div>
        <span className="te-sello">{estado ? `${estado.emoji} ${estado.etiqueta}` : '📭 Sin enviar'}</span>
      </header>
      {plan?.comentario ? <p className="te-plan-comentario">✏️ Tu directora: {plan.comentario}</p> : null}
      {plan && !editando ? (
        <div className="te-fila-botones">
          {plan.archivo_key ? (
            <button type="button" className="te-btn te-btn-sm" onClick={() => teAbrirArchivo(plan.archivo_key!, false).catch((e) => onError(e.message))}>📎 {plan.archivo_nombre ?? 'Ver archivo'}</button>
          ) : null}
          {!bloqueada ? (
            <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => setEditando(true)}>🔁 Subir nueva versión</button>
          ) : (
            <span className="te-quien">Aprobada ✨ ¡a aplicarla!</span>
          )}
        </div>
      ) : null}
      {mostrarForm && !bloqueada ? (
        <div className="te-form">
          <Campo etiqueta="Título (opcional)" completo><input className="te-input" value={titulo} maxLength={200} placeholder={plan?.titulo || 'Unit 3 · Animals'} onChange={(e) => setTitulo(e.target.value)} /></Campo>
          <Campo etiqueta="Notas para tu directora (opcional)" completo><textarea className="te-input" rows={2} value={notas} placeholder={plan?.notas || ''} onChange={(e) => setNotas(e.target.value)} /></Campo>
          <div className="te-campo" data-completo>
            <SelectorArchivo etiqueta="Elige el archivo de tu planeación" archivo={archivo} onArchivo={setArchivo} aceptar={ACEPTAR_DOCS} />
            <span className="te-campo-ayuda">PDF, Word, PowerPoint, Excel o imagen · máximo 15 MB.</span>
          </div>
          <div className="te-fila-botones te-fila-fin" data-completo>
            {editando ? <button type="button" className="te-btn te-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button> : null}
            <button type="button" className="te-btn te-btn-primary" disabled={enviando || !archivo} onClick={() => void enviar()}>
              {enviando ? <Loader2 size={16} className="te-spin" aria-hidden /> : <Upload size={16} aria-hidden />} Enviar planeación
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
