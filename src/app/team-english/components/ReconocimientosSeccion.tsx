'use client'

import { useState } from 'react'
import { Loader2, Pencil, Play, Plus } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  EFECTOS_RECONOCIMIENTO,
  EMOJIS_RECONOCIMIENTO,
  PLANTILLAS_RECONOCIMIENTO,
  REACCIONES,
  TEMAS_RECONOCIMIENTO,
  lunesDe,
  textoSemana,
  type EfectoReconocimiento,
  type TemaReconocimiento,
  type TeReconocimiento,
} from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { leerJson, teAccion, validarTamano } from '../teApi'
import Celebracion from './Celebracion'
import { Campo, Hoja, Semana, SelectorArchivo, Vacio } from './ui'

type Borrador = {
  id?: number
  semana: string
  titulo: string
  mensaje: string
  emoji: string
  maestro_ids: number[]
  efectos: EfectoReconocimiento[]
  tema: TemaReconocimiento
  sonido: boolean
  temblor: boolean
  fotoPrevia: boolean
  quitarFoto: boolean
}

/** Reconocimientos y eventos de la semana: las teachers los ven en su portal con efectos durante 5 s. */
export default function ReconocimientosSeccion({ snap, recargar, avisar }: SeccionProps) {
  const hoyLunes = lunesDe(snap.hoy)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [previa, setPrevia] = useState<TeReconocimiento | null>(null)
  const activas = snap.teachers.filter((t) => t.activo)
  const teacherDe = new Map(snap.teachers.map((t) => [t.maestro_id, t]))

  const nuevo = (): Borrador => ({
    semana: hoyLunes, titulo: '', mensaje: '', emoji: '🏆', maestro_ids: [], efectos: ['confeti', 'fuegos'], tema: 'arcoiris',
    sonido: true, temblor: true, fotoPrevia: false, quitarFoto: false,
  })
  const editar = (r: TeReconocimiento): Borrador => ({
    id: r.id, semana: r.semana, titulo: r.titulo, mensaje: r.mensaje, emoji: r.emoji, maestro_ids: r.homenajeadas.map((h) => h.maestro_id),
    efectos: r.efectos, tema: r.tema, sonido: r.sonido, temblor: r.temblor, fotoPrevia: !!r.foto_key, quitarFoto: false,
  })
  const abrir = (b: Borrador) => {
    setFoto(null)
    setBorrador(b)
  }

  /** Arma el reconocimiento tal como lo verán las teachers para la vista previa. */
  const comoSeVera = (b: Borrador): TeReconocimiento => ({
    id: b.id ?? -Date.now(),
    semana: b.semana,
    titulo: b.titulo.trim() || '¡Felicidades!',
    mensaje: b.mensaje,
    emoji: b.emoji,
    efectos: b.efectos.length ? b.efectos : ['confeti'],
    tema: b.tema,
    sonido: b.sonido,
    temblor: b.temblor,
    foto_key: b.quitarFoto ? null : (snap.reconocimientos.find((r) => r.id === b.id)?.foto_key ?? null),
    creado_por: snap.reconocimientos.find((r) => r.id === b.id)?.creado_por ?? 'Tu directora',
    created_at: '',
    homenajeadas: b.maestro_ids.flatMap((id) => {
      const t = teacherDe.get(id)
      return t ? [{ maestro_id: id, nombre: t.nombre, emoji: t.emoji }] : []
    }),
    vistos: [],
  })

  const guardar = async () => {
    if (!borrador) return
    setGuardando(true)
    try {
      validarTamano(foto)
      const b = borrador
      const form = new FormData()
      form.set('nivel', String(snap.nivel))
      if (b.id) form.set('id', String(b.id))
      form.set('semana', b.semana)
      form.set('titulo', b.titulo)
      form.set('mensaje', b.mensaje)
      form.set('emoji', b.emoji)
      form.set('maestro_ids', JSON.stringify(b.maestro_ids))
      form.set('efectos', JSON.stringify(b.efectos))
      form.set('tema', b.tema)
      form.set('sonido', b.sonido ? '1' : '0')
      form.set('temblor', b.temblor ? '1' : '0')
      if (b.quitarFoto) form.set('quitar_foto', '1')
      if (foto) form.set('foto', foto)
      const res = await fetch('/api/team-english/reconocimiento', { method: 'POST', headers: portalSessionFetchHeaders(), body: form })
      await leerJson(res)
      await recargar()
      setBorrador(null)
      avisar(b.id ? 'Reconocimiento actualizado ✨' : '¡Publicado! Las teachers lo verán al entrar a su portal 🎉')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (r: TeReconocimiento) => {
    if (!window.confirm(`¿Borrar «${r.titulo}»?`)) return
    try {
      await teAccion(snap.nivel, 'eliminar_reconocimiento', { id: r.id })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const semanas = [...new Set(snap.reconocimientos.map((r) => r.semana))]
  const deEstaSemana = snap.reconocimientos.filter((r) => r.semana === hoyLunes).length

  return (
    <>
      <div className="te-toolbar">
        <p className="te-nota te-min0">
          Lo que publiques aparece a tus teachers al entrar a su portal: 5 segundos de efectos, sonido y temblor. {deEstaSemana ? `Esta semana llevas ${deEstaSemana}. ` : ''}¡Reconocer motiva! 💖
        </p>
        <button type="button" className="te-btn te-btn-primary" onClick={() => abrir(nuevo())}>
          <Plus size={16} aria-hidden /> Nuevo reconocimiento
        </button>
      </div>

      <div className="te-plantillas" role="group" aria-label="Plantillas rápidas">
        <span className="te-plantillas-titulo">⚡ Rápido:</span>
        {PLANTILLAS_RECONOCIMIENTO.map((p) => (
          <button key={p.nombre} type="button" className="te-chip te-chip-btn" onClick={() => abrir({ ...nuevo(), emoji: p.emoji, titulo: p.titulo, mensaje: p.mensaje, efectos: p.efectos, tema: p.tema })}>
            {p.emoji} {p.nombre}
          </button>
        ))}
      </div>

      {!snap.reconocimientos.length ? (
        <Vacio emoji="🎉" titulo="Aún no hay reconocimientos">
          Felicita a una teacher por su asamblea, su cumpleaños o su planeación. Elige una plantilla de arriba y en un minuto queda.
        </Vacio>
      ) : (
        semanas.map((sem) => (
          <section key={sem} className="te-rec-semana">
            <h2 className="te-subtitulo">{sem === hoyLunes ? '✨ Esta semana' : `🗓️ Semana del ${textoSemana(sem)}`}</h2>
            <ul className="te-rec-lista">
              {snap.reconocimientos.filter((r) => r.semana === sem).map((r, i) => {
                const vieron = r.vistos.length
                const conteo = REACCIONES.map((x) => ({ ...x, n: r.vistos.filter((v) => v.reaccion === x.clave).length })).filter((x) => x.n)
                const faltan = activas.filter((t) => !r.vistos.some((v) => v.maestro_id === t.maestro_id))
                return (
                  <li key={r.id} className="te-rec" data-tema={r.tema} style={{ ['--i' as string]: i }}>
                    <span className="te-rec-emoji" aria-hidden>{r.emoji}</span>
                    <div className="te-min0">
                      <strong className="te-rec-titulo">{r.titulo}</strong>
                      <small>
                        {r.homenajeadas.length ? r.homenajeadas.map((h) => `${h.emoji} ${h.nombre.split(' ')[0]}`).join(' · ') : '🌈 Todo el team'}
                      </small>
                      <small className="te-rec-efectos">
                        {r.efectos.map((e) => EFECTOS_RECONOCIMIENTO.find((x) => x.clave === e)?.emoji).join(' ')}
                        {r.sonido ? ' · 🔊' : ''}{r.temblor ? ' · 📳' : ''}{r.foto_key ? ' · 📷' : ''}
                      </small>
                      <small title={faltan.length ? `Faltan: ${faltan.map((t) => t.nombre).join(', ')}` : 'Todas lo vieron'}>
                        👀 Lo vieron {vieron}/{activas.length}
                        {conteo.length ? ` · ${conteo.map((c) => `${c.emoji} ${c.n}`).join('  ')}` : ''}
                      </small>
                    </div>
                    <div className="te-fila-botones te-rec-acciones">
                      <button type="button" className="te-btn te-btn-sm" onClick={() => setPrevia(r)}><Play size={14} aria-hidden /> Ver</button>
                      <button type="button" className="te-icon-btn" aria-label={`Editar ${r.titulo}`} onClick={() => abrir(editar(r))}><Pencil size={16} aria-hidden /></button>
                      <button type="button" className="te-btn te-btn-ghost te-btn-sm te-peligro" aria-label={`Borrar ${r.titulo}`} onClick={() => void eliminar(r)}>🗑️</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      {borrador ? (
        <Hoja abierta ancho titulo={borrador.id ? 'Editar reconocimiento' : 'Nuevo reconocimiento'} emoji="🎉" onCerrar={() => setBorrador(null)}
          pie={
            <>
              <button type="button" className="te-btn te-btn-ghost" onClick={() => setBorrador(null)}>Cancelar</button>
              <button type="button" className="te-btn" onClick={() => setPrevia(comoSeVera(borrador))}><Play size={16} aria-hidden /> Probar efectos</button>
              <button type="button" className="te-btn te-btn-primary" disabled={guardando || !borrador.titulo.trim() || !borrador.efectos.length} onClick={() => void guardar()}>
                {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '🎉'} {borrador.id ? 'Guardar' : 'Publicar'}
              </button>
            </>
          }>
          <FormReconocimiento b={borrador} set={setBorrador} hoyLunes={hoyLunes} activas={activas} foto={foto} setFoto={setFoto} />
        </Hoja>
      ) : null}

      {previa ? <Celebracion rec={previa} conSesion etiqueta="👀 Vista previa · así lo verán tus teachers" onCerrar={() => setPrevia(null)} /> : null}
    </>
  )
}

function FormReconocimiento({ b, set, hoyLunes, activas, foto, setFoto }: {
  b: Borrador
  set: (b: Borrador) => void
  hoyLunes: string
  activas: SeccionProps['snap']['teachers']
  foto: File | null
  setFoto: (f: File | null) => void
}) {
  const alternar = <T,>(lista: T[], x: T) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x])
  return (
    <div className="te-form">
      <div className="te-campo" data-completo>
        <span className="te-campo-label">Semana</span>
        <Semana lunes={b.semana} onCambiar={(l) => set({ ...b, semana: l })} hoyLunes={hoyLunes} />
      </div>

      <div className="te-campo" data-completo role="group" aria-label="¿Para quién?">
        <span className="te-campo-label">¿Para quién? <small>(si no eliges, es para todo el team)</small></span>
        <div className="te-rec-chips">
          <button type="button" className="te-rec-chip" aria-pressed={!b.maestro_ids.length} onClick={() => set({ ...b, maestro_ids: [] })}>🌈 Todo el team</button>
          {activas.map((t) => (
            <button key={t.maestro_id} type="button" className="te-rec-chip" aria-pressed={b.maestro_ids.includes(t.maestro_id)}
              onClick={() => set({ ...b, maestro_ids: alternar(b.maestro_ids, t.maestro_id) })}>
              {t.emoji} {t.nombre.split(' ').slice(0, 2).join(' ')}{t.grupos.length ? ` · ${t.grupos.join(', ')}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="te-campo" data-completo role="group" aria-label="Emoji">
        <span className="te-campo-label">Emoji</span>
        <div className="te-rec-chips">
          {EMOJIS_RECONOCIMIENTO.map((e) => (
            <button key={e} type="button" className="te-rec-chip te-rec-chip-emoji" aria-pressed={b.emoji === e} aria-label={`Emoji ${e}`} onClick={() => set({ ...b, emoji: e })}>{e}</button>
          ))}
        </div>
      </div>

      <Campo etiqueta="Título" completo>
        <input className="te-input" value={b.titulo} maxLength={120} placeholder="¡Asamblea padrísima!" onChange={(e) => set({ ...b, titulo: e.target.value })} />
      </Campo>
      <Campo etiqueta="Mensaje" completo>
        <textarea className="te-input" rows={3} value={b.mensaje} maxLength={600}
          placeholder="Teacher María, esta semana tu asamblea estuvo padrísima. ¡Felicidades!" onChange={(e) => set({ ...b, mensaje: e.target.value })} />
      </Campo>

      <div className="te-campo" data-completo role="group" aria-label="Efectos">
        <span className="te-campo-label">Efectos</span>
        <div className="te-rec-chips">
          {EFECTOS_RECONOCIMIENTO.map((e) => (
            <button key={e.clave} type="button" className="te-rec-chip te-rec-chip-efecto" aria-pressed={b.efectos.includes(e.clave)}
              onClick={() => set({ ...b, efectos: alternar(b.efectos, e.clave) })}>
              <span aria-hidden>{e.emoji}</span> {e.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="te-campo" data-completo role="group" aria-label="Colores">
        <span className="te-campo-label">Colores</span>
        <div className="te-rec-temas">
          {TEMAS_RECONOCIMIENTO.map((t) => (
            <button key={t.clave} type="button" className="te-rec-tema" data-tema={t.clave} aria-pressed={b.tema === t.clave} onClick={() => set({ ...b, tema: t.clave })}>
              <span aria-hidden>{t.emoji}</span> {t.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="te-campo" data-completo role="group" aria-label="Sonido y temblor">
        <span className="te-campo-label">Extras</span>
        <div className="te-rec-chips">
          <button type="button" className="te-rec-chip" aria-pressed={b.sonido} onClick={() => set({ ...b, sonido: !b.sonido })}>🔊 Sonido</button>
          <button type="button" className="te-rec-chip" aria-pressed={b.temblor} onClick={() => set({ ...b, temblor: !b.temblor })}>📳 Que tiemble</button>
        </div>
      </div>

      <div className="te-campo" data-completo>
        <SelectorArchivo etiqueta={b.fotoPrevia && !b.quitarFoto ? 'Cambiar foto (opcional)' : 'Foto del evento (opcional)'} archivo={foto} onArchivo={setFoto} aceptar="image/jpeg,image/png,image/webp" />
        {b.fotoPrevia && !foto ? (
          <label className="te-check">
            <input type="checkbox" checked={b.quitarFoto} onChange={(e) => set({ ...b, quitarFoto: e.target.checked })} /> Quitar la foto actual
          </label>
        ) : null}
      </div>
    </div>
  )
}
