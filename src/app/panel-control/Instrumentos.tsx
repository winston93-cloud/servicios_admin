'use client'

import { UMBRALES_SALUD, estadoPorValor, type EstadoMedidor } from '@/lib/panelControl/tipos'

/* Instrumentos de la cabina: tacómetro de carreras y electrocardiograma. Solo pintan datos ya leídos. */

const INICIO = 135
const BARRIDO = 270
const R = 78
const LARGO_ARCO = 2 * Math.PI * R * (BARRIDO / 360)

const ang = (v: number) => INICIO + (BARRIDO * Math.max(0, Math.min(100, v))) / 100
const punto = (r: number, grados: number) => {
  const rad = (grados * Math.PI) / 180
  return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)] as const
}
const arco = (r: number, desde: number, hasta: number) => {
  const [x1, y1] = punto(r, ang(desde))
  const [x2, y2] = punto(r, ang(hasta))
  const grande = ((hasta - desde) * BARRIDO) / 100 > 180 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

type Zona = { desde: number; hasta: number; estado: EstadoMedidor }

const ZONAS_SALUD: Zona[] = [
  { desde: 0, hasta: UMBRALES_SALUD[0], estado: 'alarma' },
  { desde: UMBRALES_SALUD[0], hasta: UMBRALES_SALUD[1], estado: 'precaucion' },
  { desde: UMBRALES_SALUD[1], hasta: 100, estado: 'normal' },
]

/** Zona roja al final, como el límite de un motor: para lo que preocupa cuando sube (conexiones en uso). */
export const ZONAS_LIMITE: Zona[] = [
  { desde: 0, hasta: 80, estado: 'normal' },
  { desde: 80, hasta: 90, estado: 'precaucion' },
  { desde: 90, hasta: 100, estado: 'alarma' },
]

const zonaDe = (v: number | null, zonas: Zona[]): EstadoMedidor =>
  v == null ? 'sin-dato' : (zonas.find((z) => v >= z.desde && v < z.hasta) ?? zonas[zonas.length - 1]).estado

const MARCAS = Array.from({ length: 21 }, (_, i) => i * 5)

export function Tacometro({
  valor,
  etiqueta,
  sub,
  lectura,
  unidad = '%',
  zonas = ZONAS_SALUD,
  grande = false,
  cargando = false,
}: {
  valor: number | null
  etiqueta: string
  sub?: string
  /** Texto del visor en lugar del número (p. ej. «128 ms»). */
  lectura?: string
  unidad?: string
  zonas?: Zona[]
  grande?: boolean
  cargando?: boolean
}) {
  const v = cargando || valor == null ? 0 : Math.max(0, Math.min(100, Math.round(valor)))
  const zona = cargando ? 'sin-dato' : zonas === ZONAS_SALUD ? estadoPorValor(valor) : zonaDe(valor, zonas)
  return (
    <figure
      className="pc-taco"
      data-grande={grande || undefined}
      data-zona={zona}
      aria-label={`${etiqueta}: ${valor == null || cargando ? 'sin lectura' : lectura ?? `${v}${unidad}`}`}
    >
      <svg viewBox="0 0 200 200" className="pc-taco-svg" aria-hidden>
        <circle cx="100" cy="100" r="97" className="pc-taco-bisel" />
        <circle cx="100" cy="100" r="90" className="pc-taco-cara" />
        {zonas.map((z) => (
          <path key={z.estado} d={arco(88, z.desde, z.hasta)} className="pc-taco-zona" data-zona={z.estado} />
        ))}
        <path d={arco(R, 0, 100)} className="pc-taco-pista" />
        <path
          d={arco(R, 0, 100)}
          className="pc-taco-valor"
          style={{ strokeDasharray: LARGO_ARCO, strokeDashoffset: LARGO_ARCO * (1 - v / 100) }}
        />
        {MARCAS.map((m) => {
          const mayor = m % 10 === 0
          const [x1, y1] = punto(mayor ? 60 : 64, ang(m))
          const [x2, y2] = punto(70, ang(m))
          return (
            <line
              key={m}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="pc-taco-marca"
              data-mayor={mayor || undefined}
              data-zona={zonaDe(m, zonas)}
            />
          )
        })}
        {MARCAS.filter((m) => m % 20 === 0 && m > 0 && m < 100).map((m) => {
          const [x, y] = punto(48, ang(m))
          return (
            <text key={m} x={x} y={y} className="pc-taco-num" textAnchor="middle" dominantBaseline="central">
              {m}
            </text>
          )
        })}
        <g className="pc-taco-aguja" style={{ transform: `rotate(${ang(v)}deg)` }}>
          <polygon points="100,96.5 172,100 100,103.5 88,100" />
        </g>
        <circle cx="100" cy="100" r="9" className="pc-taco-eje" />
        <circle cx="100" cy="100" r="3.5" className="pc-taco-eje-luz" />
        <text x="100" y="164" className="pc-taco-lectura" textAnchor="middle">
          {cargando || valor == null ? '- - -' : lectura ?? v}
          {!cargando && valor != null && !lectura ? <tspan className="pc-taco-unidad">{unidad}</tspan> : null}
        </text>
      </svg>
      <figcaption className="pc-taco-pie">
        <span className="pc-taco-etiqueta">{etiqueta}</span>
        {sub ? <span className="pc-taco-sub">{sub}</span> : null}
      </figcaption>
    </figure>
  )
}

const LATIDO = 'l30 0 q4 -6 8 0 l6 0 l3 4 l4 -26 l4 32 l3 -10 l10 0 q7 -10 14 0 l18 0'
const TRAZO = `M0 26 ${Array.from({ length: 6 }, () => LATIDO).join(' ')}`

/** Electrocardiograma de la infraestructura: late tranquilo en verde, rápido en ámbar y desbocado en rojo. */
export function Electro({ estado, etiqueta, detalle }: { estado: EstadoMedidor; etiqueta: string; detalle?: string }) {
  return (
    <div className="pc-ecg" data-estado={estado}>
      <div className="pc-ecg-rotulo">
        <span className="pc-ecg-etiqueta">{etiqueta}</span>
        {detalle ? <span className="pc-ecg-detalle">{detalle}</span> : null}
      </div>
      <div className="pc-ecg-pantalla" aria-hidden>
        <div className="pc-ecg-cinta">
          {[0, 1].map((i) => (
            <svg key={i} viewBox="0 0 600 40" preserveAspectRatio="none" className="pc-ecg-svg">
              <path d={TRAZO} />
            </svg>
          ))}
        </div>
      </div>
    </div>
  )
}
