'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  ARCHIVOS_PAGO_EFECTIVO,
  type ArchivoPagoEfectivo,
  type MotivoOmision,
  type ResumenArchivoPagoEfectivo,
  type ResultadoCargaPagosEfectivo,
} from '@/lib/actualizarPagosEfectivo'
import { obtenerUltimaActualizacionPagos } from '@/lib/pagoColegiaturaService'

const ETIQUETA_MOTIVO: Record<MotivoOmision, string> = {
  encabezado_exportar: 'Encabezado «Exportar a»',
  encabezado_factura: 'Encabezado FACTURA',
  encabezado_num_factura: 'Encabezado NumFactura',
  fila_vacia: 'Fila vacía',
  referencia_tipo_3: 'Referencia tipo 3 (omitida por regla)',
  cargo_cuenta_cheques: 'Cargo a cuenta cheques',
  duplicado: 'Pago duplicado (ya registrado)',
  alumno_no_encontrado: 'Alumno no encontrado',
  columnas_insuficientes: 'Columnas inválidas',
  fecha_invalida: 'Fecha inválida',
  referencia_invalida: 'Referencia inválida',
}

type ArchivoLocal = {
  id: string
  file: File
  nombreEsperado: ArchivoPagoEfectivo | null
  valido: boolean
  error?: string
}

type EstadoCarga = 'idle' | 'subiendo' | 'listo' | 'error'

function formatearBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase()
}

function validarArchivo(file: File): Pick<ArchivoLocal, 'nombreEsperado' | 'valido' | 'error'> {
  const norm = normalizarNombre(file.name)
  if (!(ARCHIVOS_PAGO_EFECTIVO as readonly string[]).includes(norm)) {
    return {
      nombreEsperado: null,
      valido: false,
      error: `Nombre no permitido. Use: ${ARCHIVOS_PAGO_EFECTIVO.join(' o ')}`,
    }
  }
  if (!file.name.toLowerCase().endsWith('.txt')) {
    return {
      nombreEsperado: norm as ArchivoPagoEfectivo,
      valido: false,
      error: 'El archivo debe ser .txt',
    }
  }
  if (file.size === 0) {
    return {
      nombreEsperado: norm as ArchivoPagoEfectivo,
      valido: false,
      error: 'El archivo está vacío',
    }
  }
  return { nombreEsperado: norm as ArchivoPagoEfectivo, valido: true }
}

function TarjetaResumenArchivo({ resumen }: { resumen: ResumenArchivoPagoEfectivo }) {
  const [expandido, setExpandido] = useState(false)
  const motivos = Object.entries(resumen.omisionesPorMotivo).filter(([, n]) => (n ?? 0) > 0)

  return (
    <article className={`ap-archivo-card ${resumen.errores > 0 ? 'ap-archivo-card--warn' : ''}`}>
      <header className="ap-archivo-card-head">
        <div className="ap-archivo-card-titulo">
          <FileText size={18} aria-hidden />
          <span>{resumen.archivo}</span>
          <span className="ap-badge ap-badge--tipo">{resumen.tipo}</span>
        </div>
        <button
          type="button"
          className="ap-btn-ghost"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
        >
          {expandido ? (
            <>
              Ocultar detalle <ChevronUp size={16} aria-hidden />
            </>
          ) : (
            <>
              Ver detalle <ChevronDown size={16} aria-hidden />
            </>
          )}
        </button>
      </header>

      <div className="ap-stats-grid">
        <div className="ap-stat ap-stat--ok">
          <span className="ap-stat-valor">{resumen.insertados}</span>
          <span className="ap-stat-etiqueta">Insertados</span>
        </div>
        <div className="ap-stat ap-stat--info">
          <span className="ap-stat-valor">{resumen.actualizados}</span>
          <span className="ap-stat-etiqueta">Actualizados</span>
        </div>
        <div className="ap-stat ap-stat--muted">
          <span className="ap-stat-valor">{resumen.omitidos}</span>
          <span className="ap-stat-etiqueta">Omitidos</span>
        </div>
        <div className={`ap-stat ${resumen.errores > 0 ? 'ap-stat--err' : 'ap-stat--muted'}`}>
          <span className="ap-stat-valor">{resumen.errores}</span>
          <span className="ap-stat-etiqueta">Errores</span>
        </div>
      </div>

      <p className="ap-archivo-meta">
        {resumen.lineasLeidas} líneas leídas · {resumen.filasProcesables} procesables
        {resumen.alumnosActivados > 0 && (
          <> · {resumen.alumnosActivados} alumnos activados por inscripción</>
        )}
      </p>

      {expandido && (
        <div className="ap-archivo-detalle">
          {motivos.length > 0 && (
            <div className="ap-omisiones">
              <h4 className="ap-subtitulo">Omisiones por motivo</h4>
              <ul className="ap-omisiones-lista">
                {motivos.map(([motivo, count]) => (
                  <li key={motivo}>
                    <span>{ETIQUETA_MOTIVO[motivo as MotivoOmision] ?? motivo}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumen.muestras.length > 0 && (
            <div className="ap-tabla-wrap">
              <h4 className="ap-subtitulo">
                Muestra de movimientos ({resumen.muestras.length}
                {resumen.muestras.length >= 80 ? ', máximo mostrado' : ''})
              </h4>
              <table className="ap-tabla">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Control</th>
                    <th>Referencia</th>
                    <th>Nombre</th>
                    <th>Acción</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.muestras.map((m, i) => (
                    <tr key={`${m.linea}-${i}`} className={`ap-fila ap-fila--${m.accion}`}>
                      <td>{m.linea}</td>
                      <td>{m.alumnoRef}</td>
                      <td className="ap-ref">{m.referencia}</td>
                      <td>{m.nombre}</td>
                      <td>
                        <span className={`ap-pill ap-pill--${m.accion}`}>{m.accion}</span>
                      </td>
                      <td>{m.detalle ?? m.motivo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default function ActualizarPagosModulo() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivos, setArchivos] = useState<ArchivoLocal[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [estado, setEstado] = useState<EstadoCarga>('idle')
  const [resultado, setResultado] = useState<
    (ResultadoCargaPagosEfectivo & { rechazados?: string[]; faltantes?: string[]; advertenciaFaltantes?: string | null }) | null
  >(null)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)

  const cargarUltimaActualizacion = useCallback(async () => {
    const u = await obtenerUltimaActualizacionPagos()
    setUltimaActualizacion(u)
  }, [])

  useEffect(() => {
    void cargarUltimaActualizacion()
  }, [cargarUltimaActualizacion])

  const archivosValidos = useMemo(
    () => archivos.filter((a) => a.valido && a.nombreEsperado),
    [archivos]
  )

  const nombresPresentes = useMemo(
    () => new Set(archivosValidos.map((a) => a.nombreEsperado!)),
    [archivosValidos]
  )

  const faltanArchivos = useMemo(
    () => ARCHIVOS_PAGO_EFECTIVO.filter((n) => !nombresPresentes.has(n)),
    [nombresPresentes]
  )

  const puedeProcesar = archivosValidos.length > 0 && estado !== 'subiendo'

  const agregarArchivos = useCallback((lista: FileList | File[]) => {
    const nuevos: ArchivoLocal[] = []
    for (const file of Array.from(lista)) {
      const v = validarArchivo(file)
      nuevos.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        ...v,
      })
    }
    setArchivos((prev) => {
      const mapa = new Map<string, ArchivoLocal>()
      for (const a of prev) {
        if (a.nombreEsperado) mapa.set(a.nombreEsperado, a)
      }
      for (const n of nuevos) {
        if (n.nombreEsperado && n.valido) mapa.set(n.nombreEsperado, n)
        else if (!n.nombreEsperado) mapa.set(n.id, n)
      }
      return Array.from(mapa.values())
    })
    setResultado(null)
    setErrorGlobal(null)
  }, [])

  const quitarArchivo = useCallback((id: string) => {
    setArchivos((prev) => prev.filter((a) => a.id !== id))
    setResultado(null)
  }, [])

  const limpiarTodo = useCallback(() => {
    setArchivos([])
    setResultado(null)
    setErrorGlobal(null)
    setEstado('idle')
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const procesar = useCallback(async () => {
    if (!archivosValidos.length) return
    setEstado('subiendo')
    setErrorGlobal(null)
    setResultado(null)

    const formData = new FormData()
    for (const a of archivosValidos) {
      formData.append('file', a.file, a.nombreEsperado!)
    }

    try {
      const res = await fetch('/api/actualizar-pagos', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setEstado('error')
        let msg = (data.error as string) ?? `Error HTTP ${res.status}`
        if (Array.isArray(data.rechazados) && data.rechazados.length) {
          msg += `\nRechazados: ${data.rechazados.join(', ')}`
        }
        setErrorGlobal(msg)
        return
      }
      setResultado(data)
      setEstado(data.ok ? 'listo' : 'error')
      await cargarUltimaActualizacion()
    } catch (e) {
      setEstado('error')
      setErrorGlobal(e instanceof Error ? e.message : 'Error de red al procesar')
    }
  }, [archivosValidos, cargarUltimaActualizacion])

  return (
    <div className="servicios-panel-inner ap-modulo">
      <header className="ap-encabezado">
        <div className="ap-encabezado-icono" aria-hidden>
          <RefreshCw size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="ap-titulo">Actualizar pagos en efectivo</h1>
          {ultimaActualizacion && (
            <p className="ap-ultima-db">
              Último movimiento en base de datos: <strong>{ultimaActualizacion}</strong>
            </p>
          )}
        </div>
      </header>

      <section
        className={`ap-carga-bar ${arrastrando ? 'ap-carga-bar--over' : ''}`}
        aria-label="Carga de archivos de pago en efectivo"
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          if (e.dataTransfer.files.length) agregarArchivos(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          multiple
          className="ap-input-file-hidden"
          onChange={(e) => {
            if (e.target.files?.length) agregarArchivos(e.target.files)
          }}
        />

        <div className="ap-carga-bar__col ap-carga-bar__col--texto">
          <p className="ap-carga-bar__desc">
            Carga los archivos del banco con pagos en ventanilla. Se registran en{' '}
            <code>pago_detalle</code> con la misma lógica del sistema anterior.
          </p>
        </div>

        <div className="ap-carga-bar__col ap-carga-bar__col--arrastre">
          <Upload className="ap-carga-bar__icono" size={26} strokeWidth={1.25} aria-hidden />
          <span className="ap-carga-bar__arrastre-txt">Arrastra los archivos .txt aquí</span>
        </div>

        <div className="ap-carga-bar__col ap-carga-bar__col--btn">
          <button
            type="button"
            className="ap-btn ap-btn--secundario"
            onClick={() => inputRef.current?.click()}
          >
            Elegir archivos
          </button>
        </div>
      </section>

      {archivos.length > 0 && (
        <ul className="ap-archivos-lista">
          {archivos.map((a) => (
            <li key={a.id} className={a.valido ? 'ap-archivo-item--ok' : 'ap-archivo-item--err'}>
              <FileText size={18} aria-hidden />
              <div className="ap-archivo-item-body">
                <span className="ap-archivo-nombre">{a.file.name}</span>
                <span className="ap-archivo-meta">{formatearBytes(a.file.size)}</span>
                {a.error && <span className="ap-archivo-error">{a.error}</span>}
              </div>
              <button
                type="button"
                className="ap-btn-icon"
                aria-label={`Quitar ${a.file.name}`}
                onClick={() => quitarArchivo(a.id)}
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {faltanArchivos.length > 0 && archivosValidos.length > 0 && (
        <p className="ap-aviso-parcial" role="status">
          <AlertCircle size={16} aria-hidden />
          Aún faltan: {faltanArchivos.join(', ')}. Puedes procesar solo los cargados.
        </p>
      )}

      <div className="ap-acciones">
        <button
          type="button"
          className="ap-btn ap-btn--primario"
          disabled={!puedeProcesar}
          onClick={() => void procesar()}
        >
          {estado === 'subiendo' ? (
            <>
              <Loader2 className="ap-spin" size={18} aria-hidden />
              Procesando…
            </>
          ) : (
            <>
              <RefreshCw size={18} aria-hidden />
              Actualizar pagos
            </>
          )}
        </button>
        <button
          type="button"
          className="ap-btn ap-btn--ghost"
          disabled={estado === 'subiendo'}
          onClick={limpiarTodo}
        >
          Limpiar
        </button>
      </div>

      {errorGlobal && (
        <div className="ap-alerta ap-alerta--error" role="alert">
          <AlertCircle size={18} aria-hidden />
          <pre className="ap-alerta-texto">{errorGlobal}</pre>
        </div>
      )}

      {resultado && (
        <section className="ap-resultado" aria-live="polite">
          <div
            className={`ap-resultado-banner ${resultado.ok ? 'ap-resultado-banner--ok' : 'ap-resultado-banner--warn'}`}
          >
            {resultado.ok ? (
              <CheckCircle2 size={22} aria-hidden />
            ) : (
              <AlertCircle size={22} aria-hidden />
            )}
            <div>
              <strong>
                {resultado.ok
                  ? 'Carga completada'
                  : 'Carga finalizada con incidencias'}
              </strong>
              <p>
                Ciclo activo (ref.): {resultado.cicloActivo} · Duración:{' '}
                {(resultado.duracionMs / 1000).toFixed(1)} s
              </p>
              {resultado.advertenciaFaltantes && (
                <p className="ap-advertencia">{resultado.advertenciaFaltantes}</p>
              )}
            </div>
          </div>

          {resultado.rechazados && resultado.rechazados.length > 0 && (
            <p className="ap-rechazados">
              Archivos rechazados: {resultado.rechazados.join(', ')}
            </p>
          )}

          <div className="ap-resumen-global">
            {resultado.archivos.map((r) => (
              <TarjetaResumenArchivo key={r.archivo} resumen={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
