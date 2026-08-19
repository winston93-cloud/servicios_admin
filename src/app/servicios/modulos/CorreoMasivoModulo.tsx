'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Mail, Paperclip, RotateCcw, Send, UserRound, Users } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import {
  FILTROS_ADICIONALES_OPCIONES,
  NIVEL_CORREO_OPCIONES,
  agruparDestinatariosPorSeccion,
  claseEstadoEnvio,
  etiquetaEstadoEnvio,
  gradoCorreoOpciones,
  gruposOpcionesPorNivel,
  resumenDestinatarios,
  type DestinatarioCorreoMasivo,
  type FiltroAdicionalCorreo,
} from '@/lib/correoMasivoService'
import {
  guardarProgresoCorreoMasivo,
  leerProgresoCorreoMasivo,
  limpiarProgresoCorreoMasivo,
  resumenProgresoGuardado,
} from '@/lib/correoMasivoProgresoStorage'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'

type ModoEnvioCorreo = 'masivo' | 'individual'

export default function CorreoMasivoModulo() {
  const { cicloSeleccionado, opcionesCatalogo, cargando: cargandoCiclos } = useCicloEscolar()

  const [modoEnvio, setModoEnvio] = useState<ModoEnvioCorreo>('masivo')
  const [cicloFiltro, setCicloFiltro] = useState(cicloSeleccionado)
  const [nivel, setNivel] = useState(0)
  const [grado, setGrado] = useState(0)
  const [grupo, setGrupo] = useState(0)
  const [filtroAdicional, setFiltroAdicional] = useState<FiltroAdicionalCorreo>('sin-filtro')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])

  const [alumnoIndividual, setAlumnoIndividual] = useState<AlumnoBusquedaResultado | null>(null)
  const [destinatarios, setDestinatarios] = useState<DestinatarioCorreoMasivo[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeOk, setMensajeOk] = useState<string | null>(null)
  const [faseEnvio, setFaseEnvio] = useState<'preview' | 'resultado'>('preview')
  const [progresoEnvio, setProgresoEnvio] = useState<string | null>(null)
  const [sesionRestaurada, setSesionRestaurada] = useState(false)
  const [inicializado, setInicializado] = useState(false)
  const [nombresArchivosRecordados, setNombresArchivosRecordados] = useState<string[]>([])
  /** Nombres de adjuntos que deben volver a seleccionarse tras recarga/reintento. */
  const [adjuntosObligatorios, setAdjuntosObligatorios] = useState<string[]>([])

  /** Lotes pequeños + pausa para no saturar Gmail (454 Too many login attempts). */
  const TAMANO_LOTE_ENVIO = 12
  const PAUSA_ENTRE_LOTES_MS = 10_000

  const fileInputRef = useRef<HTMLInputElement>(null)

  const cantidadPorReenviar = useMemo(
    () =>
      destinatarios.filter(
        (d) =>
          d.emails.length > 0 && (d.estado === 'error' || d.estado === 'pendiente')
      ).length,
    [destinatarios]
  )

  const resumenGuardado = useMemo(
    () => (destinatarios.length ? resumenProgresoGuardado(destinatarios) : null),
    [destinatarios]
  )

  useEffect(() => {
    const guardado = leerProgresoCorreoMasivo()
    if (guardado) {
      setCicloFiltro(guardado.cicloFiltro)
      setNivel(guardado.nivel)
      setGrado(guardado.grado)
      setGrupo(guardado.grupo)
      setFiltroAdicional(guardado.filtroAdicional)
      setAsunto(guardado.asunto)
      setMensaje(guardado.mensaje)
      setDestinatarios(guardado.destinatarios)
      setFaseEnvio('resultado')
      setMensajeOk(guardado.resumenTexto)
      const nombresGuardados = guardado.nombresArchivos ?? []
      setNombresArchivosRecordados(nombresGuardados)
      setAdjuntosObligatorios(nombresGuardados)
      setSesionRestaurada(true)
      setModoEnvio(guardado.destinatarios.length <= 1 ? 'individual' : 'masivo')
    }
    setInicializado(true)
  }, [])

  useEffect(() => {
    if (!inicializado || cargandoCiclos) return
    if (sesionRestaurada) {
      const valores = new Set(opcionesCatalogo.map((o) => o.valor))
      if (valores.size > 0 && !valores.has(cicloFiltro)) {
        setCicloFiltro(cicloSeleccionado)
      }
      return
    }
    setCicloFiltro(cicloSeleccionado)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [
    cicloSeleccionado,
    inicializado,
    sesionRestaurada,
    cargandoCiclos,
    opcionesCatalogo,
  ])

  useEffect(() => {
    setGrado(0)
    setGrupo(0)
  }, [nivel])

  const gradosOpciones = useMemo(() => gradoCorreoOpciones(nivel || null), [nivel])
  const gruposOpciones = useMemo(() => {
    const base = [{ valor: 0, etiqueta: 'Todos los grupos' }]
    if (!nivel) return [{ valor: 0, etiqueta: 'Todos (elija nivel para filtrar)' }]
    return [...base, ...gruposOpcionesPorNivel(nivel)]
  }, [nivel])

  const persistirSesion = useCallback(
    (lista: DestinatarioCorreoMasivo[], resumenTexto: string | null) => {
      guardarProgresoCorreoMasivo({
        cicloFiltro,
        nivel,
        grado,
        grupo,
        filtroAdicional,
        asunto,
        mensaje,
        nombresArchivos: archivos.map((f) => f.name),
        destinatarios: lista,
        resumenTexto,
      })
    },
    [archivos, asunto, cicloFiltro, filtroAdicional, grado, grupo, mensaje, nivel]
  )

  const descartarProgresoGuardado = useCallback(() => {
    limpiarProgresoCorreoMasivo()
    setSesionRestaurada(false)
    setNombresArchivosRecordados([])
    setAdjuntosObligatorios([])
    setMensajeOk(null)
    setFaseEnvio('preview')
  }, [])

  const validarAdjuntosAntesEnvio = useCallback((): boolean => {
    const faltan = adjuntosObligatorios.length > 0 && archivos.length === 0
    if (!faltan) return true
    setError(
      `Debe volver a seleccionar los archivos adjuntos (${adjuntosObligatorios.join(', ')}). Tras un error de red o recargar la página, el navegador no conserva los archivos y el reintento los envía vacío.`
    )
    return false
  }, [adjuntosObligatorios, archivos.length])

  const tocarFiltro = useCallback(() => {
    if (sesionRestaurada) descartarProgresoGuardado()
  }, [descartarProgresoGuardado, sesionRestaurada])

  const cargarDestinatariosMasivo = useCallback(async () => {
    if (!cicloFiltro) return
    setCargandoLista(true)
    setError(null)
    limpiarProgresoCorreoMasivo()
    setSesionRestaurada(false)
    try {
      const params = new URLSearchParams({
        ciclo: String(cicloFiltro),
        filtroAdicional,
      })
      if (nivel > 0) params.set('nivel', String(nivel))
      if (grado > 0) params.set('grado', String(grado))
      if (grupo > 0) params.set('grupo', String(grupo))

      const res = await fetch(`/api/correo-masivo/destinatarios?${params}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'No se pudo cargar la lista de alumnos')
        setDestinatarios([])
        return
      }
      setDestinatarios(json.destinatarios ?? [])
      setFaseEnvio('preview')
      if (typeof json.aviso === 'string' && json.aviso && !(json.destinatarios ?? []).length) {
        setError(json.aviso)
      }
    } catch {
      setError('Error de red al cargar destinatarios')
      setDestinatarios([])
    } finally {
      setCargandoLista(false)
    }
  }, [cicloFiltro, nivel, grado, grupo, filtroAdicional])

  const cargarDestinatarioIndividual = useCallback(async (alumno: AlumnoBusquedaResultado | null) => {
    if (!alumno?.alumno_id) {
      setDestinatarios([])
      setFaseEnvio('preview')
      return
    }
    setCargandoLista(true)
    setError(null)
    limpiarProgresoCorreoMasivo()
    setSesionRestaurada(false)
    try {
      const res = await fetch(
        `/api/correo-masivo/destinatarios?alumnoId=${encodeURIComponent(String(alumno.alumno_id))}`
      )
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'No se pudo cargar el alumno')
        setDestinatarios([])
        return
      }
      const lista = (json.destinatarios ?? []) as DestinatarioCorreoMasivo[]
      setDestinatarios(lista)
      setFaseEnvio('preview')
      if (!lista.length) {
        setError(json.aviso ?? 'No se encontró el alumno.')
      } else if (!lista[0].emails.length) {
        setError('El alumno no tiene correo autorizado de padre/madre.')
      }
    } catch {
      setError('Error de red al cargar el alumno')
      setDestinatarios([])
    } finally {
      setCargandoLista(false)
    }
  }, [])

  useEffect(() => {
    if (!inicializado || cargandoCiclos || !cicloFiltro) return
    if (sesionRestaurada) return
    if (modoEnvio !== 'masivo') return
    const t = setTimeout(() => cargarDestinatariosMasivo(), 280)
    return () => clearTimeout(t)
  }, [
    cargarDestinatariosMasivo,
    cargandoCiclos,
    cicloFiltro,
    inicializado,
    modoEnvio,
    sesionRestaurada,
  ])

  const cambiarModo = useCallback(
    (modo: ModoEnvioCorreo) => {
      if (modo === modoEnvio) return
      tocarFiltro()
      setModoEnvio(modo)
      setError(null)
      setMensajeOk(null)
      setFaseEnvio('preview')
      setDestinatarios([])
      setAlumnoIndividual(null)
    },
    [modoEnvio, tocarFiltro]
  )

  const onSeleccionarAlumnoIndividual = useCallback(
    (alumno: AlumnoBusquedaResultado | null) => {
      tocarFiltro()
      setAlumnoIndividual(alumno)
      setMensajeOk(null)
      void cargarDestinatarioIndividual(alumno)
    },
    [cargarDestinatarioIndividual, tocarFiltro]
  )

  const grupos = useMemo(() => agruparDestinatariosPorSeccion(destinatarios), [destinatarios])
  const resumen = useMemo(() => resumenDestinatarios(destinatarios), [destinatarios])

  const onArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = e.target.files ? [...e.target.files] : []
    setArchivos((prev) => {
      const merged = [...prev, ...lista]
      if (merged.length > 0) setAdjuntosObligatorios([])
      return merged
    })
    e.target.value = ''
  }

  const quitarArchivo = (idx: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== idx))
  }

  const ejecutarEnvioLotes = useCallback(
    async (listaEnviar: DestinatarioCorreoMasivo[], preservarExistentes: boolean) => {
      const conCorreo = listaEnviar.filter((d) => d.emails.length > 0)
      const resultadosMap = new Map<number, DestinatarioCorreoMasivo>()

      if (preservarExistentes) {
        for (const d of destinatarios) {
          if (d.estado !== 'error') resultadosMap.set(d.alumno_id, d)
        }
      } else {
        for (const d of destinatarios.filter((x) => !x.emails.length)) {
          resultadosMap.set(d.alumno_id, {
            ...d,
            estado: 'sin-correo',
            mensaje_estado: 'Sin correo autorizado (padre/madre)',
          })
        }
      }

      let totalEnviados = 0
      let totalErrores = 0
      const totalLotes = Math.ceil(conCorreo.length / TAMANO_LOTE_ENVIO) || 0
      const esIndividual = modoEnvio === 'individual'

      persistirSesion(destinatarios, 'Iniciando envío…')

      for (let i = 0; i < conCorreo.length; i += TAMANO_LOTE_ENVIO) {
        const lote = conCorreo.slice(i, i + TAMANO_LOTE_ENVIO)
        const numLote = Math.floor(i / TAMANO_LOTE_ENVIO) + 1
        setProgresoEnvio(
          esIndividual
            ? 'Enviando correo individual…'
            : `Enviando lote ${numLote} de ${totalLotes} (${i + lote.length}/${conCorreo.length} alumnos). Gmail limita velocidad; espere…`
        )

        const fd = new FormData()
        fd.set('asunto', asunto.trim())
        fd.set('mensaje', mensaje.trim())
        fd.set(
          'filtros',
          JSON.stringify(
            esIndividual
              ? {
                  modo: 'individual',
                  soloAlumnoIds: lote.map((d) => d.alumno_id),
                }
              : {
                  cicloEscolar: cicloFiltro,
                  nivel: nivel > 0 ? nivel : null,
                  grado: grado > 0 ? grado : null,
                  grupo: grupo > 0 ? grupo : null,
                  filtroAdicional,
                  soloAlumnoIds: lote.map((d) => d.alumno_id),
                }
          )
        )
        for (const f of archivos) fd.append('archivos', f)

        let json: {
          error?: string
          resumen?: { enviados?: number; errores?: number }
          resultados?: DestinatarioCorreoMasivo[]
          adjuntosRecibidos?: number
        }
        try {
          const res = await fetch('/api/correo-masivo/enviar', { method: 'POST', body: fd })
          json = await res.json()
          if (!res.ok) {
            const detalle = json.error ?? `Error en lote ${numLote}`
            setError(detalle)
            for (const d of lote) {
              resultadosMap.set(d.alumno_id, {
                ...d,
                estado: 'error',
                mensaje_estado: detalle,
              })
            }
            totalErrores += lote.length
          } else {
            if (
              archivos.length > 0 &&
              typeof json.adjuntosRecibidos === 'number' &&
              json.adjuntosRecibidos === 0
            ) {
              const detalle =
                'El servidor no recibió los adjuntos (posible corte de red al subir archivos). Vuelva a seleccionarlos e intente de nuevo.'
              setError(detalle)
              for (const d of lote) {
                resultadosMap.set(d.alumno_id, {
                  ...d,
                  estado: 'error',
                  mensaje_estado: detalle,
                })
              }
              totalErrores += lote.length
            } else {
              totalEnviados += json.resumen?.enviados ?? 0
              totalErrores += json.resumen?.errores ?? 0
              for (const r of (json.resultados ?? []) as DestinatarioCorreoMasivo[]) {
                resultadosMap.set(r.alumno_id, r)
              }
            }
          }
        } catch (err) {
          const detalle =
            err instanceof Error && /failed to fetch|network|abort/i.test(err.message)
              ? `Error de red en lote ${numLote}. Si hay PDFs pesados, espere conexión estable o envíe por grupos más pequeños.`
              : `Error de red en lote ${numLote}.`
          setError(detalle)
          for (const d of lote) {
            resultadosMap.set(d.alumno_id, {
              ...d,
              estado: 'error',
              mensaje_estado: detalle,
            })
          }
          totalErrores += lote.length
        }

        const ordenadosParcial = [...resultadosMap.values()].sort((a, b) => {
          if (a.nivel !== b.nivel) return a.nivel - b.nivel
          if (a.grado !== b.grado) return a.grado - b.grado
          if (a.grupo !== b.grupo) return a.grupo - b.grupo
          return a.nombre_completo.localeCompare(b.nombre_completo, 'es')
        })
        setDestinatarios(ordenadosParcial)
        persistirSesion(
          ordenadosParcial,
          esIndividual
            ? 'Enviando correo individual…'
            : `En progreso… lote ${numLote}/${totalLotes}`
        )

        if (!esIndividual && numLote < totalLotes) {
          setProgresoEnvio(`Pausa ${PAUSA_ENTRE_LOTES_MS / 1000}s antes del siguiente lote (Gmail)…`)
          await new Promise((r) => setTimeout(r, PAUSA_ENTRE_LOTES_MS))
        }
      }

      const ordenados = [...resultadosMap.values()].sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel
        if (a.grado !== b.grado) return a.grado - b.grado
        if (a.grupo !== b.grupo) return a.grupo - b.grupo
        return a.nombre_completo.localeCompare(b.nombre_completo, 'es')
      })

      setDestinatarios(ordenados)
      setFaseEnvio('resultado')
      const sinCorreo = ordenados.filter((d) => d.estado === 'sin-correo').length
      const pendientes = ordenados.filter(
        (d) => d.estado === 'error' || d.estado === 'pendiente'
      ).length
      if (pendientes === 0) limpiarProgresoCorreoMasivo()
      return { totalEnviados, totalErrores, sinCorreo, ordenados }
    },
    [
      archivos,
      asunto,
      cicloFiltro,
      destinatarios,
      filtroAdicional,
      grado,
      grupo,
      mensaje,
      modoEnvio,
      nivel,
      persistirSesion,
    ]
  )

  const onEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMensajeOk(null)

    if (!asunto.trim() || !mensaje.trim()) {
      setError('Captura asunto y mensaje.')
      return
    }
    if (modoEnvio === 'masivo' && !cicloFiltro) {
      setError('Selecciona el ciclo escolar.')
      return
    }
    if (modoEnvio === 'individual' && !alumnoIndividual && destinatarios.length === 0) {
      setError('Busca y selecciona un alumno.')
      return
    }
    if (resumen.conCorreo === 0) {
      setError(
        modoEnvio === 'individual'
          ? 'El alumno no tiene correo autorizado para enviar.'
          : 'No hay alumnos con correo autorizado para enviar.'
      )
      return
    }

    const confirmMsg =
      modoEnvio === 'individual'
        ? `¿Enviar correo a ${destinatarios[0]?.nombre_completo ?? 'este alumno'} (${destinatarios[0]?.emails.join(', ')})?`
        : `¿Enviar correo a ${resumen.conCorreo} alumno(s) con correo registrado?`
    if (!window.confirm(confirmMsg)) return
    if (!validarAdjuntosAntesEnvio()) return
    if (archivos.length > 0) {
      setAdjuntosObligatorios(archivos.map((f) => f.name))
    }

    setEnviando(true)
    setProgresoEnvio(null)
    try {
      const { totalEnviados, totalErrores, sinCorreo, ordenados } = await ejecutarEnvioLotes(
        destinatarios.filter((d) => d.emails.length > 0),
        false
      )
      const texto =
        modoEnvio === 'individual'
          ? totalEnviados > 0
            ? 'Correo individual enviado correctamente.'
            : `No se pudo enviar (${totalErrores} error(es)).`
          : `Proceso terminado: ${totalEnviados} enviado(s), ${totalErrores} error(es), ${sinCorreo} sin correo.`
      setMensajeOk(texto)
      persistirSesion(ordenados, texto)
      if (totalErrores === 0 && archivos.length > 0) setAdjuntosObligatorios([])
    } catch {
      setError(
        'Error inesperado al enviar correos. Revise su conexión; si había adjuntos, vuelva a seleccionarlos antes de reintentar.'
      )
    } finally {
      setEnviando(false)
      setProgresoEnvio(null)
    }
  }

  const onReenviarErrores = async () => {
    if (cantidadPorReenviar === 0) return
    if (!asunto.trim() || !mensaje.trim()) {
      setError('Captura asunto y mensaje.')
      return
    }
    if (!validarAdjuntosAntesEnvio()) return
    if (
      !window.confirm(
        modoEnvio === 'individual'
          ? '¿Reintentar el envío individual?'
          : `¿Continuar envío a ${cantidadPorReenviar} alumno(s) pendiente(s) o con error? Espere a que termine cada lote.`
      )
    ) {
      return
    }

    setEnviando(true)
    setError(null)
    setMensajeOk(null)
    setProgresoEnvio(null)
    try {
      const pendientes = destinatarios.filter(
        (d) =>
          d.emails.length > 0 && (d.estado === 'error' || d.estado === 'pendiente')
      )
      const { totalEnviados, totalErrores, ordenados } = await ejecutarEnvioLotes(
        pendientes,
        true
      )
      const texto =
        modoEnvio === 'individual'
          ? totalEnviados > 0
            ? 'Reintento individual enviado.'
            : 'El reintento falló.'
          : `Reintento terminado: ${totalEnviados} enviado(s) en este ciclo, ${totalErrores} siguen con error.`
      setMensajeOk(texto)
      persistirSesion(ordenados, texto)
      setSesionRestaurada(false)
      if (totalErrores === 0 && archivos.length > 0) setAdjuntosObligatorios([])
    } catch {
      setError(
        'Error inesperado al reenviar. Si había adjuntos, vuelva a seleccionarlos antes de continuar el envío.'
      )
    } finally {
      setEnviando(false)
      setProgresoEnvio(null)
    }
  }

  const etiquetaCiclo = etiquetaCicloEscolar(cicloFiltro, opcionesCatalogo)
  const destIndividual = destinatarios[0] ?? null

  return (
    <div className="servicios-panel-inner servicios-panel-inner--correo-masivo">
      <header className="servicios-panel-header cm-header">
        <div className="cm-header-texto">
          <h1 className="servicios-panel-title">
            <Mail size={26} strokeWidth={1.75} aria-hidden />
            Correo masivo/individual
          </h1>
          <p className="servicios-panel-lead">
            Comunicados a padres y madres con correo autorizado desde{' '}
            <strong>avisos_no-replay@winston93.edu.mx</strong>. Puedes enviar a un grupo o a un
            solo alumno.
          </p>
        </div>
      </header>

      {sesionRestaurada && resumenGuardado && (
        <div className="cm-restaurar-banner" role="status">
          <div className="cm-restaurar-banner-texto">
            <strong>Envío recuperado</strong> (guardado en este navegador tras recarga o redeploy).
            <span className="cm-restaurar-banner-detalle">
              {resumenGuardado.enviados} enviado(s) · {resumenGuardado.errores} error(es) ·{' '}
              {resumenGuardado.pendientes} pendiente(s)
              {nombresArchivosRecordados.length > 0
                ? ` · Adjuntos antes: ${nombresArchivosRecordados.join(', ')}`
                : ''}
            </span>
          </div>
          <div className="cm-restaurar-banner-acciones">
            {cantidadPorReenviar > 0 && (
              <button
                type="button"
                className="cm-btn cm-btn--primary cm-btn--sm"
                disabled={enviando}
                onClick={onReenviarErrores}
              >
                Continuar envío ({cantidadPorReenviar})
              </button>
            )}
            <button
              type="button"
              className="cm-btn cm-btn--sec cm-btn--descartar cm-btn--sm"
              disabled={enviando}
              onClick={() => {
                if (
                  window.confirm(
                    '¿Descartar el progreso guardado y volver a cargar la lista desde cero?'
                  )
                ) {
                  descartarProgresoGuardado()
                  if (modoEnvio === 'masivo') cargarDestinatariosMasivo()
                  else void cargarDestinatarioIndividual(alumnoIndividual)
                }
              }}
            >
              Descartar y empezar de nuevo
            </button>
          </div>
        </div>
      )}

      <form className="cm-formulario" onSubmit={onEnviar}>
        <div className="cm-modo-toggle" role="tablist" aria-label="Modo de envío">
          <button
            type="button"
            role="tab"
            aria-selected={modoEnvio === 'masivo'}
            className={`cm-modo-btn ${modoEnvio === 'masivo' ? 'cm-modo-btn--activo' : ''}`}
            disabled={enviando}
            onClick={() => cambiarModo('masivo')}
          >
            <Users size={16} aria-hidden />
            Envío masivo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoEnvio === 'individual'}
            className={`cm-modo-btn ${modoEnvio === 'individual' ? 'cm-modo-btn--activo' : ''}`}
            disabled={enviando}
            onClick={() => cambiarModo('individual')}
          >
            <UserRound size={16} aria-hidden />
            Envío individual
          </button>
        </div>

        <div className="cm-form-grid">
          <div className="cm-col-destinatarios">
            {modoEnvio === 'masivo' ? (
              <fieldset className="cm-fieldset">
                <legend>Filtros de destinatarios</legend>
                <div className="cm-filtros-grid">
                  <label>
                    Ciclo escolar
                    <select
                      value={String(cicloFiltro)}
                      onChange={(e) => {
                        tocarFiltro()
                        setCicloFiltro(Number(e.target.value))
                      }}
                      disabled={cargandoCiclos}
                    >
                      {opcionesCatalogo.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nivel
                    <select
                      value={String(nivel)}
                      onChange={(e) => {
                        tocarFiltro()
                        setNivel(Number(e.target.value))
                      }}
                    >
                      {NIVEL_CORREO_OPCIONES.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Grado
                    <select
                      value={String(grado)}
                      onChange={(e) => {
                        tocarFiltro()
                        setGrado(Number(e.target.value))
                      }}
                      disabled={!nivel}
                    >
                      {gradosOpciones.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Grupo
                    <select
                      value={String(grupo)}
                      onChange={(e) => {
                        tocarFiltro()
                        setGrupo(Number(e.target.value))
                      }}
                      disabled={!nivel}
                    >
                      {gruposOpciones.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cm-filtro-extra">
                    Filtro adicional
                    <select
                      value={filtroAdicional}
                      onChange={(e) => {
                        tocarFiltro()
                        setFiltroAdicional(e.target.value as FiltroAdicionalCorreo)
                      }}
                    >
                      {FILTROS_ADICIONALES_OPCIONES.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            ) : (
              <fieldset className="cm-fieldset cm-fieldset--individual">
                <legend>Envío individual</legend>
                <p className="cm-hint cm-hint--compact">
                  Busca por nombre o no. de control. Se usa el mismo asunto, mensaje y adjuntos.
                </p>
                <div className="cm-busqueda-individual">
                  <AlumnoAutocomplete
                    etiqueta="Buscar alumno"
                    autoFocus={false}
                    alumnoSeleccionado={alumnoIndividual}
                    onSeleccionar={onSeleccionarAlumnoIndividual}
                    cualquierCiclo
                  />
                </div>
                {destIndividual && (
                  <div className="cm-alumno-individual-card" aria-live="polite">
                    <div className="cm-alumno-individual-main">
                      <strong>{destIndividual.nombre_completo}</strong>
                      <span>No. {destIndividual.alumno_ref}</span>
                    </div>
                    <div className="cm-alumno-individual-meta">
                      Correos:{' '}
                      {destIndividual.emails.length
                        ? destIndividual.emails.join(', ')
                        : 'Sin correo autorizado'}
                    </div>
                  </div>
                )}
              </fieldset>
            )}
          </div>

          <fieldset className="cm-fieldset">
            <legend>Contenido del correo</legend>
            <label>
              Asunto
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Asunto del correo…"
                maxLength={200}
                required
              />
            </label>
            <label>
              Mensaje
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escriba su mensaje…"
                rows={8}
                required
              />
            </label>
          </fieldset>

          <fieldset className="cm-fieldset cm-fieldset--adjuntos">
            <legend>Archivos adjuntos</legend>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="cm-file-input"
              onChange={onArchivos}
            />
            <button
              type="button"
              className="cm-btn cm-btn--sec"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} aria-hidden />
              Agregar archivos
            </button>
            {archivos.length > 0 && (
              <ul className="cm-archivos-lista">
                {archivos.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span>{f.name}</span>
                    <button type="button" onClick={() => quitarArchivo(i)} aria-label="Quitar">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {archivos.length === 0 && (
              <p
                className={`cm-hint${adjuntosObligatorios.length > 0 ? ' cm-hint--warn' : ''}`}
              >
                Puede adjuntar uno o más archivos (PDF, imágenes, etc.).
                {adjuntosObligatorios.length > 0 && (
                  <>
                    {' '}
                    <strong>
                      Obligatorio volver a seleccionar: {adjuntosObligatorios.join(', ')}. Sin
                      esto, el reintento envía el correo sin archivos.
                    </strong>
                  </>
                )}
              </p>
            )}
          </fieldset>
        </div>

        <div className="cm-form-acciones">
          {faseEnvio === 'resultado' && cantidadPorReenviar > 0 && !sesionRestaurada && (
            <button
              type="button"
              className="cm-btn cm-btn--sec"
              disabled={enviando}
              onClick={onReenviarErrores}
            >
              <RotateCcw size={18} aria-hidden />
              {modoEnvio === 'individual'
                ? 'Reintentar envío'
                : `Continuar envío (${cantidadPorReenviar})`}
            </button>
          )}
          <button
            type="submit"
            className="cm-btn cm-btn--primary"
            disabled={enviando || cargandoLista || resumen.conCorreo === 0}
          >
            {enviando ? (
              <Loader2 size={20} className="cm-spin" aria-hidden />
            ) : (
              <Send size={20} aria-hidden />
            )}
            {modoEnvio === 'individual' ? 'Enviar a este alumno' : 'Enviar correo'}
          </button>
        </div>
      </form>

      {(progresoEnvio || error || mensajeOk) && (
        <p
          className={`cm-alerta ${error ? 'cm-alerta--error' : progresoEnvio ? 'cm-alerta--progreso' : 'cm-alerta--ok'}`}
          role="status"
        >
          {error ?? progresoEnvio ?? mensajeOk}
        </p>
      )}

      <section className="cm-destinatarios" aria-labelledby="cm-dest-titulo">
        <div className="cm-destinatarios-header">
          <h2 id="cm-dest-titulo" className="cm-destinatarios-titulo">
            {modoEnvio === 'individual' ? (
              <UserRound size={20} aria-hidden />
            ) : (
              <Users size={20} aria-hidden />
            )}
            {modoEnvio === 'individual' ? 'Destinatario' : 'Destinatarios'}
            {modoEnvio === 'masivo' && etiquetaCiclo ? ` · ${etiquetaCiclo}` : ''}
          </h2>
          <div className="cm-resumen-chips">
            <span className="cm-chip">
              {resumen.total} {resumen.total === 1 ? 'alumno' : 'alumno(s)'}
            </span>
            <span className="cm-chip cm-chip--ok">{resumen.conCorreo} con correo</span>
            {resumen.sinCorreo > 0 && (
              <span className="cm-chip cm-chip--warn">{resumen.sinCorreo} sin correo</span>
            )}
          </div>
        </div>

        {cargandoLista ? (
          <div className="cm-loading" role="status">
            <Loader2 size={24} className="cm-spin" aria-hidden />
            <span>
              {modoEnvio === 'individual' ? 'Cargando alumno…' : 'Cargando alumnos activos…'}
            </span>
          </div>
        ) : grupos.length === 0 ? (
          <p className="cm-hint cm-hint--center">
            {modoEnvio === 'individual'
              ? 'Busca y selecciona un alumno para ver sus correos.'
              : 'No hay alumnos activos con los filtros seleccionados.'}
          </p>
        ) : (
          <div className="cm-grupos-lista">
            {grupos.map((g) => (
              <article key={g.clave} className="cm-grupo-card">
                <header className="cm-grupo-card-header">
                  <h3>
                    {g.etiqueta_nivel} · {g.etiqueta_grado} · Grupo {g.etiqueta_grupo}
                  </h3>
                  <span className="cm-grupo-count">{g.destinatarios.length} alumno(s)</span>
                </header>
                <div className="cm-tabla-wrap">
                  <table className="cm-tabla">
                    <thead>
                      <tr>
                        <th>No. control</th>
                        <th>Alumno</th>
                        <th>Correos</th>
                        {modoEnvio === 'masivo' && filtroAdicional === 'becados' && (
                          <>
                            <th>Tipo de beca</th>
                            <th>Porcentaje</th>
                          </>
                        )}
                        {faseEnvio === 'resultado' && <th>Estado</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {g.destinatarios.map((d) => (
                        <tr key={d.alumno_id}>
                          <td>{d.alumno_ref}</td>
                          <td>{d.nombre_completo}</td>
                          <td className="cm-correos-celda">
                            {d.emails.length ? d.emails.join(', ') : '—'}
                          </td>
                          {modoEnvio === 'masivo' && filtroAdicional === 'becados' && (
                            <>
                              <td>{d.beca_tipo?.trim() || '—'}</td>
                              <td>
                                {d.beca_porcentaje != null && Number.isFinite(d.beca_porcentaje)
                                  ? `${d.beca_porcentaje}%`
                                  : '—'}
                              </td>
                            </>
                          )}
                          {faseEnvio === 'resultado' && (
                            <td>
                              <span className={claseEstadoEnvio(d.estado)}>
                                {etiquetaEstadoEnvio(d.estado)}
                              </span>
                              <span className="cm-estado-detalle">{d.mensaje_estado}</span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
