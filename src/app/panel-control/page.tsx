'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BellOff, Lock, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  PANEL_CONTROL_REFRESCO_MS,
  PANEL_CONTROL_USUARIOS,
  estadoPorValor,
  type EstadoMedidor,
  type MedidorProceso,
  type PanelControlRespuesta,
} from '@/lib/panelControl/tipos'
import './panel-control.css'

const ETIQUETA_ESTADO: Record<EstadoMedidor, string> = {
  normal: 'Normal',
  precaucion: 'Precaución',
  alarma: 'Alarma',
  'sin-dato': 'Sin lectura',
}

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

  const medidores = useMemo(() => datos?.medidores ?? [], [datos])
  const enAlarma = useMemo(() => medidores.filter((m) => m.estado === 'alarma').map((m) => m.id), [medidores])

  useEffect(() => {
    setReconocidas((prev) => {
      const siguen = [...prev].filter((id) => enAlarma.includes(id))
      return siguen.length === prev.size ? prev : new Set(siguen)
    })
  }, [enAlarma])

  const sinReconocer = enAlarma.filter((id) => !reconocidas.has(id))

  if (!permitido) {
    return (
      <Marco onVolver={() => router.push('/dashboard')}>
        <div className="pc-vacio">
          <Lock size={26} aria-hidden />
          <p>El panel de control solo está disponible para Sistemas.</p>
        </div>
      </Marco>
    )
  }

  return (
    <Marco
      onVolver={() => router.push('/dashboard')}
      barra={
        <Reloj
          siguiente={siguiente}
          leidoEn={datos?.leidoEn ?? null}
          leyendo={leyendo}
          onLeer={() => void leer()}
        />
      }
    >
      <section className="pc-anunciador" aria-label="Panel de alarmas">
        <div className="pc-anunciador-ventanas">
          {(medidores.length ? medidores : PLACEHOLDER).map((m) => (
            <div
              key={m.id}
              className="pc-ventana"
              data-estado={m.estado}
              data-parpadeo={m.estado === 'alarma' && !reconocidas.has(m.id) ? '' : undefined}
              title={m.motivo ?? ETIQUETA_ESTADO[m.estado]}
            >
              <span className="pc-ventana-nombre">{m.nombre}</span>
              <span className="pc-ventana-estado">{datos ? ETIQUETA_ESTADO[m.estado] : '—'}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="pc-reconocer"
          disabled={!sinReconocer.length}
          onClick={() => setReconocidas(new Set(enAlarma))}
        >
          <BellOff size={16} aria-hidden />
          Reconocer alarmas
        </button>
      </section>

      {error ? (
        <p className="pc-error" role="alert">
          {error} {datos ? 'Se muestran las últimas lecturas.' : ''}
        </p>
      ) : null}

      <section className="pc-tablero" aria-label="Medidores de los procesos" aria-busy={!datos}>
        {(medidores.length ? medidores : PLACEHOLDER).map((m) => (
          <Medidor key={m.id} m={m} cargando={!datos} />
        ))}
      </section>

      <p className="pc-leyenda">
        La franja junto a cada barra marca las zonas: <b className="pc-ley pc-ley-normal">verde</b> normal,{' '}
        <b className="pc-ley pc-ley-precaucion">ámbar</b> precaución, <b className="pc-ley pc-ley-alarma">rojo</b>{' '}
        alarma. Una lámpara que parpadea es una alarma nueva; «Reconocer alarmas» la deja fija.
      </p>
    </Marco>
  )
}

const PLACEHOLDER: MedidorProceso[] = [
  'Pagos',
  'Facturación CFDI',
  'Reportes RAC',
  'Talleres',
  'Open House',
  'InsForge',
  'Vercel',
  'Desarrollo',
].map((nombre, i) => ({
  id: `p${i}`,
  nombre,
  mide: '',
  valor: null,
  sentido: 'alto-bueno',
  umbrales: [50, 80],
  estado: 'sin-dato',
  detalle: [],
}))

function Marco({
  children,
  onVolver,
  barra,
}: {
  children: React.ReactNode
  onVolver: () => void
  barra?: React.ReactNode
}) {
  return (
    <div className="pc-page">
      <div className="pc-shell">
        <header className="pc-topbar">
          <button type="button" className="pc-boton" onClick={onVolver}>
            <ArrowLeft size={16} aria-hidden /> Dashboard
          </button>
          <ThemeToggle />
        </header>
        <div className="pc-cabecera">
          <div className="pc-min0">
            <h1 className="pc-titulo">Panel de control</h1>
            <p className="pc-lead">Los 8 procesos de la revisión diaria, leídos en vivo cada 30 segundos.</p>
          </div>
          {barra}
        </div>
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
  const fmt = (d: Date, seg = true) =>
    d.toLocaleTimeString('es-MX', {
      timeZone: 'America/Monterrey',
      hour: '2-digit',
      minute: '2-digit',
      ...(seg ? { second: '2-digit' } : {}),
      hour12: false,
    })
  return (
    <div className="pc-reloj">
      <div className="pc-reloj-hora" aria-label="Hora actual">
        {fmt(new Date(ahora))}
      </div>
      <div className="pc-reloj-info">
        <span>Última lectura {leidoEn ? fmt(new Date(leidoEn)) : '—'}</span>
        <span>{leyendo ? 'Leyendo…' : `Siguiente en ${faltan} s`}</span>
      </div>
      <button type="button" className="pc-boton" onClick={onLeer} disabled={leyendo}>
        <RefreshCw size={16} aria-hidden className={leyendo ? 'pc-girando' : undefined} />
        Leer ahora
      </button>
    </div>
  )
}

const MARCAS = [0, 20, 40, 60, 80, 100]

function zonas(m: MedidorProceso): { desde: number; hasta: number; estado: EstadoMedidor }[] {
  const [a, b] = m.umbrales
  return m.sentido === 'alto-bueno'
    ? [
        { desde: 0, hasta: a, estado: 'alarma' },
        { desde: a, hasta: b, estado: 'precaucion' },
        { desde: b, hasta: 100, estado: 'normal' },
      ]
    : [
        { desde: 0, hasta: a, estado: 'normal' },
        { desde: a, hasta: b, estado: 'precaucion' },
        { desde: b, hasta: 100, estado: 'alarma' },
      ]
}

function Medidor({ m, cargando }: { m: MedidorProceso; cargando: boolean }) {
  const valor = m.valor == null ? null : Math.max(0, Math.min(100, m.valor))
  const zona = estadoPorValor(valor, m.sentido, m.umbrales)
  return (
    <article className="pc-medidor" data-estado={m.estado} data-cargando={cargando || undefined}>
      <header className="pc-placa">
        <span className="pc-lampara" data-estado={m.estado} aria-hidden />
        <h2>{m.nombre}</h2>
        <span className="pc-placa-estado">{cargando ? '' : ETIQUETA_ESTADO[m.estado]}</span>
      </header>

      <div className="pc-cuerpo">
        <div
          className="pc-instrumento"
          role="meter"
          aria-label={`${m.nombre}: ${m.mide}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={valor ?? undefined}
          aria-valuetext={valor == null ? 'Sin lectura' : `${valor}%, ${ETIQUETA_ESTADO[zona]}`}
        >
          <div className="pc-escala" aria-hidden>
            {MARCAS.map((v) => (
              <span key={v} style={{ bottom: `${v}%` }}>
                {v}
              </span>
            ))}
          </div>
          <div className="pc-franjas" aria-hidden>
            {zonas(m).map((z) => (
              <span
                key={z.estado}
                data-zona={z.estado}
                style={{ bottom: `${z.desde}%`, height: `${Math.max(0, z.hasta - z.desde)}%` }}
              />
            ))}
          </div>
          <div className="pc-tubo" aria-hidden>
            <div className="pc-rayas" />
            <div className="pc-columna" data-zona={zona} style={{ height: `${valor ?? 0}%` }} />
            {valor != null ? <div className="pc-aguja" data-zona={zona} style={{ bottom: `${valor}%` }} /> : null}
          </div>
        </div>

        <div className="pc-datos pc-min0">
          <div className="pc-digital" data-zona={zona}>
            <span className="pc-digital-valor">{valor == null ? '- - -' : valor}</span>
            {valor == null ? null : <span className="pc-digital-unidad">%</span>}
          </div>
          {m.mide ? <p className="pc-mide">{m.mide}</p> : null}
          {m.detalle.length ? (
            <ul className="pc-detalle">
              {m.detalle.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          {m.motivo ? <p className="pc-motivo">{m.motivo}</p> : null}
        </div>
      </div>
    </article>
  )
}
