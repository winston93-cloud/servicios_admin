'use client'

/**
 * 2026-10-10 — Cuestionario de Beneficios externos (vista del alumno).
 * Se usa en la página /beneficios-externos y en el popup del dashboard.
 * Flujo: ¿aplicó a una beca externa? → ¿cuál? → ¿ya la recibió? → subir documento.
 * No guarda respuestas ni toca el módulo de Becas.
 */

import { useState } from 'react'
import { Check, ChevronRight, ExternalLink, Gift, RotateCcw, Upload, X } from 'lucide-react'
import {
  OPCIONES_BENEFICIO_EXTERNO,
  urlSubirDocumentoBecaSep,
  type BeneficioExternoId,
} from '@/lib/beneficiosExternos/config'
import './beneficios-externos.css'

type Paso = 'aplico' | 'cual' | 'recibio' | 'subir' | 'sin-beca' | 'en-espera'

const PASOS_NUMERADOS: Paso[] = ['aplico', 'cual', 'recibio', 'subir']

function Opcion({
  activo,
  onClick,
  titulo,
  desc,
}: {
  activo: boolean
  onClick: () => void
  titulo: string
  desc?: string
}) {
  return (
    <button
      type="button"
      className={`bx-opcion${activo ? ' is-activa' : ''}`}
      aria-pressed={activo}
      onClick={onClick}
    >
      <span className="bx-opcion-check" aria-hidden>
        {activo ? <Check size={14} strokeWidth={2.5} /> : null}
      </span>
      <span>
        <strong>{titulo}</strong>
        {desc ? <small>{desc}</small> : null}
      </span>
    </button>
  )
}

const PASO_ETIQUETA: Record<Paso, string> = {
  aplico: 'Paso 1 de 4',
  cual: 'Paso 2 de 4',
  recibio: 'Paso 3 de 4',
  subir: 'Paso 4 de 4',
  'sin-beca': 'Listo',
  'en-espera': 'Pendiente',
}

/** 2026-10-10 — En el popup el encabezado imita las tarjetas del dashboard (kicker, badge, chips, cerrar). */
export default function Cuestionario({
  tituloId = 'bx-titulo',
  onCerrar,
}: {
  tituloId?: string
  onCerrar?: () => void
}) {
  const [paso, setPaso] = useState<Paso>('aplico')
  const [beneficio, setBeneficio] = useState<BeneficioExternoId | null>(null)
  const [otraNombre, setOtraNombre] = useState('')

  const opcion = OPCIONES_BENEFICIO_EXTERNO.find((o) => o.id === beneficio) ?? null
  const nombreBeneficio = beneficio === 'otra' ? otraNombre.trim() || 'beca externa' : opcion?.label ?? ''
  const cualListo = beneficio === 'sep' || (beneficio === 'otra' && otraNombre.trim().length >= 3)
  const indicePaso = PASOS_NUMERADOS.indexOf(paso)

  const reiniciar = () => {
    setPaso('aplico')
    setBeneficio(null)
    setOtraNombre('')
  }

  return (
    <section className={`bx-card${onCerrar ? ' bx-card--modulo' : ''}`} aria-labelledby={tituloId}>
      {onCerrar ? (
        <div className="bx-modulo-head">
          <span className="bx-modulo-icono" aria-hidden>
            <Gift size={24} strokeWidth={1.6} />
          </span>
          <div className="bx-modulo-cuerpo">
            <div className="bx-modulo-meta">
              <span className="bx-modulo-kicker">Vista del alumno</span>
              <span className="bx-modulo-badge">Prueba</span>
            </div>
            <h1 id={tituloId} className="bx-modulo-titulo">
              Beneficios externos
            </h1>
            <ul className="bx-modulo-tags" aria-label="Estado">
              <li>{PASO_ETIQUETA[paso]}</li>
              <li>Las respuestas no se guardan</li>
            </ul>
          </div>
          <button type="button" className="bx-modulo-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="bx-card-head">
          <span className="bx-icono" aria-hidden>
            <Gift size={22} strokeWidth={1.75} />
          </span>
          <div>
            <p className="bx-kicker">Servicios escolares</p>
            <h1 id={tituloId}>Beneficios externos</h1>
          </div>
        </div>
      )}

      {indicePaso >= 0 ? (
        <ol className="bx-progreso" aria-label="Avance">
          {PASOS_NUMERADOS.map((p, i) => (
            <li key={p} className={i < indicePaso ? 'is-hecho' : i === indicePaso ? 'is-actual' : ''} />
          ))}
        </ol>
      ) : null}

      {paso === 'aplico' ? (
        <div className="bx-paso">
          <h2>¿El alumno ha aplicado a alguna beca externa?</h2>
          <p className="bx-ayuda">
            Una beca externa es un apoyo que no otorga el Colegio, por ejemplo la Beca SEP para escuelas
            particulares.
          </p>
          <div className="bx-opciones bx-opciones--fila">
            <Opcion activo={false} titulo="Sí" onClick={() => setPaso('cual')} />
            <Opcion activo={false} titulo="No" onClick={() => setPaso('sin-beca')} />
          </div>
        </div>
      ) : null}

      {paso === 'cual' ? (
        <div className="bx-paso">
          <h2>¿A cuál beca aplicó?</h2>
          <div className="bx-opciones">
            {OPCIONES_BENEFICIO_EXTERNO.map((o) => (
              <Opcion
                key={o.id}
                activo={beneficio === o.id}
                titulo={o.label}
                desc={o.desc}
                onClick={() => setBeneficio(o.id)}
              />
            ))}
          </div>
          {beneficio === 'otra' ? (
            <label className="bx-campo">
              <span>Nombre de la beca o institución</span>
              <input
                type="text"
                value={otraNombre}
                maxLength={120}
                autoFocus
                placeholder="Ej. beca municipal, apoyo de la empresa…"
                onChange={(e) => setOtraNombre(e.target.value)}
              />
            </label>
          ) : null}
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={() => setPaso('aplico')}>
              Atrás
            </button>
            <button type="button" className="bx-btn" disabled={!cualListo} onClick={() => setPaso('recibio')}>
              Continuar
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {paso === 'recibio' ? (
        <div className="bx-paso">
          <h2>¿Ya recibió el beneficio de la {nombreBeneficio}?</h2>
          <p className="bx-ayuda">
            Por ejemplo, la carta o autorización donde aparece el porcentaje o el monto otorgado.
          </p>
          <div className="bx-opciones bx-opciones--fila">
            <Opcion activo={false} titulo="Sí, ya lo recibí" onClick={() => setPaso('subir')} />
            <Opcion activo={false} titulo="Todavía no" onClick={() => setPaso('en-espera')} />
          </div>
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={() => setPaso('cual')}>
              Atrás
            </button>
          </div>
        </div>
      ) : null}

      {paso === 'subir' ? (
        <div className="bx-paso">
          <h2>Suba el documento</h2>
          {beneficio === 'sep' ? (
            <>
              <p className="bx-ayuda">
                Suba la autorización de la Beca SEP en el portal de becas. Entre con el número de control del
                alumno y su contraseña del portal.
              </p>
              <a className="bx-btn bx-btn--grande" href={urlSubirDocumentoBecaSep()} target="_blank" rel="noopener noreferrer">
                <Upload size={18} aria-hidden />
                Ir a subir el documento
                <ExternalLink size={15} aria-hidden />
              </a>
            </>
          ) : (
            <p className="bx-ayuda">
              Por ahora, entregue una copia del documento de la <strong>{nombreBeneficio}</strong> en Control
              Escolar de su sección para que lo revisen.
            </p>
          )}
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={() => setPaso('recibio')}>
              Atrás
            </button>
          </div>
        </div>
      ) : null}

      {paso === 'sin-beca' ? (
        <div className="bx-paso bx-final">
          <h2>Gracias por responder</h2>
          <p className="bx-ayuda">
            No necesita hacer nada más. Si más adelante aplica a una beca externa, regrese a esta tarjeta.
          </p>
        </div>
      ) : null}

      {paso === 'en-espera' ? (
        <div className="bx-paso bx-final">
          <h2>Aún no hay nada que subir</h2>
          <p className="bx-ayuda">
            Cuando reciba el documento de la <strong>{nombreBeneficio}</strong>, regrese a esta tarjeta para
            subirlo.
          </p>
        </div>
      ) : null}

      {paso !== 'aplico' ? (
        <button type="button" className="bx-reiniciar" onClick={reiniciar}>
          <RotateCcw size={14} aria-hidden />
          Empezar de nuevo
        </button>
      ) : null}
    </section>
  )
}
