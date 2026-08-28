'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  CalendarRange,
  CheckCircle2,
  FileKey2,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  eliminarPaqueteFielApi,
  guardarPaqueteFielApi,
  listarPaquetesFielApi,
  marcarUltimoPaqueteFiel,
  migrarPaquetesLocalesSiHay,
  obtenerUltimoPaqueteFielId,
  type SatFielPaqueteResumen,
} from '@/lib/sat/satFielPaquetesStorage'
import FacturacionShell from './FacturacionShell'

type Etapa =
  | 'idle'
  | 'autenticando'
  | 'solicitud_enviada'
  | 'verificando'
  | 'procesando_xml'
  | 'generando_excel'
  | 'listo'
  | 'error'

const ETIQUETAS: Record<Etapa, string> = {
  idle: 'Listo para iniciar',
  autenticando: 'Autenticando e.firma con el SAT…',
  solicitud_enviada: 'Solicitud enviada — esperando paquetes del SAT…',
  verificando: 'Verificando disponibilidad en el SAT…',
  procesando_xml: 'Descargando y procesando XML…',
  generando_excel: 'Generando archivo Excel…',
  listo: 'Excel generado correctamente',
  error: 'Ocurrió un error',
}

const PASOS = [
  { id: 'fiel', label: 'e.firma' },
  { id: 'solicitud', label: 'Solicitud' },
  { id: 'verificar', label: 'Verificación' },
  { id: 'descarga', label: 'Descarga' },
  { id: 'excel', label: 'Excel' },
] as const

function indicePaso(etapa: Etapa): number {
  switch (etapa) {
    case 'idle':
      return -1
    case 'autenticando':
      return 0
    case 'solicitud_enviada':
      return 1
    case 'verificando':
      return 2
    case 'procesando_xml':
      return 3
    case 'generando_excel':
    case 'listo':
      return 4
    default:
      return -1
  }
}

function mensajeErrorApi(data: {
  error?: string
  detail?: string | null
  code?: string
}): string {
  const base = data.error || 'Error al comunicarse con el SAT.'
  if (!data.detail) return base
  const corto =
    data.detail.length > 600 ? `${data.detail.slice(0, 600)}…` : data.detail
  return `${base}\n\nDetalle técnico: ${corto}`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function truncarNombre(nombre: string, max = 28) {
  if (nombre.length <= max) return nombre
  return `${nombre.slice(0, max - 3)}…`
}

type ZonaArchivoProps = {
  id: string
  label: string
  hint: string
  accept: string
  archivo: File | null
  disabled: boolean
  onSelect: (file: File | null) => void
}

function ZonaArchivo({
  id,
  label,
  hint,
  accept,
  archivo,
  disabled,
  onSelect,
}: ZonaArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="facturacion-cfdi-sat-file-zone">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="facturacion-cfdi-sat-file-input"
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className={`facturacion-cfdi-sat-file-btn${archivo ? ' has-file' : ''}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-describedby={`${id}-hint`}
      >
        <span className="facturacion-cfdi-sat-file-icon" aria-hidden>
          {archivo ? <CheckCircle2 size={22} /> : <Upload size={22} />}
        </span>
        <span className="facturacion-cfdi-sat-file-text">
          <span className="facturacion-cfdi-sat-file-label">{label}</span>
          <span className="facturacion-cfdi-sat-file-name" id={`${id}-hint`}>
            {archivo ? truncarNombre(archivo.name) : hint}
          </span>
        </span>
      </button>
    </div>
  )
}

export default function FacturacionDescargaSatView() {
  const cerId = useId()
  const keyId = useId()
  const passId = useId()
  const nombrePaqueteId = useId()
  const inicioId = useId()
  const finId = useId()

  const [paquetes, setPaquetes] = useState<SatFielPaqueteResumen[]>([])
  const [paqueteActivoId, setPaqueteActivoId] = useState<string | '__nuevo__'>('__nuevo__')
  const [nombrePaquete, setNombrePaquete] = useState('')
  const [cer, setCer] = useState<File | null>(null)
  const [key, setKey] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('idle')
  const [idSolicitud, setIdSolicitud] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardandoPaquete, setGuardandoPaquete] = useState(false)
  const [cargandoPaquetes, setCargandoPaquetes] = useState(true)
  const [mostrarArchivosFiel, setMostrarArchivosFiel] = useState(true)
  const cancelRef = useRef(false)

  const modoNuevo = paqueteActivoId === '__nuevo__'
  const paqueteActivo =
    paqueteActivoId === '__nuevo__'
      ? null
      : (paquetes.find((p) => p.id === paqueteActivoId) ?? null)

  const aplicarPaquete = useCallback((p: SatFielPaqueteResumen) => {
    setCer(null)
    setKey(null)
    setPassword('')
    setNombrePaquete(p.nombre)
    setPaqueteActivoId(p.id)
    marcarUltimoPaqueteFiel(p.id)
    setMostrarArchivosFiel(false)
  }, [])

  const cargarPaquetes = useCallback(async () => {
    setCargandoPaquetes(true)
    try {
      const migrados = await migrarPaquetesLocalesSiHay()
      const lista = await listarPaquetesFielApi()
      setPaquetes(lista)
      if (migrados > 0) {
        setMensaje(
          `Se migraron ${migrados} paquete${migrados === 1 ? '' : 's'} del navegador a InsForge.`
        )
      }
      const ultimo = obtenerUltimoPaqueteFielId()
      const elegido =
        (ultimo ? lista.find((p) => p.id === ultimo) : null) ?? lista[0] ?? null
      if (elegido) aplicarPaquete(elegido)
      else {
        setPaqueteActivoId('__nuevo__')
        setMostrarArchivosFiel(true)
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar los paquetes e.firma.'
      )
      setEtapa('error')
    } finally {
      setCargandoPaquetes(false)
    }
  }, [aplicarPaquete])

  useEffect(() => {
    void cargarPaquetes()
  }, [cargarPaquetes])

  const iniciarNuevoPaquete = useCallback(() => {
    setError(null)
    setPaqueteActivoId('__nuevo__')
    setCer(null)
    setKey(null)
    setPassword('')
    setNombrePaquete('')
    setMostrarArchivosFiel(true)
  }, [])

  const cancelarRegistroPaquete = useCallback(() => {
    setError(null)
    if (paquetes.length === 0) return
    const ultimo = obtenerUltimoPaqueteFielId()
    const elegido =
      (ultimo ? paquetes.find((p) => p.id === ultimo) : null) ?? paquetes[0] ?? null
    if (elegido) aplicarPaquete(elegido)
  }, [aplicarPaquete, paquetes])

  const cambiarPaquete = useCallback(
    (id: string) => {
      setError(null)
      if (id === '__nuevo__') {
        iniciarNuevoPaquete()
        return
      }
      const p = paquetes.find((item) => item.id === id)
      if (p) aplicarPaquete(p)
    },
    [aplicarPaquete, iniciarNuevoPaquete, paquetes]
  )

  const guardarPaqueteActual = useCallback(async () => {
    if (!cer || !key || !password.trim()) {
      setError('Suba .cer, .key e indique la contraseña antes de guardar.')
      return null
    }
    if (!nombrePaquete.trim()) {
      setError('Indique un nombre para este paquete de e.firma.')
      return null
    }
    setGuardandoPaquete(true)
    setError(null)
    try {
      const p = await guardarPaqueteFielApi({
        nombre: nombrePaquete,
        cer,
        key,
        password,
        id: modoNuevo ? undefined : paqueteActivoId,
      })
      const lista = await listarPaquetesFielApi()
      setPaquetes(lista)
      aplicarPaquete(p)
      setMensaje(
        modoNuevo
          ? `Paquete «${p.nombre}» guardado. Puede agregar otro o consultar el SAT.`
          : `Paquete «${p.nombre}» actualizado en InsForge.`
      )
      return p
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el paquete.')
      return null
    } finally {
      setGuardandoPaquete(false)
    }
  }, [
    aplicarPaquete,
    cer,
    key,
    modoNuevo,
    nombrePaquete,
    paqueteActivoId,
    password,
  ])

  const eliminarPaqueteActual = useCallback(async () => {
    if (modoNuevo || !paqueteActivo) return
    const ok = window.confirm(
      `¿Eliminar el paquete «${paqueteActivo.nombre}» de InsForge?`
    )
    if (!ok) return
    try {
      await eliminarPaqueteFielApi(paqueteActivo.id)
      const restantes = await listarPaquetesFielApi()
      setPaquetes(restantes)
      if (restantes[0]) aplicarPaquete(restantes[0])
      else {
        setPaqueteActivoId('__nuevo__')
        setCer(null)
        setKey(null)
        setPassword('')
        setNombrePaquete('')
        setMostrarArchivosFiel(true)
      }
      setMensaje('Paquete eliminado.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el paquete.')
      setEtapa('error')
    }
  }, [aplicarPaquete, modoNuevo, paqueteActivo])

  const ejecutar = useCallback(async () => {
    cancelRef.current = false
    setError(null)
    setMensaje(null)
    setIdSolicitud(null)

    let paqueteIdEjecucion: string | null = null

    if (modoNuevo || mostrarArchivosFiel) {
      if (!cer || !key || !password.trim()) {
        setError('Suba .cer, .key e indique la contraseña de la e.firma.')
        setEtapa('error')
        return
      }
      if (!nombrePaquete.trim()) {
        setError('Indique un nombre para guardar este paquete de e.firma.')
        setEtapa('error')
        return
      }
      const guardado = await guardarPaqueteActual()
      if (!guardado) {
        setEtapa('error')
        return
      }
      paqueteIdEjecucion = guardado.id
    } else if (paqueteActivoId !== '__nuevo__') {
      paqueteIdEjecucion = paqueteActivoId
    } else {
      setError('Seleccione un paquete de e.firma válido o registre uno nuevo.')
      setEtapa('error')
      return
    }

    if (!fechaInicio || !fechaFin) {
      setError('Seleccione fecha inicio y fin.')
      setEtapa('error')
      return
    }

    const armarFormEjecucion = (accion: string, extra?: Record<string, string>) => {
      const fd = new FormData()
      fd.set('accion', accion)
      if (paqueteIdEjecucion) {
        fd.set('paqueteId', paqueteIdEjecucion)
      } else {
        if (cer) fd.set('cer', cer)
        if (key) fd.set('key', key)
        fd.set('password', password)
      }
      fd.set('fechaInicio', fechaInicio)
      fd.set('fechaFin', fechaFin)
      if (extra) {
        for (const [k, v] of Object.entries(extra)) fd.set(k, v)
      }
      return fd
    }

    try {
      setEtapa('autenticando')
      const resSol = await fetch('/api/sat/descarga-masiva', {
        method: 'POST',
        headers: portalSessionFetchHeaders(),
        body: armarFormEjecucion('solicitar'),
      })
      const dataSol = await resSol.json().catch(() => ({}))
      if (!resSol.ok || !dataSol.ok) {
        throw new Error(mensajeErrorApi(dataSol))
      }

      const id = String(dataSol.idSolicitud ?? '')
      setIdSolicitud(id)
      setEtapa('solicitud_enviada')
      setMensaje(`IdSolicitud: ${id}`)

      let paquetes: string[] = []
      const maxIntentos = 36
      for (let i = 0; i < maxIntentos; i++) {
        if (cancelRef.current) return
        setEtapa('verificando')
        await sleep(i === 0 ? 4000 : 5000)

        const resVer = await fetch('/api/sat/descarga-masiva', {
          method: 'POST',
          headers: portalSessionFetchHeaders(),
          body: armarFormEjecucion('verificar', { idSolicitud: id }),
        })
        const dataVer = await resVer.json().catch(() => ({}))
        if (!resVer.ok || dataVer.ok === false) {
          throw new Error(mensajeErrorApi(dataVer))
        }

        if (dataVer.estado === 'fallida') {
          throw new Error(dataVer.mensaje || 'El SAT rechazó o expiró la solicitud.')
        }
        if (dataVer.estado === 'lista') {
          paquetes = Array.isArray(dataVer.paquetes) ? dataVer.paquetes : []
          break
        }
        setMensaje(
          dataVer.mensaje ||
            `Verificación ${i + 1}/${maxIntentos} — el SAT sigue procesando…`
        )
      }

      if (!paquetes.length) {
        throw new Error(
          'El SAT no terminó a tiempo. Intente de nuevo con un rango de fechas más corto.'
        )
      }

      setEtapa('procesando_xml')
      setMensaje(`${paquetes.length} paquete(s) listos para descargar.`)

      setEtapa('generando_excel')
      const resXls = await fetch('/api/sat/descarga-masiva', {
        method: 'POST',
        headers: portalSessionFetchHeaders(),
        body: armarFormEjecucion('descargar', {
          idSolicitud: id,
          paquetes: JSON.stringify(paquetes),
        }),
      })

      if (!resXls.ok) {
        const errJson = await resXls.json().catch(() => ({}))
        throw new Error(mensajeErrorApi(errJson))
      }

      const count = Number(resXls.headers.get('X-Cfdi-Count') ?? 0)

      const blob = await resXls.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cfdi-recibidos_${fechaInicio}_${fechaFin}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      setEtapa('listo')
      setMensaje(
        `Se exportaron ${count} comprobante${count === 1 ? '' : 's'}. Descarga iniciada en su navegador.`
      )
    } catch (e) {
      setEtapa('error')
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }, [
    cer,
    fechaFin,
    fechaInicio,
    guardarPaqueteActual,
    key,
    modoNuevo,
    mostrarArchivosFiel,
    nombrePaquete,
    paqueteActivoId,
    password,
  ])

  const ocupado =
    etapa !== 'idle' && etapa !== 'listo' && etapa !== 'error'

  const formularioFielVisible = modoNuevo || mostrarArchivosFiel
  const uiBloqueada = ocupado || cargandoPaquetes || guardandoPaquete

  const pasoActivo = indicePaso(etapa)
  const listo = etapa === 'listo'
  const fallo = etapa === 'error'

  return (
    <FacturacionShell
      title="Facturación SAT (Descarga Masiva)"
      subtitle="CFDI recibidos → Excel · Web Service oficial del SAT · paquetes e.firma en InsForge"
      showNav={false}
      roles={['usuario']}
    >
      <div className="facturacion-cfdi-sat">
        <div className="facturacion-cfdi-sat-aviso" role="note">
          <ShieldCheck size={22} className="facturacion-cfdi-sat-aviso-icon" aria-hidden />
          <div className="min-w-0">
            <p className="facturacion-cfdi-sat-aviso-title">Seguridad de la e.firma</p>
              <p className="facturacion-cfdi-sat-aviso-text">
              Los archivos <code>.cer</code>, <code>.key</code> y la contraseña se guardan en{' '}
              <strong>InsForge</strong> (cifrados en servidor; solo personal administrativo).{' '}
              <strong>No se almacenan en el navegador</strong> salvo recordar el último paquete
              elegido. Se usan únicamente para firmar la petición SOAP al SAT. Use la{' '}
              <strong>FIEL</strong> del RFC receptor (no el CSD de sellos para facturar). Rango
              máximo recomendado: <strong>31 días</strong> por consulta.
            </p>
          </div>
        </div>

        <ol className="facturacion-cfdi-sat-steps" aria-label="Progreso del proceso">
          {PASOS.map((paso, i) => {
            const hecho = listo || (pasoActivo >= 0 && i < pasoActivo)
            const activo = pasoActivo === i && ocupado
            const clase = [
              hecho ? 'done' : '',
              activo ? 'active' : '',
              fallo && pasoActivo === i ? 'fail' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <li key={paso.id} className={clase || undefined}>
                <span className="facturacion-cfdi-sat-step-dot" aria-hidden>
                  {hecho ? <CheckCircle2 size={14} /> : i + 1}
                </span>
                <span className="facturacion-cfdi-sat-step-label">{paso.label}</span>
              </li>
            )
          })}
        </ol>

        <div className="facturacion-cfdi-sat-layout">
          <div className="facturacion-cfdi-sat-main">
            <section className="facturacion-cfdi-sat-card" aria-labelledby="sat-fiel-heading">
              <header className="facturacion-cfdi-sat-card-head">
                <span className="facturacion-cfdi-sat-card-icon" aria-hidden>
                  <FileKey2 size={20} />
                </span>
                <div>
                  <h2 id="sat-fiel-heading" className="facturacion-cfdi-sat-card-title">
                    e.firma (FIEL)
                  </h2>
                  <p className="facturacion-cfdi-sat-card-desc">
                    Puede guardar <strong>varios paquetes</strong> (RFC distintos o el mismo con
                    otro nombre). Al abrir, elija cuál usar para la consulta.
                  </p>
                </div>
              </header>

              <div className="facturacion-cfdi-sat-paquete-toolbar">
                <p className="facturacion-cfdi-sat-paquete-count">
                  {cargandoPaquetes
                    ? 'Cargando paquetes…'
                    : paquetes.length === 0
                      ? 'Sin paquetes guardados'
                      : `${paquetes.length} paquete${paquetes.length === 1 ? '' : 's'} guardado${paquetes.length === 1 ? '' : 's'}`}
                </p>
                {!modoNuevo ? (
                  <button
                    type="button"
                    className="facturacion-cfdi-sat-btn-secondary facturacion-cfdi-sat-btn-add"
                    onClick={iniciarNuevoPaquete}
                    disabled={uiBloqueada}
                  >
                    <Plus size={14} aria-hidden />
                    Agregar paquete
                  </button>
                ) : null}
              </div>

              {paquetes.length > 0 && !modoNuevo && !mostrarArchivosFiel ? (
                <div
                  className="facturacion-cfdi-sat-paquete-lista"
                  role="listbox"
                  aria-label="Paquetes e.firma guardados"
                >
                  {paquetes.map((p) => {
                    const activo = p.id === paqueteActivoId
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={activo}
                        className={`facturacion-cfdi-sat-paquete-item${activo ? ' selected' : ''}`}
                        onClick={() => cambiarPaquete(p.id)}
                        disabled={uiBloqueada}
                      >
                        <span className="facturacion-cfdi-sat-paquete-item-head">
                          <Package size={16} aria-hidden />
                          <span className="facturacion-cfdi-sat-paquete-item-nombre">{p.nombre}</span>
                          {activo ? (
                            <span className="facturacion-cfdi-sat-paquete-item-badge">En uso</span>
                          ) : null}
                        </span>
                        <span className="facturacion-cfdi-sat-paquete-item-files">
                          {p.cerNombre} · {p.keyNombre}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {!modoNuevo && paqueteActivo && !formularioFielVisible ? (
                <div className="facturacion-cfdi-sat-paquete-resumen">
                  <p className="facturacion-cfdi-sat-paquete-nombre">{paqueteActivo.nombre}</p>
                  <ul className="facturacion-cfdi-sat-paquete-meta">
                    <li>
                      <span>Certificado</span>
                      <code>{paqueteActivo.cerNombre}</code>
                    </li>
                    <li>
                      <span>Clave privada</span>
                      <code>{paqueteActivo.keyNombre}</code>
                    </li>
                    <li>
                      <span>Contraseña</span>
                      <code>••••••••</code>
                    </li>
                  </ul>
                  <div className="facturacion-cfdi-sat-paquete-actions">
                    <button
                      type="button"
                      className="facturacion-cfdi-sat-btn-secondary"
                      onClick={() => setMostrarArchivosFiel(true)}
                      disabled={uiBloqueada}
                    >
                      Editar archivos
                    </button>
                    <button
                      type="button"
                      className="facturacion-cfdi-sat-btn-danger"
                      onClick={() => void eliminarPaqueteActual()}
                      disabled={uiBloqueada}
                    >
                      <Trash2 size={14} aria-hidden />
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : null}

              {formularioFielVisible ? (
                <>
                  <p className="facturacion-cfdi-sat-form-kicker">
                    {modoNuevo
                      ? paquetes.length === 0
                        ? 'Registre el primer paquete de e.firma'
                        : 'Nuevo paquete de e.firma'
                      : `Editando «${nombrePaquete || paqueteActivo?.nombre || ''}»`}
                  </p>
                  <label
                    className="facturacion-cfdi-field facturacion-cfdi-field-wide"
                    htmlFor={nombrePaqueteId}
                  >
                    <span className="facturacion-cfdi-sat-field-row">
                      <Package size={14} aria-hidden />
                      Nombre del paquete
                    </span>
                    <input
                      id={nombrePaqueteId}
                      type="text"
                      className="facturacion-cfdi-input"
                      value={nombrePaquete}
                      onChange={(e) => setNombrePaquete(e.target.value)}
                      disabled={uiBloqueada}
                      placeholder="Ej. Winston Churchill · contabilidad"
                      maxLength={80}
                    />
                  </label>

                  <div className="facturacion-cfdi-sat-files">
                    <ZonaArchivo
                      id={cerId}
                      label="Certificado"
                      hint="Seleccionar archivo .cer"
                      accept=".cer"
                      archivo={cer}
                      disabled={uiBloqueada}
                      onSelect={setCer}
                    />
                    <ZonaArchivo
                      id={keyId}
                      label="Clave privada"
                      hint="Seleccionar archivo .key"
                      accept=".key"
                      archivo={key}
                      disabled={uiBloqueada}
                      onSelect={setKey}
                    />
                  </div>

                  <label
                    className="facturacion-cfdi-field facturacion-cfdi-field-wide"
                    htmlFor={passId}
                  >
                    <span className="facturacion-cfdi-sat-field-row">
                      <KeyRound size={14} aria-hidden />
                      Contraseña de la clave privada
                    </span>
                    <input
                      id={passId}
                      type="password"
                      autoComplete="off"
                      className="facturacion-cfdi-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={uiBloqueada}
                      placeholder="••••••••"
                    />
                  </label>

                  <div className="facturacion-cfdi-sat-paquete-actions">
                    <button
                      type="button"
                      className="facturacion-cfdi-sat-btn-secondary"
                      onClick={() => void guardarPaqueteActual()}
                      disabled={uiBloqueada}
                    >
                      {guardandoPaquete ? (
                        <>
                          <Loader2 size={14} className="facturacion-cfdi-spin" aria-hidden />
                          Guardando…
                        </>
                      ) : (
                        <>
                          <Plus size={14} aria-hidden />
                          {modoNuevo ? 'Guardar paquete' : 'Guardar cambios'}
                        </>
                      )}
                    </button>
                    {modoNuevo && paquetes.length > 0 ? (
                      <button
                        type="button"
                        className="facturacion-cfdi-sat-btn-secondary"
                        onClick={cancelarRegistroPaquete}
                        disabled={uiBloqueada}
                      >
                        Cancelar
                      </button>
                    ) : null}
                    {!modoNuevo ? (
                      <button
                        type="button"
                        className="facturacion-cfdi-sat-btn-secondary"
                        onClick={() => setMostrarArchivosFiel(false)}
                        disabled={uiBloqueada}
                      >
                        Cancelar edición
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>

            <section className="facturacion-cfdi-sat-card" aria-labelledby="sat-filtros-heading">
              <header className="facturacion-cfdi-sat-card-head">
                <span className="facturacion-cfdi-sat-card-icon" aria-hidden>
                  <CalendarRange size={20} />
                </span>
                <div>
                  <h2 id="sat-filtros-heading" className="facturacion-cfdi-sat-card-title">
                    Periodo de consulta
                  </h2>
                  <p className="facturacion-cfdi-sat-card-desc">
                    Tipo: <strong>Recibidos</strong> — usted es el receptor en el CFDI.
                  </p>
                </div>
              </header>

              <div className="facturacion-cfdi-sat-dates">
                <label className="facturacion-cfdi-field" htmlFor={inicioId}>
                  Fecha inicio
                  <input
                    id={inicioId}
                    type="date"
                    className="facturacion-cfdi-input"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    disabled={uiBloqueada}
                  />
                </label>
                <label className="facturacion-cfdi-field" htmlFor={finId}>
                  Fecha fin
                  <input
                    id={finId}
                    type="date"
                    className="facturacion-cfdi-input"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    disabled={uiBloqueada}
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="facturacion-cfdi-sat-aside">
            <div
              className={`facturacion-cfdi-sat-status${listo ? ' ok' : ''}${fallo ? ' fail' : ''}${ocupado ? ' busy' : ''}`}
              role="status"
              aria-live="polite"
            >
              <p className="facturacion-cfdi-sat-status-kicker">Estado</p>
              <p className="facturacion-cfdi-sat-status-title">
                {cargandoPaquetes ? (
                  <Loader2 size={18} className="facturacion-cfdi-spin" aria-hidden />
                ) : ocupado ? (
                  <Loader2 size={18} className="facturacion-cfdi-spin" aria-hidden />
                ) : listo ? (
                  <FileSpreadsheet size={18} aria-hidden />
                ) : fallo ? (
                  <XCircle size={18} aria-hidden />
                ) : null}
                {cargandoPaquetes
                  ? 'Cargando paquetes e.firma…'
                  : ETIQUETAS[etapa]}
              </p>
              {idSolicitud ? (
                <p className="facturacion-cfdi-sat-status-meta">
                  <span className="facturacion-cfdi-sat-status-meta-label">IdSolicitud</span>
                  <code>{idSolicitud}</code>
                </p>
              ) : null}
              {mensaje ? <p className="facturacion-cfdi-sat-status-msg">{mensaje}</p> : null}
              {error ? (
                <p className="facturacion-cfdi-sat-status-error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
                  {error}
                </p>
              ) : null}
            </div>

            <div className="facturacion-cfdi-sat-actions">
              <button
                type="button"
                className="facturacion-cfdi-btn-primary facturacion-cfdi-sat-btn-main"
                onClick={() => void ejecutar()}
                disabled={ocupado || cargandoPaquetes}
              >
                {ocupado ? (
                  <>
                    <Loader2 size={16} className="facturacion-cfdi-spin" aria-hidden />
                    Procesando…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={16} aria-hidden />
                    Solicitar y generar Excel
                  </>
                )}
              </button>
              {ocupado ? (
                <button
                  type="button"
                  className="facturacion-cfdi-sat-btn-secondary"
                  onClick={() => {
                    cancelRef.current = true
                    setEtapa('idle')
                    setMensaje('Proceso cancelado.')
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            <p className="facturacion-cfdi-sat-footnote">
              El SAT puede tardar varios minutos en preparar los paquetes. No cierre esta pestaña
              hasta que termine la descarga. Si ya envió una consulta hace pocos minutos, espere
              15–30 min antes de volver a solicitar el mismo periodo.
            </p>
          </aside>
        </div>
      </div>
    </FacturacionShell>
  )
}
