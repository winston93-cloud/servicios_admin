'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BellOff, Lock, RefreshCw, Server } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  PANEL_CONTROL_REFRESCO_MS,
  PANEL_CONTROL_USUARIOS,
  UMBRALES_SALUD,
  estadoPorValor,
  type EstadoMedidor,
  type MedidorProceso,
  type PanelControlRespuesta,
  type PiezaMedida,
} from '@/lib/panelControl/tipos'
import './panel-control.css'
import PanelUniformes from './PanelUniformes'
import { Electro, Tacometro, ZONAS_LIMITE } from './Instrumentos'
import ModalAnalisis from './ModalAnalisis'

const NOMBRES = ['Pagos', 'Facturación', 'RAC', 'Talleres', 'Open House', 'InsForge', 'Vercel', 'Desarrollo']

/** Nombre de placa: corto para que quepa entero en el banco. */
const NOMBRE_PLACA: Record<string, string> = {
  facturacion: 'Facturación',
  reportes: 'RAC',
  'control-escolar': 'Control escolar',
  caja: 'Caja',
  acceso: 'Acceso',
  'portal-inscripcion': 'Inscripción',
}

/** Proyecto de la plataforma que mide el medidor, bajo su nombre. */
const INFRA_PLACA: Record<string, string> = {
  insforge: 'Winston Servicios',
  vercel: '12 apps',
  desarrollo: 'servicios-admin',
}

const IDS = ['pagos', 'facturacion', 'reportes', 'talleres', 'open-house', 'insforge', 'vercel', 'desarrollo']

const PLACEHOLDER: MedidorProceso[] = NOMBRES.map((nombre, i) => ({
  id: IDS[i],
  nombre,
  mide: '',
  valor: null,
  estado: 'sin-dato',
  piezas: [],
  resumen: 'Leyendo…',
}))

const SISTEMAS_PLACEHOLDER: MedidorProceso[] = [
  ['control-escolar', 'Control escolar'],
  ['boletas', 'Boletas'],
  ['caja', 'Caja de servicios'],
  ['becas', 'Becas'],
  ['acceso', 'Control de acceso'],
  ['workshops', 'Workshops'],
  ['ssiw', 'SSIW'],
  ['cheques', 'Cheques'],
  ['prorrogas', 'Prórrogas'],
  ['portal-inscripcion', 'Portal de inscripción'],
].map(([id, nombre]) => ({ id, nombre, mide: '', valor: null, estado: 'sin-dato', piezas: [], resumen: 'Leyendo…' }))

const ZONAS: { desde: number; hasta: number; estado: EstadoMedidor }[] = [
  { desde: 0, hasta: UMBRALES_SALUD[0], estado: 'alarma' },
  { desde: UMBRALES_SALUD[0], hasta: UMBRALES_SALUD[1], estado: 'precaucion' },
  { desde: UMBRALES_SALUD[1], hasta: 100, estado: 'normal' },
]

const MARCAS = [0, UMBRALES_SALUD[0], UMBRALES_SALUD[1], 100]

export default function PanelControlPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <PanelControlView />
    </ProtectedRoute>
  )
}

function PanelControlView() {
  const router = useRouter()
  const { session } = useAuth()
  const permitido = PANEL_CONTROL_USUARIOS.includes(Number(session?.usuario_id) || 0)
  const [datos, setDatos] = useState<PanelControlRespuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [siguiente, setSiguiente] = useState(0)
  const [reconocidas, setReconocidas] = useState<Set<string>>(() => new Set())
  const [elegido, setElegido] = useState<string | null>(null)
  const [analisis, setAnalisis] = useState<{ id: string; codigo: string } | null>(null)
  const cerrarAnalisis = useCallback(() => setAnalisis(null), [])
  const enCurso = useRef(false)

  const leer = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    setLeyendo(true)
    try {
      const res = await fetch('/api/panel-control', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: portalSessionFetchHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo leer el panel.')
      setDatos(json as PanelControlRespuesta)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el panel.')
    } finally {
      enCurso.current = false
      setLeyendo(false)
      setSiguiente(Date.now() + PANEL_CONTROL_REFRESCO_MS)
    }
  }, [])

  useEffect(() => {
    if (!permitido) return
    void leer()
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void leer()
    }, PANEL_CONTROL_REFRESCO_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [permitido, leer])

  const medidores = useMemo(() => (datos?.medidores.length ? datos.medidores : PLACEHOLDER), [datos])
  const sistemas = useMemo(() => (datos?.sistemas?.length ? datos.sistemas : SISTEMAS_PLACEHOLDER), [datos])
  const todos = useMemo(() => [...medidores, ...sistemas], [medidores, sistemas])
  const enAlarma = useMemo(() => todos.filter((m) => m.estado === 'alarma').map((m) => m.id), [todos])

  useEffect(() => {
    setReconocidas((prev) => {
      const siguen = [...prev].filter((id) => enAlarma.includes(id))
      return siguen.length === prev.size ? prev : new Set(siguen)
    })
  }, [enAlarma])

  const sinReconocer = enAlarma.filter((id) => !reconocidas.has(id))
  const conProblema = todos
    .filter((m) => m.estado === 'alarma' || m.estado === 'precaucion')
    .sort((a, b) => (a.valor ?? 100) - (b.valor ?? 100))
  const seleccionado = todos.find((m) => m.id === elegido) ?? conProblema[0] ?? medidores[0]

  if (!permitido) {
    return (
      <Marco onVolver={() => router.push('/dashboard')}>
        <div className="pc-vacio">
          <Lock size={26} aria-hidden />
          <p>El Main Control Room solo está disponible para Sistemas.</p>
        </div>
      </Marco>
    )
  }

  const enVerde = todos.filter((m) => m.estado === 'normal').length
  const consola = leerConsola(medidores, sistemas)
  const general: EstadoMedidor = !datos
    ? 'sin-dato'
    : conProblema.some((m) => m.estado === 'alarma')
      ? 'alarma'
      : conProblema.length
        ? 'precaucion'
        : 'normal'

  return (
    <Marco
      onVolver={() => router.push('/dashboard')}
      reloj={<Reloj siguiente={siguiente} leidoEn={datos?.leidoEn ?? null} leyendo={leyendo} onLeer={() => void leer()} />}
    >
      <div className="pc-cabina">
        <div className="pc-col-servicios">
          <header className="pc-zona-cabeza">
            <span className="pc-insignia" aria-hidden>
              <Server size={22} strokeWidth={2.2} />
            </span>
            <div className="pc-min0">
              <h2 className="pc-zona-titulo">Winston Servicios</h2>
              <p className="pc-zona-sub">Procesos, base de datos y apps de la escuela · lo vigila Sonny</p>
            </div>
            <span className="pc-zona-estado" data-estado={general}>
              <span className="pc-lampara" data-estado={general} aria-hidden />
              {ESTADO_CORTO[general]}
            </span>
          </header>

          <section className="pc-general" data-estado={general} aria-live="polite">
            <Radar medidores={todos} cargando={!datos} />
            <div className="pc-general-texto pc-min0">
              <p className="pc-general-titulo">
                {general === 'sin-dato'
                  ? 'Leyendo la infraestructura…'
                  : general === 'normal'
                    ? 'Toda la infraestructura opera con normalidad'
                    : general === 'alarma'
                      ? 'Alarma en la infraestructura'
                      : 'Atención: hay piezas fuera de lo normal'}
              </p>
              {conProblema.length ? (
                <ul className="pc-general-lista">
                  {conProblema.slice(0, 3).map((m) => (
                    <li key={m.id}>
                      <b>{m.nombre}</b> · {m.resumen}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pc-general-sub">
                  {datos
                    ? `${medidores.length} de ${medidores.length} procesos y ${sistemas.length} de ${sistemas.length} sistemas en verde: responden a tiempo, sin fallos y sin piezas flojas.`
                    : ' '}
                </p>
              )}
            </div>
            <div className="pc-cuenta" data-estado={general}>
              <span className="pc-cuenta-num">
                {datos ? enVerde : '--'}
                <small>/{todos.length}</small>
              </span>
              <span className="pc-cuenta-txt">en verde</span>
            </div>
            {sinReconocer.length ? (
              <button type="button" className="pc-reconocer" onClick={() => setReconocidas(new Set(enAlarma))}>
                <BellOff size={16} aria-hidden />
                Reconocer alarmas
              </button>
            ) : null}
          </section>

          <Electro
            estado={general}
            etiqueta="Pulso de la infraestructura"
            detalle={datos ? `${todos.length} señales · lectura cada ${PANEL_CONTROL_REFRESCO_MS / 1000} s` : 'Conectando…'}
          />

          {error ? (
            <p className="pc-error" role="alert">
              {error} {datos ? 'Se muestran las últimas lecturas.' : ''}
            </p>
          ) : null}

          <section className="pc-consola" aria-label="Consola principal">
            <button
              type="button"
              className="pc-taco-btn"
              aria-haspopup="dialog"
              aria-label="Análisis de Procesos"
              disabled={!datos}
              onClick={() => setAnalisis({ id: 'consola-procesos', codigo: 'C-01' })}
            >
              <Tacometro
                valor={consola.procesos.valor}
                etiqueta="Procesos"
                sub={consola.procesos.sub}
                cargando={!datos}
              />
            </button>
            <button
              type="button"
              className="pc-taco-btn"
              aria-haspopup="dialog"
              aria-label="Análisis de Conexiones"
              disabled={!datos}
              onClick={() => setAnalisis({ id: 'consola-conexiones', codigo: 'C-02' })}
            >
              <Tacometro
                valor={consola.conexiones.valor}
                etiqueta="Conexiones"
                sub={consola.conexiones.sub}
                zonas={ZONAS_LIMITE}
                cargando={!datos}
              />
            </button>
            <button
              type="button"
              className="pc-taco-btn"
              aria-haspopup="dialog"
              aria-label="Análisis de Salud general"
              disabled={!datos}
              onClick={() => setAnalisis({ id: 'consola-salud', codigo: 'C-03' })}
            >
              <Tacometro
                grande
                valor={consola.salud}
                etiqueta="Salud general"
                sub="promedio de las 18 señales"
                cargando={!datos}
              />
            </button>
            <button
              type="button"
              className="pc-taco-btn"
              aria-haspopup="dialog"
              aria-label="Análisis de Respuesta de la base"
              disabled={!datos}
              onClick={() => setAnalisis({ id: 'consola-base', codigo: 'C-04' })}
            >
              <Tacometro
                valor={consola.base.valor}
                etiqueta="Respuesta de la base"
                sub="Winston Servicios"
                lectura={consola.base.lectura}
                cargando={!datos}
              />
            </button>
            <button
              type="button"
              className="pc-taco-btn"
              aria-haspopup="dialog"
              aria-label="Análisis de Sistemas"
              disabled={!datos}
              onClick={() => setAnalisis({ id: 'consola-sistemas', codigo: 'C-05' })}
            >
              <Tacometro
                valor={consola.sistemas.valor}
                etiqueta="Sistemas"
                sub={consola.sistemas.sub}
                cargando={!datos}
              />
            </button>
          </section>

          <h2 className="pc-banco-titulo">Procesos</h2>
          <section className="pc-banco" aria-label="Medidores de los procesos">
            {medidores.map((m, i) => (
              <Medidor
                key={m.id}
                m={m}
                orden={i}
                codigo={`P-${String(i + 1).padStart(2, '0')}`}
                onAnalizar={setAnalisis}
                cargando={!datos}
                elegido={m.id === seleccionado?.id}
                parpadea={m.estado === 'alarma' && !reconocidas.has(m.id)}
                onElegir={() => setElegido(m.id)}
              />
            ))}
          </section>

          <h2 className="pc-banco-titulo">Sistemas que más usan la base</h2>
          <section className="pc-banco pc-banco--sistemas" aria-label="Medidores de los sistemas">
            {sistemas.map((m, i) => (
              <Medidor
                key={m.id}
                m={m}
                orden={medidores.length + i}
                codigo={`S-${String(i + 1).padStart(2, '0')}`}
                onAnalizar={setAnalisis}
                cargando={!datos}
                elegido={m.id === seleccionado?.id}
                parpadea={m.estado === 'alarma' && !reconocidas.has(m.id)}
                onElegir={() => setElegido(m.id)}
              />
            ))}
          </section>

          {seleccionado && datos ? <Detalle m={seleccionado} /> : null}

          <p className="pc-leyenda">
            Cada barra es la salud de la infraestructura: responde a tiempo, sin fallos del sistema, con sus tareas al día,
            tablas con índice y sin basura acumulada. Manda la pieza más débil. Toca un medidor para ver su análisis: qué es, por
            qué marca su porcentaje y cómo se califica cada pieza.
          </p>
        </div>
        <aside className="pc-col-uniformes" aria-label="Uniformes">
          <PanelUniformes />
        </aside>
      </div>

      {analisis && datos
        ? (() => {
            const c = analisisConsola(analisis.id, medidores, sistemas, consola)
            if (c) return <ModalAnalisis {...c} codigo={analisis.codigo} leidoEn={datos.leidoEn} onCerrar={cerrarAnalisis} />
            const m = todos.find((x) => x.id === analisis.id)
            return m ? <ModalAnalisis m={m} codigo={analisis.codigo} leidoEn={datos.leidoEn} onCerrar={cerrarAnalisis} /> : null
          })()
        : null}
    </Marco>
  )
}

function Marco({
  children,
  onVolver,
  reloj,
}: {
  children: React.ReactNode
  onVolver: () => void
  reloj?: React.ReactNode
}) {
  return (
    <div className="pc-page">
      <div className="pc-shell">
        <header className="pc-topbar">
          <button type="button" className="pc-boton" onClick={onVolver}>
            <ArrowLeft size={16} aria-hidden /> Dashboard
          </button>
          <h1 className="pc-titulo">Main Control Room</h1>
          <div className="pc-topbar-der">
            {reloj}
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

function Reloj({
  siguiente,
  leidoEn,
  leyendo,
  onLeer,
}: {
  siguiente: number
  leidoEn: string | null
  leyendo: boolean
  onLeer: () => void
}) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const faltan = siguiente ? Math.max(0, Math.ceil((siguiente - ahora) / 1000)) : 0
  const fmt = (d: Date) =>
    d.toLocaleTimeString('es-MX', {
      timeZone: 'America/Monterrey',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  return (
    <div className="pc-reloj">
      <div className="pc-reloj-hora" aria-label="Hora actual">
        {fmt(new Date(ahora))}
      </div>
      <div className="pc-reloj-info">
        <span>Leído {leidoEn ? fmt(new Date(leidoEn)) : '—'}</span>
        <span>{leyendo ? 'Leyendo…' : `Siguiente en ${faltan} s`}</span>
      </div>
      <button type="button" className="pc-boton pc-boton-icono" onClick={onLeer} disabled={leyendo} title="Leer ahora">
        <RefreshCw size={16} aria-hidden className={leyendo ? 'pc-girando' : undefined} />
        <span className="pc-solo-lector">Leer ahora</span>
      </button>
    </div>
  )
}

/** Radar de la franja de estado: un punto por medidor (procesos adentro, sistemas afuera) con su color. */
function Radar({ medidores, cargando }: { medidores: MedidorProceso[]; cargando: boolean }) {
  const procesos = medidores.filter((m) => IDS.includes(m.id))
  const sistemas = medidores.filter((m) => !IDS.includes(m.id))
  const puntos = [
    ...procesos.map((m, i) => ({ m, angulo: (i / procesos.length) * 360 + 20, radio: 22 })),
    ...sistemas.map((m, i) => ({ m, angulo: (i / sistemas.length) * 360, radio: 39 })),
  ]
  return (
    <div className="pc-radar" data-cargando={cargando || undefined} aria-hidden>
      <span className="pc-radar-barrido" />
      {puntos.map(({ m, angulo, radio }) => {
        const rad = (angulo * Math.PI) / 180
        return (
          <span
            key={m.id}
            className="pc-radar-punto"
            data-estado={m.estado}
            style={{ left: `${50 + radio * Math.cos(rad)}%`, top: `${50 + radio * Math.sin(rad)}%` }}
          />
        )
      })}
    </div>
  )
}

/** Lo que muestran los tacómetros de la consola, sacado de las lecturas que ya llegaron. */
const ESTADO_CORTO: Record<EstadoMedidor, string> = { normal: 'En verde', precaucion: 'Atención', alarma: 'Alarma', 'sin-dato': 'Leyendo' }

/** Un medidor del banco visto como pieza de un reloj de la consola. */
function comoPieza(m: MedidorProceso): PiezaMedida {
  const lectura = m.info?.join(' · ') || m.resumen
  return {
    id: m.id,
    nombre: m.nombre,
    valor: m.valor,
    estado: m.estado,
    corto: m.resumen,
    lectura,
    diag: {
      operatividad:
        m.estado === 'sin-dato'
          ? { texto: 'Sin lectura por ahora', estado: m.estado }
          : { texto: m.estado === 'alarma' ? 'Con falla' : 'Operando', estado: m.estado === 'alarma' ? 'alarma' : 'normal' },
      eficiencia: { texto: lectura, estado: m.estado },
      errores:
        m.estado === 'normal' || m.estado === 'sin-dato'
          ? { texto: 'Sin errores detectados', estado: 'normal' }
          : { texto: m.resumen, estado: m.estado },
    },
  }
}

type Consola = ReturnType<typeof leerConsola>

/** Ventana de análisis de los relojes de la consola principal. */
function analisisConsola(
  id: string,
  medidores: MedidorProceso[],
  sistemas: MedidorProceso[],
  consola: Consola,
): { m: MedidorProceso; instrumento?: Parameters<typeof ModalAnalisis>[0]['instrumento']; porQue?: string } | null {
  const armar = (nombre: string, mide: string, valor: number | null, piezas: PiezaMedida[]): MedidorProceso => ({
    id,
    nombre,
    mide,
    valor,
    estado: estadoPorValor(valor),
    piezas,
    resumen: '',
  })
  const insforge = medidores.find((m) => m.id === 'insforge')
  switch (id) {
    case 'consola-procesos':
      return { m: armar('Procesos', `${medidores.length} procesos de la escuela`, consola.procesos.valor, medidores.map(comoPieza)) }
    case 'consola-sistemas':
      return { m: armar('Sistemas', `${sistemas.length} sistemas que más usan la base`, consola.sistemas.valor, sistemas.map(comoPieza)) }
    case 'consola-salud': {
      const todos = [...medidores, ...sistemas]
      const conValor = todos.filter((m) => m.valor != null)
      const enVerde = todos.filter((m) => m.estado === 'normal').length
      const peor = conValor.length ? conValor.reduce((a, b) => ((b.valor ?? 100) < (a.valor ?? 100) ? b : a)) : null
      return {
        m: armar('Salud general', `promedio de las ${todos.length} señales`, consola.salud, todos.map(comoPieza)),
        porQue:
          consola.salud == null
            ? 'Todavía no hay lectura de ninguna señal.'
            : `Marca ${consola.salud}% porque es el promedio de las ${conValor.length} señales con lectura (${medidores.length} procesos y ${sistemas.length} sistemas): ${enVerde} en verde.${peor && peor.estado !== 'normal' ? ` La más baja es ${peor.nombre} con ${peor.valor}%: ${peor.resumen}.` : ' Ninguna está fuera de lo normal.'} A diferencia de los medidores, aquí no manda la más débil: es el pulso de todo junto.`,
      }
    }
    case 'consola-conexiones': {
      const p = insforge?.piezas.find((x) => x.id === 'conexiones')
      return {
        m: armar('Conexiones', 'Base Winston Servicios en InsForge', p?.valor ?? null, p ? [p] : []),
        instrumento: { valor: consola.conexiones.valor, etiqueta: 'En uso', zonas: ZONAS_LIMITE },
        porQue:
          consola.conexiones.valor == null
            ? 'Todavía no hay lectura de las conexiones.'
            : `Marca ${consola.conexiones.valor}% porque hay ${consola.conexiones.sub} del máximo que acepta la base. Hasta 80% es normal; de 80 a 89% precaución y desde 90% alarma: al llegar al 100% la base empieza a rechazar conexiones y los sistemas fallan.`,
      }
    }
    case 'consola-base': {
      const p = insforge?.piezas.find((x) => x.id === 'base')
      return {
        m: armar('Respuesta de la base', 'Base Winston Servicios en InsForge', p?.valor ?? null, p ? [p] : []),
        instrumento: { valor: consola.base.valor, etiqueta: 'Respuesta', lectura: consola.base.lectura },
      }
    }
    default:
      return null
  }
}

function leerConsola(medidores: MedidorProceso[], sistemas: MedidorProceso[]) {
  const peor = (lista: MedidorProceso[]) => {
    const conValor = lista.filter((m) => m.valor != null)
    if (!conValor.length) return { valor: null, sub: 'sin lectura' }
    const m = conValor.reduce((a, b) => ((b.valor ?? 100) < (a.valor ?? 100) ? b : a))
    return { valor: m.valor, sub: m.estado === 'normal' ? `${lista.length} de ${lista.length} en verde` : `manda ${m.nombre}` }
  }
  const valores = [...medidores, ...sistemas].map((m) => m.valor).filter((v): v is number => v != null)
  const insforge = medidores.find((m) => m.id === 'insforge')
  const piezaCon = insforge?.piezas.find((p) => p.id === 'conexiones')
  const uso = piezaCon?.lectura.match(/(\d+) de (\d+) en uso/)
  const base = insforge?.piezas.find((p) => p.id === 'base')
  return {
    procesos: peor(medidores),
    sistemas: peor(sistemas),
    salud: valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : null,
    conexiones: uso
      ? { valor: Math.round((Number(uso[1]) / Number(uso[2])) * 100), sub: `${uso[1]} de ${uso[2]} en uso` }
      : { valor: null, sub: 'sin lectura' },
    base: { valor: base?.valor ?? null, lectura: base?.lectura.replace(/^contesta en /, '') },
  }
}

function Medidor({
  m,
  orden,
  codigo,
  cargando,
  elegido,
  parpadea,
  onElegir,
  onAnalizar,
}: {
  m: MedidorProceso
  orden: number
  codigo: string
  onAnalizar: (a: { id: string; codigo: string }) => void
  cargando: boolean
  elegido: boolean
  parpadea: boolean
  onElegir: () => void
}) {
  const valor = m.valor == null ? null : Math.max(0, Math.min(100, m.valor))
  const zona = estadoPorValor(valor)
  return (
    <button
      type="button"
      className="pc-medidor"
      data-estado={m.estado}
      data-cargando={cargando || undefined}
      aria-pressed={elegido}
      aria-haspopup="dialog"
      onClick={() => {
        onElegir()
        if (!cargando) onAnalizar({ id: m.id, codigo })
      }}
      style={{ '--i': orden } as React.CSSProperties}
      aria-label={`${m.nombre}: ${valor == null ? 'sin lectura' : `${valor}%`}, ${m.resumen}`}
    >
      <span className="pc-placa">
        <span className="pc-lampara" data-estado={m.estado} data-parpadeo={parpadea || undefined} aria-hidden />
        <span className="pc-placa-texto">
          <span className="pc-placa-nombre">{NOMBRE_PLACA[m.id] ?? m.nombre}</span>
          {INFRA_PLACA[m.id] ? <span className="pc-placa-infra">{INFRA_PLACA[m.id]}</span> : null}
        </span>
        <span className="pc-placa-codigo" aria-hidden>
          {codigo}
        </span>
      </span>

      <span className="pc-instrumento" aria-hidden>
        <span className="pc-escala">
          {MARCAS.map((v) => (
            <span key={v} style={{ bottom: `${v}%` }}>
              {v}
            </span>
          ))}
        </span>
        <span className="pc-franjas">
          {ZONAS.map((z) => (
            <span key={z.estado} data-zona={z.estado} style={{ bottom: `${z.desde}%`, height: `${z.hasta - z.desde}%` }} />
          ))}
        </span>
        <span className="pc-tubo">
          <span className="pc-rayas" />
          <span className="pc-columna" data-zona={zona} style={{ height: `${valor ?? 0}%` }} />
          {valor != null ? <span className="pc-aguja" style={{ bottom: `${valor}%` }} /> : null}
        </span>
      </span>

      <span className="pc-digital" data-zona={zona}>
        <span className="pc-digital-valor">{valor == null ? '- - -' : valor}</span>
        {valor == null ? null : <span className="pc-digital-unidad">%</span>}
      </span>
      <span className="pc-resumen">{m.resumen}</span>
      {m.info?.length ? (
        <span className="pc-info">
          {m.info.map((t) => (
            <span key={t} title={t}>
              {t}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  )
}

function Detalle({ m }: { m: MedidorProceso }) {
  return (
    <section className="pc-detalle" data-estado={m.estado} aria-label={`Piezas de ${m.nombre}`}>
      <header className="pc-detalle-cabeza">
        <h2>{m.nombre}</h2>
        <span>{m.mide}</span>
      </header>
      <ul className="pc-piezas">
        {m.piezas.map((p) => (
          <li key={p.id} className="pc-pieza" data-estado={p.estado}>
            <div className="pc-pieza-fila">
              <span className="pc-pieza-nombre">{p.nombre}</span>
              <span className="pc-pieza-valor">{p.valor == null ? '—' : `${p.valor}%`}</span>
            </div>
            <div
              className="pc-mini"
              role="meter"
              aria-label={p.nombre}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={p.valor ?? undefined}
              aria-valuetext={p.valor == null ? 'Sin lectura' : `${p.valor}%, ${p.corto}`}
            >
              <span className="pc-mini-relleno" data-zona={p.estado} style={{ width: `${p.valor ?? 0}%` }} />
            </div>
            <p className="pc-pieza-corto">{p.corto === 'bien' ? 'Bien' : p.corto}</p>
            <p className="pc-pieza-lectura">{p.lectura}</p>
            {p.fallo ? <p className="pc-pieza-fallo">Último fallo: {p.fallo}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
