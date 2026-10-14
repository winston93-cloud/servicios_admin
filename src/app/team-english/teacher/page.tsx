'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, LogOut } from 'lucide-react'
import { readPortalSessionForFetch } from '@/lib/insforgeDbProxyShared'
import ThemeToggle from '@/components/ThemeToggle'
import type { PortalTeacherData } from '@/lib/teamEnglish/teService'
import { ESTADOS_PLANEACION, bloquesDePlan, etiquetaGrado, lunesDe, textoSemana, type TeCursoSugerido } from '@/lib/teamEnglish/teTypes'
import { teAbrirArchivo } from '../teApi'
import { Campo, Semana, StickerImg, Vacio } from '../components/ui'
import { Doodles, SkinSwitch, skinDe, useTeSkin } from '../components/Skins'
import { PlanMiniSemana } from '../components/PlanLienzo'
import RacGoogleSignIn from '@/app/reportes-conducta/components/RacGoogleSignIn'
import CursoDelDia from './CursoDelDia'
import MisCursos, { borradorDeSugerido, type BorradorCurso } from './MisCursos'
import MuroReconocimientos from './MuroReconocimientos'
import PlanSemana from './PlanSemana'
import '../team-english.css'

const sinSuscripcion = () => () => {}

export default function PortalTeacherPage() {
  const router = useRouter()
  /** Personal (coording, laura, mario) que llegó desde el dashboard en esta pestaña. */
  const hayPersonal = useSyncExternalStore(sinSuscripcion, () => !!readPortalSessionForFetch(), () => false)
  const [data, setData] = useState<PortalTeacherData | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'login' | 'listo'>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [skin, setSkin] = useTeSkin()

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
    <div className="te-page" data-skin={skin}>
      <Doodles skin={skin} cuantos={8} />
      <div className={data ? 'te-shell' : 'te-shell te-shell-angosto'}>
        <header className="te-topbar">
          <span className="te-topbar-izq">
            {hayPersonal || data?.simulado_por ? (
              <button type="button" className="te-back" onClick={() => router.push('/dashboard')}>
                <ArrowLeft size={16} aria-hidden /> Dashboard
              </button>
            ) : null}
            <span className="te-marca"><span aria-hidden>{skinDe(skin).emoji}</span> Team English</span>
          </span>
          <div className="te-topbar-der">
            {data ? (
              <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => void salir()}>
                <LogOut size={14} aria-hidden /> Salir
              </button>
            ) : null}
            <SkinSwitch skin={skin} onCambiar={setSkin} />
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
          <Portal data={data} setData={setData} onOk={setOk} onError={setError} onSalir={() => void salir()} />
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
      <p className="te-lead">Entra con tu mismo usuario y contraseña de boletas para subir tus planeaciones y cursos.</p>
      <Campo etiqueta="Usuario"><input className="te-input" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required /></Campo>
      <Campo etiqueta="Contraseña"><input className="te-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Campo>
      <button type="submit" className="te-btn te-btn-primary te-btn-ancho" disabled={enviando || !usuario || !password}>
        {enviando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '✨'} Entrar
      </button>
      <RacGoogleSignIn authUrl="/api/team-english/teacher/google" onOk={onEntrar} classPrefix="te" notice="Con tu cuenta institucional @winston93.edu.mx." />
    </form>
  )
}

function Portal({ data, setData, onOk, onError, onSalir }: {
  onSalir: () => void
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onOk: (t: string) => void
  onError: (t: string) => void
}) {
  const hoyLunes = lunesDe(data.hoy)
  const [lunes, setLunes] = useState(hoyLunes)
  const [tab, setTab] = useState<'planeaciones' | 'cursos'>('planeaciones')
  const [borradorCurso, setBorradorCurso] = useState<BorradorCurso | null>(null)
  const nombreCorto = data.teacher.apodo || data.teacher.nombre.split(' ')[0]
  const loTome = (s: TeCursoSugerido) => {
    setTab('cursos')
    setBorradorCurso(borradorDeSugerido(s, data.hoy))
  }

  return (
    <>
      {data.simulado_por ? (
        <div className="te-alerta te-sim" role="status">
          <span aria-hidden>👀</span>
          <span className="te-min0">
            Vista previa de <b>{data.simulado_por}</b>: ves el portal como <b>{data.teacher.nombre}</b>. Lo que subas se guarda de verdad a su nombre.
          </span>
          <button type="button" className="te-btn te-btn-sm" onClick={onSalir}>🔁 Cambiar de teacher</button>
        </div>
      ) : null}
      <div className="te-portal-top">
        <section className="te-hero">
          <p className="te-kicker">Primaria · {data.teacher.grupos.join(', ') || 'Teacher'}</p>
          <h1 className="te-title">
            Hi, {nombreCorto}!{' '}
            <span className="te-title-emoji" aria-hidden>
              {data.teacher.sticker_key ? <StickerImg stickerKey={data.teacher.sticker_key} alt="" conSesion={false} /> : data.teacher.emoji}
            </span>
          </h1>
          <p className="te-lead">Sube tu planeación de la semana y los cursos que tomes; tu directora los revisa.</p>
        </section>
        <CursoDelDia sugeridos={data.sugeridos} hoy={data.hoy} onLoTome={loTome} />
      </div>
      <MuroReconocimientos data={data} setData={setData} onError={onError} />

      <div className="te-filtros te-tabs" role="tablist" aria-label="Secciones del portal">
        <button type="button" role="tab" aria-selected={tab === 'planeaciones'} data-activo={tab === 'planeaciones' || undefined} onClick={() => setTab('planeaciones')}>
          📚 Planeaciones
        </button>
        <button type="button" role="tab" aria-selected={tab === 'cursos'} data-activo={tab === 'cursos' || undefined} onClick={() => setTab('cursos')}>
          🏅 Mis cursos <b>{data.cursos.length}</b>
        </button>
      </div>

      {/* Ambas pestañas quedan montadas para no perder un lienzo sin guardar al cambiar. */}
      <div role="tabpanel" hidden={tab !== 'cursos'}>
        <MisCursos data={data} setData={setData} onOk={onOk} onError={onError} borrador={borradorCurso} setBorrador={setBorradorCurso} />
      </div>
      <div role="tabpanel" hidden={tab !== 'planeaciones'}>
        <Planeaciones data={data} setData={setData} onOk={onOk} onError={onError} lunes={lunes} setLunes={setLunes} hoyLunes={hoyLunes} />
      </div>
    </>
  )
}

function Planeaciones({ data, setData, onOk, onError, lunes, setLunes, hoyLunes }: {
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onOk: (t: string) => void
  onError: (t: string) => void
  lunes: string
  setLunes: (l: string) => void
  hoyLunes: string
}) {
  return (
    <>
      <div className="te-toolbar">
        <Semana lunes={lunes} onCambiar={setLunes} hoyLunes={hoyLunes} />
      </div>

      <ul className="te-planes te-planes-lienzo">
        {data.teacher.grados.map((g, i) => {
          const plan = data.planeaciones.find((p) => p.grado === g && p.semana === lunes)
          return (
            <li key={`${g}-${lunes}-${plan?.updated_at ?? 'nueva'}`} style={{ ['--i' as string]: i }}>
              <PlanSemana grado={g} lunes={lunes} data={data} setData={setData} onOk={onOk} onError={onError} />
            </li>
          )
        })}
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
                {bloquesDePlan(p.contenido) ? <PlanMiniSemana contenido={p.contenido!} /> : null}
                {p.comentario ? <small className="te-plan-comentario">✏️ {p.comentario}</small> : null}
              </span>
              {p.archivo_key ? (
                <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(p.archivo_key!, false).catch((e) => onError(e.message))}>📎</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
