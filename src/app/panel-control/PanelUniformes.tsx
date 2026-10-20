'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Shirt } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  PANEL_CONTROL_REFRESCO_MS,
  UMBRALES_SALUD,
  estadoPorValor,
  type EstadoMedidor,
  type MedidorProceso,
} from '@/lib/panelControl/tipos'
import type { PanelUniformesRespuesta } from '@/lib/panelControl/uniformes'
import './panel-uniformes.css'
import { Electro } from './Instrumentos'
import ModalAnalisis from './ModalAnalisis'

/** Banco de Uniformes: zona propia debajo del panel de Servicios, con su lectura y su detalle. */

const MEDIDORES: [string, string, string][] = [
  ['u-uso', 'Uso', 'Ventas y operaciones'],
  ['u-stock', 'Stock', 'Existencias'],
  ['u-funciones', 'Funciones', 'Venta y auditoría'],
  ['u-eficiencia', 'Eficiencia', 'Base e índices'],
  ['u-enlace', 'Enlace', 'Vercel y Winston'],
  ['u-almacenamiento', 'Almacenamiento', 'Base y storage'],
]

const INFRA: Record<string, string> = Object.fromEntries(MEDIDORES.map(([id, , infra]) => [id, infra]))

const PLACEHOLDER: MedidorProceso[] = MEDIDORES.map(([id, nombre]) => ({
  id,
  nombre,
  mide: '',
  valor: null,
  estado: 'sin-dato',
  piezas: [],
  resumen: 'Leyendo…',
}))

const ZONAS: { desde: number; hasta: number; estado: EstadoMedidor }[] = [
  { desde: 0, hasta: UMBRALES_SALUD[0], estado: 'alarma' },
  { desde: UMBRALES_SALUD[0], hasta: UMBRALES_SALUD[1], estado: 'precaucion' },
  { desde: UMBRALES_SALUD[1], hasta: 100, estado: 'normal' },
]

const MARCAS = [0, UMBRALES_SALUD[0], UMBRALES_SALUD[1], 100]

export default function PanelUniformes() {
  const [datos, setDatos] = useState<PanelUniformesRespuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [analisis, setAnalisis] = useState<{ id: string; codigo: string } | null>(null)
  const cerrarAnalisis = useCallback(() => setAnalisis(null), [])
  const enCurso = useRef(false)

  const leer = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    try {
      const res = await fetch('/api/panel-control/uniformes', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: portalSessionFetchHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo leer el panel de Uniformes.')
      setDatos(json as PanelUniformesRespuesta)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el panel de Uniformes.')
    } finally {
      enCurso.current = false
    }
  }, [])

  useEffect(() => {
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
  }, [leer])

  const medidores = useMemo(() => (datos?.medidores.length ? datos.medidores : PLACEHOLDER), [datos])
  const conProblema = medidores
    .filter((m) => m.estado === 'alarma' || m.estado === 'precaucion')
    .sort((a, b) => (a.valor ?? 100) - (b.valor ?? 100))
  const seleccionado = medidores.find((m) => m.id === elegido) ?? conProblema[0] ?? medidores[0]
  const general: EstadoMedidor = !datos
    ? 'sin-dato'
    : conProblema.some((m) => m.estado === 'alarma')
      ? 'alarma'
      : conProblema.length
        ? 'precaucion'
        : 'normal'

  return (
    <section className="pu-zona" aria-labelledby="pu-titulo">
      <header className="pu-cabeza">
        <span className="pu-insignia" aria-hidden>
          <Shirt size={22} strokeWidth={2.2} />
        </span>
        <div className="pc-min0">
          <h2 id="pu-titulo" className="pu-titulo">
            Uniformes
          </h2>
          <p className="pu-sub">Sistema de uniformes en Winston Servicios · lo vigila Connor</p>
        </div>
        <span className="pu-estado" data-estado={general}>
          <span className="pc-lampara" data-estado={general} aria-hidden />
          {general === 'sin-dato'
            ? 'Leyendo'
            : general === 'normal'
              ? 'En verde'
              : general === 'alarma'
                ? 'Alarma'
                : 'Atención'}
        </span>
      </header>

      <div className="pu-franja" data-estado={general} aria-live="polite">
        {general === 'sin-dato' ? (
          'Leyendo Uniformes…'
        ) : conProblema.length ? (
          <ul className="pc-general-lista">
            {conProblema.slice(0, 3).map((m) => (
              <li key={m.id}>
                <b>{m.nombre}</b> · {m.resumen}
              </li>
            ))}
          </ul>
        ) : (
          `${medidores.length} de ${medidores.length} medidores en verde: vende, cuadra su stock, sus funciones y su enlace responden, y tiene espacio de sobra.`
        )}
      </div>

      <Electro
        estado={general}
        etiqueta="Pulso de Uniformes"
        detalle={datos ? `${medidores.length} señales · ventas, stock y enlace` : 'Conectando…'}
      />

      {error ? (
        <p className="pc-error" role="alert">
          {error} {datos ? 'Se muestran las últimas lecturas.' : ''}
        </p>
      ) : null}

      <div className="pu-kpis">
        {(datos?.kpis.length ? datos.kpis : KPIS_VACIOS).map((k) => (
          <div key={k.id} className="pu-kpi">
            <span className="pu-kpi-etiqueta">{k.etiqueta}</span>
            <span className="pu-kpi-valor">{k.valor}</span>
            <span className="pu-kpi-detalle">{k.detalle}</span>
          </div>
        ))}
      </div>

      <section className="pc-banco pu-banco" aria-label="Medidores de Uniformes">
        {medidores.map((m, i) => (
          <Medidor
            key={m.id}
            m={m}
            orden={i}
            codigo={`U-${String(i + 1).padStart(2, '0')}`}
            onAnalizar={setAnalisis}
            cargando={!datos}
            elegido={m.id === seleccionado?.id}
            onElegir={() => setElegido(m.id)}
          />
        ))}
      </section>

      {seleccionado && datos ? <Detalle m={seleccionado} /> : null}

      <p className="pc-leyenda">
        Uso, stock, funciones, eficiencia, enlace y almacenamiento de Uniformes, leídos de la base Winston Servicios y
        de Vercel sin tocar la app. Manda la pieza más débil; toca un medidor para ver su análisis.
      </p>

      {analisis && datos
        ? (() => {
            const m = medidores.find((x) => x.id === analisis.id)
            return m ? (
              <ModalAnalisis
                m={{ ...m, nombre: `Uniformes · ${m.nombre}` }}
                codigo={analisis.codigo}
                leidoEn={datos.leidoEn}
                acento="acero"
                onCerrar={cerrarAnalisis}
              />
            ) : null
          })()
        : null}
    </section>
  )
}

const KPIS_VACIOS = [
  { id: 'ventas', etiqueta: 'Ventas hoy', valor: '- - -', detalle: ' ' },
  { id: 'stock', etiqueta: 'Movimientos de stock', valor: '- - -', detalle: ' ' },
  { id: 'pendientes', etiqueta: 'Por entregar', valor: '- - -', detalle: ' ' },
  { id: 'espacio', etiqueta: 'Espacio en Winston', valor: '- - -', detalle: ' ' },
]

function Medidor({
  m,
  orden,
  codigo,
  cargando,
  elegido,
  onElegir,
  onAnalizar,
}: {
  m: MedidorProceso
  orden: number
  codigo: string
  onAnalizar: (a: { id: string; codigo: string }) => void
  cargando: boolean
  elegido: boolean
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
      aria-label={`Uniformes ${m.nombre}: ${valor == null ? 'sin lectura' : `${valor}%`}, ${m.resumen}`}
    >
      <span className="pc-placa">
        <span className="pc-lampara" data-estado={m.estado} aria-hidden />
        <span className="pc-placa-texto">
          <span className="pc-placa-nombre">{m.nombre}</span>
          <span className="pc-placa-infra">{INFRA[m.id]}</span>
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
    </button>
  )
}

function Detalle({ m }: { m: MedidorProceso }) {
  return (
    <section className="pc-detalle" data-estado={m.estado} aria-label={`Piezas de Uniformes ${m.nombre}`}>
      <header className="pc-detalle-cabeza">
        <h2>Uniformes · {m.nombre}</h2>
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
