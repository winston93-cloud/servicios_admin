'use client'

/**
 * 2026-10-10 — Vista previa de la página de subida de documentos (igual al portal de becas /sep).
 * El archivo se queda en el navegador: no se lee, no se envía y no se guarda nada.
 */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, Loader2, Send, Upload } from 'lucide-react'
import {
  AVISO_OTRAS_BECAS_SEP,
  MAX_BYTES_DOCUMENTO_EXTERNO,
  MAX_MB_DOCUMENTO_EXTERNO,
  MENSAJE_LIMITE_DOCUMENTO_EXTERNO,
  TIPOS_DOCUMENTO_EXTERNO,
  type BeneficioExternoId,
} from '@/lib/beneficiosExternos/config'

type Fase = 'elegir' | 'aviso' | 'subiendo' | 'revisado' | 'enviado'

type ArchivoElegido = { nombre: string; tamano: number }

const tamanoLegible = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export default function SubirDocumentoDemo({
  beneficio,
  nombreBeneficio,
  onAtras,
}: {
  beneficio: BeneficioExternoId
  nombreBeneficio: string
  onAtras: () => void
}) {
  const esSep = beneficio === 'sep'
  const [fase, setFase] = useState<Fase>('elegir')
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (fase !== 'subiendo') return
    const t = window.setTimeout(() => setFase('revisado'), 1400)
    return () => window.clearTimeout(t)
  }, [fase])

  const recibir = (f: File | null | undefined) => {
    if (!f) return
    if (!(TIPOS_DOCUMENTO_EXTERNO as readonly string[]).includes(f.type)) {
      setError('Solo se reciben archivos PDF, JPG o PNG.')
      return
    }
    if (f.size > MAX_BYTES_DOCUMENTO_EXTERNO) {
      setError(MENSAJE_LIMITE_DOCUMENTO_EXTERNO)
      return
    }
    setError(null)
    setArchivo({ nombre: f.name, tamano: f.size })
    setAcepta(false)
    setFase(esSep ? 'aviso' : 'subiendo')
  }

  const elegir = (e: ChangeEvent<HTMLInputElement>) => {
    recibir(e.target.files?.[0])
    e.target.value = ''
  }

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
    recibir(e.dataTransfer.files?.[0])
  }

  const descartar = () => {
    setArchivo(null)
    setAcepta(false)
    setFase('elegir')
  }

  const titulo = esSep ? 'Documento de autorización SEP' : `Documento de la ${nombreBeneficio}`

  return (
    <div className="bx-paso bx-subida">
      <div className="bx-subida-head">
        <span className="bx-subida-icono" aria-hidden>
          <FileCheck2 size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2>{titulo}</h2>
          <p className="bx-subida-nota">Vista previa · el archivo no sale de tu computadora ni se guarda.</p>
        </div>
      </div>

      {fase === 'elegir' ? (
        <>
          <p className="bx-ayuda">
            {esSep
              ? 'El documento que le entregó la SEP con el nombre del alumno y el porcentaje de beca autorizado.'
              : 'La carta o autorización donde aparezca el nombre del alumno y el porcentaje o monto otorgado.'}{' '}
            PDF, JPG o PNG de <strong>máximo {MAX_MB_DOCUMENTO_EXTERNO} MB</strong>; no se reciben archivos más pesados.
          </p>
          <input
            ref={input}
            type="file"
            accept={TIPOS_DOCUMENTO_EXTERNO.join(',')}
            className="bx-sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={elegir}
          />
          <div
            className={`bx-dropzone${arrastrando ? ' is-arrastrando' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
          >
            <Upload size={26} strokeWidth={1.6} aria-hidden />
            <p>
              <strong>Arrastre aquí el documento</strong>
              <span>o elíjalo desde su equipo o celular</span>
            </p>
            <button type="button" className="bx-btn" onClick={() => input.current?.click()}>
              <Upload size={16} aria-hidden />
              Elegir y subir documento
            </button>
          </div>
          <p className="bx-subida-tip">Si toma foto: de frente, con buena luz, sin sombras y que se vea la hoja completa.</p>
          {error ? (
            <p className="bx-alerta bx-alerta--aviso" role="alert">
              <AlertTriangle size={16} aria-hidden />
              {error}
            </p>
          ) : null}
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={onAtras}>
              Atrás
            </button>
          </div>
        </>
      ) : null}

      {fase === 'aviso' && archivo ? (
        <div className="bx-aviso" role="alertdialog" aria-labelledby="bx-aviso-titulo">
          <p className="bx-aviso-eyebrow">
            <AlertTriangle size={15} aria-hidden />
            Antes de subir el documento
          </p>
          <h3 id="bx-aviso-titulo">¿Está seguro de cambiar a la beca SEP?</h3>
          <p>
            Al agregar la beca SEP, su hijo(a) perderá el beneficio de <strong>cualquier otra beca</strong> que tenga
            actualmente en el colegio. Las becas no se suman.
          </p>
          <p>
            Además, la beca que pierda <strong>no se renovará</strong> el próximo ciclo escolar: si la quiere de nuevo,
            deberá solicitarla otra vez como solicitud nueva.
          </p>
          <label className="bx-check">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
            <span>{AVISO_OTRAS_BECAS_SEP}</span>
          </label>
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={descartar}>
              Cancelar
            </button>
            <button type="button" className="bx-btn" disabled={!acepta} onClick={() => setFase('subiendo')}>
              Sí, subir documento
            </button>
          </div>
        </div>
      ) : null}

      {fase === 'subiendo' && archivo ? (
        <p className="bx-subiendo" role="status">
          <Loader2 size={18} className="bx-girando" aria-hidden />
          Subiendo y revisando {archivo.nombre}…
        </p>
      ) : null}

      {fase === 'revisado' && archivo ? (
        <>
          <div className="bx-alerta bx-alerta--ok">
            <CheckCircle2 size={18} aria-hidden />
            <div>
              <strong>Documento recibido</strong>
              <p>
                <FileText size={14} aria-hidden /> {archivo.nombre} · {tamanoLegible(archivo.tamano)}
              </p>
              <p className="bx-subida-nota">
                En el portal real aquí aparece la revisión automática: nombre del alumno y porcentaje de beca
                detectados en el documento.
              </p>
            </div>
          </div>
          <div className="bx-acciones">
            <button type="button" className="bx-btn bx-btn--ghost" onClick={descartar}>
              Elegir otro documento
            </button>
            <button type="button" className="bx-btn" onClick={() => setFase('enviado')}>
              <Send size={16} aria-hidden />
              Enviar a Control Escolar
            </button>
          </div>
        </>
      ) : null}

      {fase === 'enviado' ? (
        <div className="bx-alerta bx-alerta--ok">
          <CheckCircle2 size={18} aria-hidden />
          <div>
            <strong>En revisión de Control Escolar</strong>
            <p>
              Control Escolar revisará el documento y aplicará la beca. No necesita mandar nada por correo.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
