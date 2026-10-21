'use client'

import ClassroomBarra from '@/app/boletas-captura/ClassroomBarra'
import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import type { BoletaEntrega } from '@/lib/boletasEntrega'
import type { ClassroomCelda } from '@/lib/boletasPrimariaEnClassroom'
import {
  COMPRENSION_ESCALA,
  COMPRENSION_MESES,
  COMPRENSION_PREGUNTAS,
  CONDUCTA_ESCALA,
  letraComprension,
  letraConducta,
  normalizarCalifSec,
  normalizarComprension,
  normalizarConducta,
  normalizarFaltas,
  promedioMateriaBoleta,
} from '@/lib/boletasSecundariaCatalog'
import type { SecFilaComprension, SecFilaHoja, SecMateria } from '@/lib/boletasSecundariaService'
import { CheckCircle2, Lock, Send, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import SecGrid, { type SecGridCambio, type SecGridCol, type SecGridControl, type SecGridFila } from './SecGrid'

type HojaResp = {
  materia: SecMateria
  grado: number
  grupo: string
  trimestre: number
  ciclo: { valor: number; etiqueta: string }
  filas: SecFilaHoja[]
  entrega: BoletaEntrega | null
  publicada: boolean
  editable: boolean
  /** Trimestre abierto a captura de maestros (0 = cerrada); solo viene en el portal. */
  abierto?: number
  /** Lo que dio Classroom por alumno en este trimestre. */
  classroom?: Record<number, ClassroomCelda>
}

const NOTA_CLASSROOM =
  'La calificación cambia sola cuando cambia en Classroom (÷ 10, truncada a un decimal, mínimo 5; solo tareas calificadas y devueltas dentro de las fechas del trimestre). Si la ajustas aquí, se queda hasta que vuelva a cambiar en Classroom. Faltas y conducta se capturan aquí.'

function mismoValor(a: string, b: string): boolean {
  return a !== '' && b !== '' && Number(a) === Number(b)
}

export type SecClaseControl = {
  /** Guarda lo pendiente; si algo no se pudo guardar pregunta antes de salir. */
  puedeSalir: () => Promise<boolean>
}

type Props = {
  modo: 'maestro' | 'direccion'
  /** Endpoint de la hoja (GET/PUT y, para maestros, POST enviar). */
  url: string
  /** Parámetros extra que viajan en cada llamada (p. ej. `{ ciclo }` en dirección). */
  extra?: Record<string, string | number>
  materiaId: number
  materia: string
  grupo: string
  etiqueta: string
  comprension: boolean
  trimestre: number
  onTrimestre: (t: number) => void
  /** Otros grupos de la misma materia a los que se puede brincar. */
  hermanas: { grupo: string; etiqueta: string }[]
  onGrupo: (grupo: string) => void
  controlRef?: Ref<SecClaseControl | null>
  /** Tras enviar a dirección (para refrescar el avance). */
  onEnviado?: () => void
}

const COLS_CALIF = (trimestre: number): SecGridCol[] => [
  {
    key: 'cal',
    titulo: `Calif. T${trimestre}`,
    ayuda: 'Calificación de 5 a 10 con un decimal (p. ej. 8.7), o «-» (también puedes escribir 0) si no aplica.',
    normalizar: (raw) => normalizarCalifSec(raw),
    numerico: true,
    decimal: true,
    maxLength: 4,
  },
  {
    key: 'faltas',
    titulo: 'Faltas',
    ayuda: 'Número de faltas del trimestre (0 a 99).',
    normalizar: (raw) => normalizarFaltas(raw),
    numerico: true,
    maxLength: 2,
  },
  {
    key: 'conducta',
    titulo: 'Conducta',
    ayuda: 'Conducta: E, MB, B, R, S o I (o su número del 1 al 6).',
    normalizar: (raw) => {
      const c = normalizarConducta(raw)
      return c == null ? null : letraConducta(c)
    },
    maxLength: 2,
  },
]

const COLS_COMPRENSION: SecGridCol[] = COMPRENSION_PREGUNTAS.map((p) => ({
  key: p.id,
  titulo: p.corto,
  ayuda: `${p.texto}. Usa S, CS, EO o RA.`,
  normalizar: (raw: string) => {
    const c = normalizarComprension(raw)
    return c == null ? null : letraComprension(c)
  },
  maxLength: 2,
}))

function fecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' })
}

function qs(p: Record<string, string | number>): string {
  return new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString()
}

function Estado({ hoja, modo }: { hoja: HojaResp; modo: Props['modo'] }) {
  const { entrega, publicada, trimestre } = hoja
  if (publicada) {
    return (
      <div className="bc-banner is-publicada" role="status">
        <CheckCircle2 size={18} aria-hidden />
        <span>
          El trimestre {trimestre} de este grupo ya está publicado a papás; no se puede editar.
          {modo === 'direccion' ? ' Para corregir, retíralo primero en Entregas.' : ''}
        </span>
      </div>
    )
  }
  if (entrega?.estado === 'enviada') {
    return (
      <div className="bc-banner is-enviada" role="status">
        <Send size={18} aria-hidden />
        <span>
          {modo === 'maestro'
            ? `Enviada a dirección${fecha(entrega.enviadaAt) ? ` el ${fecha(entrega.enviadaAt)}` : ''}. Ya no se puede editar; si hay que corregir, tu directora te la regresa.`
            : `${entrega.enviadaPor || 'El maestro'} la envió${fecha(entrega.enviadaAt) ? ` el ${fecha(entrega.enviadaAt)}` : ''}. Como dirección puedes corregirla aquí.`}
        </span>
      </div>
    )
  }
  if (entrega?.estado === 'devuelta') {
    return (
      <div className="bc-banner is-devuelta" role="status">
        <Undo2 size={18} aria-hidden />
        <span>
          <strong>{modo === 'maestro' ? 'Tu directora te la regresó para corregir.' : 'Regresada al maestro.'}</strong>
          {entrega.comentario ? ` «${entrega.comentario}»` : ''}
          {modo === 'maestro' ? ' Cuando termines, envíala otra vez.' : ''}
        </span>
      </div>
    )
  }
  if (modo === 'maestro' && hoja.abierto != null && hoja.abierto !== trimestre) {
    return (
      <div className="bc-banner is-cerrada" role="status">
        <Lock size={18} aria-hidden />
        <span>
          {hoja.abierto
            ? `Este trimestre no está abierto para captura (está abierto el trimestre ${hoja.abierto}). Puedes consultarlo, pero no editarlo.`
            : 'La captura está cerrada. Tu directora abre el trimestre cuando empieza la captura; mientras, solo puedes consultar.'}
        </span>
      </div>
    )
  }
  return null
}

/** Una materia de un grupo: hoja de calificaciones del trimestre (y comprensión lectora si aplica). */
export default function SecClase(props: Props) {
  const { modo, url, extra, materiaId, materia, grupo, etiqueta, comprension, trimestre, hermanas } = props
  const [tab, setTab] = useState<'calif' | 'comprension'>('calif')
  const [mes, setMes] = useState(1)
  const [hoja, setHoja] = useState<HojaResp | null>(null)
  const [comp, setComp] = useState<SecFilaComprension[] | null>(null)
  const [compEditable, setCompEditable] = useState(true)
  const [carga, setCarga] = useState(0)
  /** Sube cada vez que llega la hoja; la tabla se rearma con los datos ya cargados, no antes. */
  const [version, setVersion] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [vigentes, setVigentes] = useState<Record<number, Record<string, string>>>({})
  const grid = useRef<SecGridControl | null>(null)
  const silencioso = useRef(false)
  const extraKey = JSON.stringify(extra ?? {})
  const extraQs = useMemo(() => JSON.parse(extraKey) as Record<string, string | number>, [extraKey])

  useEffect(() => {
    let vivo = true
    if (!silencioso.current) setCargando(true)
    silencioso.current = false
    setErr('')
    const params =
      tab === 'calif'
        ? { ...extraQs, materiaId, grupo, trimestre }
        : { ...extraQs, tipo: 'comprension', materiaId, grupo, mes }
    kiApi<HojaResp & { filas: SecFilaComprension[] }>(`${url}?${qs(params)}`)
      .then((d) => {
        if (!vivo) return
        setVersion((v) => v + 1)
        if (tab === 'calif') setHoja(d as HojaResp)
        else {
          setComp(d.filas)
          setCompEditable(d.editable !== false)
        }
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'No se pudo cargar la hoja.'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [url, extraQs, materiaId, grupo, trimestre, tab, mes, carga])

  const puedeSalir = useCallback(async () => {
    if (!grid.current) return true
    if (await grid.current.guardarPendientes()) return true
    return window.confirm('Hay celdas en rojo o cambios que no se pudieron guardar. Si sales se pierden. ¿Salir de todos modos?')
  }, [])

  useImperativeHandle(props.controlRef, () => ({ puedeSalir }), [puedeSalir])

  /** Llegaron calificaciones de Classroom: guarda lo que se esté escribiendo y recarga sin quitar la hoja. */
  const recargarDeClassroom = useCallback(async () => {
    if (grid.current) await grid.current.guardarPendientes()
    silencioso.current = true
    setCarga((n) => n + 1)
  }, [])

  async function ir(fn: () => void) {
    if (await puedeSalir()) {
      setMsg('')
      fn()
    }
  }

  const columnas = useMemo(() => COLS_CALIF(trimestre), [trimestre])

  const filasCalif = useMemo<SecGridFila[]>(
    () =>
      (hoja?.filas ?? []).map((f) => ({
        id: f.alumno_id,
        nombre: f.nombre,
        valores: { cal: f.cal[trimestre - 1], faltas: f.faltas, conducta: letraConducta(f.conducta) },
      })),
    [hoja, trimestre]
  )
  const filasComp = useMemo<SecGridFila[]>(
    () => (comp ?? []).map((f) => ({ id: f.alumno_id, nombre: f.nombre, valores: { p1: letraComprension(f.p1), p2: letraComprension(f.p2), p3: letraComprension(f.p3) } })),
    [comp]
  )
  const calDe = useMemo(() => new Map((hoja?.filas ?? []).map((f) => [f.alumno_id, f.cal])), [hoja])
  const crDe = hoja?.classroom ?? {}
  const conClassroom = Object.keys(crDe).length > 0
  const alumnosLista = useMemo(() => (hoja?.filas ?? []).map((f) => ({ alumno_id: f.alumno_id, nombre: f.nombre })), [hoja])

  const guardarCalif = useCallback(
    async (cambios: SecGridCambio[]) => {
      await kiApi(url, {
        method: 'PUT',
        body: JSON.stringify({
          ...extraQs,
          materiaId,
          grupo,
          trimestre,
          cambios: cambios.map((c) => ({ alumnoId: c.id, ...c.valores })),
        }),
      })
    },
    [url, extraQs, materiaId, grupo, trimestre]
  )
  const guardarComp = useCallback(
    async (cambios: SecGridCambio[]) => {
      await kiApi(url, {
        method: 'PUT',
        body: JSON.stringify({
          ...extraQs,
          tipo: 'comprension',
          materiaId,
          grupo,
          mes,
          cambios: cambios.map((c) => ({ alumnoId: c.id, ...c.valores })),
        }),
      })
    },
    [url, extraQs, materiaId, grupo, mes]
  )

  const total = filasCalif.length
  const completos = filasCalif.filter((f) => {
    const v = vigentes[f.id] ?? f.valores
    return v.cal !== '' && v.conducta !== ''
  }).length

  async function enviar(forzar = false) {
    if (!grid.current || !(await grid.current.guardarPendientes())) {
      setErr('Antes de enviar corrige las celdas en rojo (o espera a que se guarde).')
      return
    }
    if (!forzar && !window.confirm(`¿Enviar ${materia} de ${etiqueta} (trimestre ${trimestre}) a dirección?\n\nDespués ya no podrás editarla.`)) {
      return
    }
    setEnviando(true)
    setErr('')
    try {
      await kiApi(url, { method: 'POST', body: JSON.stringify({ accion: 'enviar', materiaId, grupo, trimestre, forzar }) })
      setMsg(`¡Listo! ${materia} de ${etiqueta} quedó enviada a dirección.`)
      setCarga((n) => n + 1)
      props.onEnviado?.()
    } catch (e) {
      const data = (e as { data?: { code?: string; faltan?: string[] } }).data
      if (data?.code === 'incompleto' && data.faltan?.length) {
        const lista = data.faltan.slice(0, 10).join('\n· ')
        const mas = data.faltan.length > 10 ? `\n… y ${data.faltan.length - 10} más` : ''
        setEnviando(false)
        if (window.confirm(`A ${data.faltan.length} alumno(s) les falta calificación o conducta:\n· ${lista}${mas}\n\n¿Enviar de todos modos?`)) {
          await enviar(true)
        }
        return
      }
      setErr(e instanceof Error ? e.message : 'No se pudo enviar.')
    } finally {
      setEnviando(false)
    }
  }

  const otros = [1, 2, 3].filter((t) => t !== trimestre)

  return (
    <section className={`sc-clase sc-g-${grupo}`}>
      <header className="sc-banda">
        <div className="sc-banda-texto">
          <h2>
            <span className="sc-materia">{materia}</span>
            <span className="sc-grupo-tag" aria-label={`Grupo ${etiqueta}`}>
              {etiqueta}
            </span>
          </h2>
          <p className="sc-detalle">
            {modo === 'direccion' ? 'Revisión de dirección' : 'Captura'}
            {hoja ? ` · Ciclo ${hoja.ciclo.etiqueta}` : ''}
          </p>
        </div>
        {hermanas.length > 1 && (
          <div className="sc-hermanas" role="tablist" aria-label="Cambiar de grupo en esta materia">
            {hermanas.map((h) => (
              <button
                key={h.grupo}
                type="button"
                role="tab"
                aria-selected={h.grupo === grupo}
                className={`sc-hermana sc-g-${h.grupo}${h.grupo === grupo ? ' is-on' : ''}`}
                onClick={() => h.grupo !== grupo && void ir(() => props.onGrupo(h.grupo))}
              >
                {h.etiqueta}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="sc-controles">
        <div className="bc-trimestres" role="tablist" aria-label="Qué capturar">
          {[1, 2, 3].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === 'calif' && trimestre === t}
              className={`ki-tab${tab === 'calif' && trimestre === t ? ' is-on' : ''}`}
              onClick={() => void ir(() => {
                setTab('calif')
                props.onTrimestre(t)
              })}
            >
              Trimestre {t}
              {modo === 'maestro' && hoja?.abierto === t && <span className="sc-abierto">abierto</span>}
            </button>
          ))}
          {comprension && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'comprension'}
              className={`ki-tab${tab === 'comprension' ? ' is-on' : ''}`}
              onClick={() => void ir(() => setTab('comprension'))}
            >
              Comprensión lectora
            </button>
          )}
        </div>
        {tab === 'comprension' && (
          <div className="bc-trimestres" role="tablist" aria-label="Mes de evaluación">
            {COMPRENSION_MESES.map((m) => (
              <button
                key={m.mes}
                type="button"
                role="tab"
                aria-selected={mes === m.mes}
                className={`ki-tab sc-mes${mes === m.mes ? ' is-on' : ''}`}
                onClick={() => mes !== m.mes && void ir(() => setMes(m.mes))}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sc-cuerpo">
        {tab === 'calif' && hoja && <Estado hoja={hoja} modo={modo} />}
        {tab === 'calif' && modo === 'maestro' && hoja && hoja.trimestre === trimestre && (
          <ClassroomBarra
            key={`cr-${materiaId}-${grupo}-${trimestre}`}
            url={url}
            params={{ materiaId, grupo, trimestre }}
            alumnos={alumnosLista}
            nota={NOTA_CLASSROOM}
            onDatos={() => void recargarDeClassroom()}
          />
        )}
        {(msg || err) && (
          <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
            {err || msg}
          </p>
        )}

        {cargando ? (
          <p className="ki-hint">Cargando lista…</p>
        ) : tab === 'calif' && hoja ? (
          filasCalif.length === 0 ? (
            <p className="ki-hint">Este grupo no tiene alumnos activos en el ciclo.</p>
          ) : (
            <>
              <SecGrid
                key={`c-${materiaId}-${grupo}-${trimestre}-${version}`}
                filas={filasCalif}
                columnas={columnas}
                editable={hoja.editable}
                guardar={guardarCalif}
                controlRef={grid}
                onVigentes={setVigentes}
                tituloEdicion={`Trimestre ${trimestre}`}
                extra={{
                  titulo: 'Referencia',
                  span: conClassroom ? 4 : 3,
                  encabezados: (
                    <>
                      {conClassroom && (
                        <th scope="col" className="sg-th-ro" title="Lo que da Classroom este trimestre (solo lectura)">
                          Classroom
                        </th>
                      )}
                      {otros.map((t) => (
                        <th key={t} scope="col" className="sg-th-ro" title={`Calificación del trimestre ${t} (solo lectura)`}>
                          T{t}
                        </th>
                      ))}
                      <th scope="col" className="sg-th-ro" title="Promedio de la materia como sale en la boleta (entero, truncado)">
                        Prom.
                      </th>
                    </>
                  ),
                  celdas: (f, vig) => {
                    const cal = [...(calDe.get(f.id) ?? ['', '', ''])]
                    cal[trimestre - 1] = vig.cal ?? ''
                    const cr = crDe[f.id]
                    const ajustada = cr != null && !mismoValor(vig.cal ?? '', cr.valor)
                    return (
                      <>
                        {conClassroom && (
                          <td
                            className={`sg-ro-celda sc-cr${ajustada ? ' is-ajustada' : ''}`}
                            title={cr ? (ajustada ? `Ajustada aquí · en Classroom: ${cr.valor}` : 'Igual que en Classroom') : 'Sin calificación en Classroom'}
                          >
                            {cr?.valor ?? '·'}
                            {ajustada && <span className="sc-cr-marca"> · ajustada</span>}
                          </td>
                        )}
                        {otros.map((t) => (
                          <td key={t} className="sg-ro-celda">
                            {cal[t - 1] || '·'}
                          </td>
                        ))}
                        <td className="sg-ro-celda sg-prom">{promedioMateriaBoleta(cal) || '·'}</td>
                      </>
                    )
                  },
                }}
              />
              <p className="sc-leyenda">
                <strong>Conducta:</strong>{' '}
                {CONDUCTA_ESCALA.map((c) => (
                  <span key={c.codigo}>
                    <b>{c.letra}</b> {c.etiqueta}
                  </span>
                ))}
              </p>
              {hoja.editable && (
                <p className="sc-ayuda">
                  Escribe y pasa con <kbd>Enter</kbd> (abajo) o <kbd>Tab</kbd> (derecha); flechas para moverte; <kbd>Esc</kbd> deshace
                  la celda. Puedes pegar una columna copiada de Excel. Se guarda solo.
                </p>
              )}
              {modo === 'maestro' && hoja.editable && (
                <div className="bc-enviar sc-enviar">
                  <p className="ki-hint">
                    <strong>
                      {completos} de {total}
                    </strong>{' '}
                    alumnos con calificación y conducta. Cuando termines, envía {materia} de {etiqueta} a dirección.
                  </p>
                  <button type="button" className="ki-btn primary" disabled={enviando} onClick={() => void enviar()}>
                    <Send size={16} aria-hidden />
                    {enviando ? 'Enviando…' : 'Enviar a dirección'}
                  </button>
                </div>
              )}
              {modo === 'direccion' && (
                <p className="ki-hint sc-ayuda">
                  {completos} de {total} alumnos con calificación y conducta en el trimestre {trimestre}.
                </p>
              )}
            </>
          )
        ) : tab === 'comprension' && comp ? (
          comp.length === 0 ? (
            <p className="ki-hint">Este grupo no tiene alumnos activos en el ciclo.</p>
          ) : (
            <>
              {!compEditable && (
                <div className="bc-banner is-cerrada" role="status">
                  <Lock size={18} aria-hidden />
                  <span>La captura está cerrada; solo puedes consultar la comprensión lectora.</span>
                </div>
              )}
              <SecGrid
                key={`r-${materiaId}-${grupo}-${mes}-${version}`}
                filas={filasComp}
                columnas={COLS_COMPRENSION}
                editable={compEditable}
                guardar={guardarComp}
                controlRef={grid}
                tituloEdicion={`Comprensión lectora · ${COMPRENSION_MESES.find((m) => m.mes === mes)?.etiqueta ?? ''}`}
              />
              <ol className="sc-preguntas">
                {COMPRENSION_PREGUNTAS.map((p) => (
                  <li key={p.id}>
                    <strong>{p.corto}:</strong> {p.texto}
                  </li>
                ))}
              </ol>
              <p className="sc-leyenda">
                {COMPRENSION_ESCALA.map((c) => (
                  <span key={c.codigo}>
                    <b>{c.letra}</b> {c.etiqueta}
                  </span>
                ))}
              </p>
            </>
          )
        ) : null}
      </div>
    </section>
  )
}
