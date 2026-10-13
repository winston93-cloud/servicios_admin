'use client'

import { useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import type { PortalTeacherData } from '@/lib/teamEnglish/teService'
import {
  ESTADOS_PLANEACION,
  TE_MAX_ARCHIVO_MB,
  bloqueVacio,
  bloquesDePlan,
  DIAS_PLAN,
  etiquetaGrado,
  normalizarPlan,
  planVacio,
  textoSemana,
  type PlanContenido,
} from '@/lib/teamEnglish/teTypes'
import { leerJson, teAbrirArchivo, validarTamano } from '../teApi'
import { ACEPTAR_DOCS, Campo, SelectorArchivo } from '../components/ui'
import { PlanLienzoEditor, PlanLienzoVista } from '../components/PlanLienzo'

type Props = {
  grado: number
  lunes: string
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onOk: (t: string) => void
  onError: (t: string) => void
}

function planSeguro(c: unknown): PlanContenido {
  try {
    return c ? normalizarPlan(c) : planVacio()
  } catch {
    return planVacio()
  }
}

export default function PlanSemana({ grado, lunes, data, setData, onOk, onError }: Props) {
  const plan = data.planeaciones.find((p) => p.grado === grado && p.semana === lunes) ?? null
  const anterior = data.planeaciones
    .filter((p) => p.grado === grado && p.semana < lunes && bloquesDePlan(p.contenido) > 0)
    .sort((a, b) => b.semana.localeCompare(a.semana))[0]

  const [lienzo, setLienzo] = useState<PlanContenido>(() => planSeguro(plan?.contenido))
  const [notas, setNotas] = useState(plan?.notas ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [editando, setEditando] = useState(() => !plan || plan.estado === 'borrador' || plan.estado === 'cambios')
  const [enviando, setEnviando] = useState<'borrador' | 'enviar' | null>(null)
  const [sucio, setSucio] = useState(false)
  const bloqueada = plan?.estado === 'aprobada'
  const bloques = bloquesDePlan(lienzo)

  useEffect(() => {
    if (!sucio) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sucio])

  const cambiar = (v: PlanContenido) => {
    setLienzo(v)
    setSucio(true)
  }

  const usarAnterior = () => {
    if (!anterior?.contenido) return
    const base = planSeguro(anterior.contenido)
    const nuevo = planVacio()
    for (const d of DIAS_PLAN) nuevo.dias[d.clave] = base.dias[d.clave].map((b) => bloqueVacio(b.skill, b.materiales))
    cambiar({ ...nuevo, unidad: lienzo.unidad, objetivo: lienzo.objetivo })
  }

  const guardar = async (enviar: boolean) => {
    setEnviando(enviar ? 'enviar' : 'borrador')
    try {
      validarTamano(archivo)
      const form = new FormData()
      form.set('grado', String(grado))
      form.set('semana', lunes)
      form.set('titulo', lienzo.unidad || plan?.titulo || '')
      form.set('notas', notas)
      form.set('contenido', JSON.stringify(lienzo))
      form.set('enviar', enviar ? '1' : '0')
      if (archivo) form.set('archivo', archivo)
      const res = await fetch('/api/team-english/teacher', { method: 'POST', body: form })
      const nuevo = (await leerJson(res)) as unknown as PortalTeacherData
      setSucio(false)
      setData(nuevo)
      onOk(enviar ? '¡Planeación enviada! Tu directora la revisará. 💌' : 'Guardada ✨ Puedes seguir construyéndola cuando quieras.')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEnviando(null)
    }
  }

  const estado = plan ? ESTADOS_PLANEACION[plan.estado] : null
  return (
    <article className="te-plan te-plan-lienzo" data-estado={plan?.estado ?? 'falta'}>
      <header className="te-plan-head">
        <span className="te-grado-sticker" aria-hidden>{etiquetaGrado(data.nivel, grado)}</span>
        <div className="te-min0">
          <strong>Grado {etiquetaGrado(data.nivel, grado)} · {data.teacher.grupos.filter((g) => Number(g[0]) === grado).join(', ') || 'mis grupos'}</strong>
          <small>Semana del {textoSemana(lunes)}</small>
        </div>
        <span className="te-sello">{estado ? `${estado.emoji} ${estado.etiqueta}` : '📭 Sin empezar'}</span>
      </header>

      {plan?.comentario ? <p className="te-plan-comentario">✏️ Tu directora: {plan.comentario}</p> : null}

      {!editando || bloqueada ? (
        <>
          {bloquesDePlan(plan?.contenido) ? <PlanLienzoVista contenido={planSeguro(plan?.contenido)} lunes={lunes} /> : null}
          <div className="te-fila-botones">
            {plan?.archivo_key ? (
              <button type="button" className="te-btn te-btn-sm" onClick={() => teAbrirArchivo(plan.archivo_key!, false).catch((e) => onError(e.message))}>📎 {plan.archivo_nombre ?? 'Archivo'}</button>
            ) : null}
            {bloqueada ? (
              <span className="te-quien">Aprobada ✨ ¡a aplicarla!</span>
            ) : (
              <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => setEditando(true)}>✏️ Editar planeación</button>
            )}
          </div>
        </>
      ) : (
        <>
          {!bloques && anterior ? (
            <p className="te-alerta te-alerta-suave">
              <span aria-hidden>📋</span> ¿Repites el esquema de la semana del {textoSemana(anterior.semana)}?
              <button type="button" className="te-btn te-btn-sm" onClick={usarAnterior}>Usar sus materias</button>
            </p>
          ) : null}

          <PlanLienzoEditor valor={lienzo} onCambiar={cambiar} lunes={lunes} />

          <details className="te-plan-extra">
            <summary>💬 Notas para tu directora o adjuntar archivo (opcional)</summary>
            <div className="te-form">
              <Campo etiqueta="Notas (opcional)" completo>
                <textarea className="te-input" rows={2} value={notas} maxLength={3000} onChange={(e) => { setNotas(e.target.value); setSucio(true) }} />
              </Campo>
              <div className="te-campo" data-completo>
                <SelectorArchivo etiqueta={plan?.archivo_nombre ? `Reemplazar archivo · actual: ${plan.archivo_nombre}` : 'Adjuntar archivo extra (worksheet, presentación…)'}
                  archivo={archivo} onArchivo={(f) => { setArchivo(f); setSucio(true) }} aceptar={ACEPTAR_DOCS} />
                <span className="te-campo-ayuda">PDF, Word, PowerPoint, Excel o imagen · máximo {TE_MAX_ARCHIVO_MB} MB.</span>
              </div>
            </div>
          </details>

          <div className="te-plan-barra">
            <small className="te-plan-barra-info">
              {sucio ? '● Cambios sin guardar' : bloques ? `${bloques} clase${bloques === 1 ? '' : 's'} en la semana` : 'Empieza eligiendo las materias de cada día'}
            </small>
            {plan && plan.estado !== 'borrador' && plan.estado !== 'cambios' ? (
              <button type="button" className="te-btn te-btn-ghost" onClick={() => { setEditando(false); setLienzo(planSeguro(plan.contenido)); setSucio(false) }}>Cancelar</button>
            ) : null}
            <button type="button" className="te-btn" disabled={!!enviando} onClick={() => void guardar(false)}>
              {enviando === 'borrador' ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} Guardar
            </button>
            <button type="button" className="te-btn te-btn-primary" disabled={!!enviando || (!bloques && !archivo && !plan?.archivo_key)} onClick={() => void guardar(true)}>
              {enviando === 'enviar' ? <Loader2 size={16} className="te-spin" aria-hidden /> : <Send size={16} aria-hidden />} Enviar a revisión
            </button>
          </div>
        </>
      )}
    </article>
  )
}
