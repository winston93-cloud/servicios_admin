'use client'

/**
 * 2026-10-10 — Cuestionario de Beneficios externos (vista del alumno).
 * Se usa en la página /beneficios-externos y en el popup del dashboard.
 * Flujo: ¿aplicó a una beca externa? → ¿cuál? → ¿ya la recibió? → subir documento.
 * No guarda respuestas ni toca el módulo de Becas.
 */

import { useState } from 'react'
import { Check, ChevronRight, Gift, RotateCcw, Upload, X } from 'lucide-react'
import {
  OPCIONES_BENEFICIO_EXTERNO,
  urlSubirDocumentoBecaSep,
  type BeneficioExternoId,
} from '@/lib/beneficiosExternos/config'
import SubirDocumentoDemo from './SubirDocumentoDemo'
import './beneficios-externos.css'

// 2026-10-10 — 'documento': vista previa de la página de subida dentro del mismo popup.
type Paso = 'aplico' | 'cual' | 'recibio' | 'subir' | 'documento' | 'sin-beca' | 'en-espera'

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
  documento: 'Paso 4 de 4',
  'sin-beca': 'Listo',
  'en-espera': 'Pendiente',
}

type Respuesta = { aplico: boolean; beneficio?: BeneficioExternoId | null; beneficioNombre?: string; recibio?: boolean }

/**
 * 2026-10-10 — En el popup el encabezado imita las tarjetas del dashboard (kicker, badge, chips, cerrar).
 * 2026-10-12 — `guardar`: cuando lo contesta un alumno, la respuesta final se guarda para contar cuántas
 *              familias aplicaron a una beca externa. La vista previa del personal no guarda nada.
 */
export default function Cuestionario({
  tituloId = 'bx-titulo',
  onCerrar,
  guardar = false,
}: {
  tituloId?: string
  onCerrar?: () => void
  guardar?: boolean
}) {
  const [paso, setPaso] = useState<Paso>('aplico')
  const [beneficio, setBeneficio] = useState<BeneficioExternoId | null>(null)
  const [otraNombre, setOtraNombre] = useState('')
  const [guardado, setGuardado] = useState<'no' | 'guardando' | 'listo' | 'error'>('no')
  const [ultima, setUltima] = useState<Respuesta | null>(null)

  const enviarRespuesta = async (r: Respuesta) => {
    if (!guardar) return
    setUltima(r)
    setGuardado('guardando')
    try {
      const res = await fetch('/api/beneficios-externos/respuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(r),
      })
      setGuardado(res.ok ? 'listo' : 'error')
    } catch {
      setGuardado('error')
    }
  }

  const responder = (siguiente: Paso, r: Respuesta) => {
    setPaso(siguiente)
    void enviarRespuesta(r)
  }

  const respuestaBeneficio = (recibio: boolean): Respuesta => ({
    aplico: true,
    beneficio,
    beneficioNombre: beneficio === 'otra' ? otraNombre.trim() : undefined,
    recibio,
  })

  const opcion = OPCIONES_BENEFICIO_EXTERNO.find((o) => o.id === beneficio) ?? null
  const nombreBeneficio = beneficio === 'otra' ? otraNombre.trim() || 'beca externa' : opcion?.label ?? ''
  const cualListo = beneficio === 'sep' || (beneficio === 'otra' && otraNombre.trim().length >= 3)
  const indicePaso = PASOS_NUMERADOS.indexOf(paso === 'documento' ? 'subir' : paso)

  const reiniciar = () => {
    setPaso('aplico')
    setBeneficio(null)
    setOtraNombre('')
    setGuardado('no')
  }

  const etiquetaGuardado = !guardar
    ? 'Las respuestas no se guardan'
    : guardado === 'guardando'
      ? 'Guardando…'
      : guardado === 'listo'
        ? 'Respuesta guardada'
        : null

  return (
    <section className={`bx-card${onCerrar ? ' bx-card--modulo' : ''}`} aria-labelledby={tituloId}>
      {onCerrar ? (
        <div className="bx-modulo-head">
          <span className="bx-modulo-icono" aria-hidden>
            <Gift size={24} strokeWidth={1.6} />
          </span>
          <div className="bx-modulo-cuerpo">
            <div className="bx-modulo-meta">
              <span className="bx-modulo-kicker">{guardar ? 'Servicios escolares' : 'Vista del alumno'}</span>
              {guardar ? null : <span className="bx-modulo-badge">Prueba</span>}
            </div>
            <h1 id={tituloId} className="bx-modulo-titulo">
              Beneficios externos
            </h1>
            <ul className="bx-modulo-tags" aria-label="Estado">
              <li>{PASO_ETIQUETA[paso]}</li>
              {etiquetaGuardado ? <li>{etiquetaGuardado}</li> : null}
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

      {guardado === 'error' && ultima ? (
        <div className="bx-alerta bx-alerta--aviso" role="alert">
          <p>
            No se pudo guardar su respuesta.
            <button type="button" className="bx-btn bx-btn--ghost" onClick={() => void enviarRespuesta(ultima)}>
              Intentar de nuevo
            </button>
          </p>
        </div>
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
            <Opcion activo={false} titulo="No" onClick={() => responder('sin-beca', { aplico: false })} />
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
            <Opcion activo={false} titulo="Sí, ya lo recibí" onClick={() => responder('subir', respuestaBeneficio(true))} />
            <Opcion activo={false} titulo="Todavía no" onClick={() => responder('en-espera', respuestaBeneficio(false))} />
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
          <p className="bx-ayuda">
            {beneficio === 'sep' ? (
              'Suba la autorización de la Beca SEP que le entregó la SEP. Control Escolar la revisará y aplicará la beca.'
            ) : (
              <>
                Suba la carta o autorización de la <strong>{nombreBeneficio}</strong> para que Control Escolar la
                revise.
              </>
            )}
          </p>
          {/* 2026-10-12 — Beca SEP abre la página real del portal de becas en otra pestaña;
              otra beca sigue con la vista previa en el popup (aún no hay página real). */}
          {beneficio === 'sep' ? (
            <a
              className="bx-btn bx-btn--grande"
              href={urlSubirDocumentoBecaSep()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Upload size={18} aria-hidden />
              Ir a subir mi documento
            </a>
          ) : (
            <button type="button" className="bx-btn bx-btn--grande" onClick={() => setPaso('documento')}>
              <Upload size={18} aria-hidden />
              Ir a subir mi documento
            </button>
          )}
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={() => setPaso('recibio')}>
              Atrás
            </button>
          </div>
        </div>
      ) : null}

      {paso === 'documento' && beneficio ? (
        <SubirDocumentoDemo
          beneficio={beneficio}
          nombreBeneficio={nombreBeneficio}
          onAtras={() => setPaso('subir')}
        />
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
