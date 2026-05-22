'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Mail, Paperclip, Send, Users } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
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

export default function CorreoMasivoModulo() {
  const { cicloSeleccionado, opcionesCatalogo, cargando: cargandoCiclos } = useCicloEscolar()

  const [cicloFiltro, setCicloFiltro] = useState(cicloSeleccionado)
  const [nivel, setNivel] = useState(0)
  const [grado, setGrado] = useState(0)
  const [grupo, setGrupo] = useState(0)
  const [filtroAdicional, setFiltroAdicional] = useState<FiltroAdicionalCorreo>('sin-filtro')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])

  const [destinatarios, setDestinatarios] = useState<DestinatarioCorreoMasivo[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeOk, setMensajeOk] = useState<string | null>(null)
  const [faseEnvio, setFaseEnvio] = useState<'preview' | 'resultado'>('preview')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCicloFiltro(cicloSeleccionado)
  }, [cicloSeleccionado])

  useEffect(() => {
    setGrado(0)
    setGrupo(0)
  }, [nivel])

  const gradosOpciones = useMemo(() => gradoCorreoOpciones(nivel || null), [nivel])
  const gruposOpciones = useMemo(() => {
    const base = [{ valor: 0, etiqueta: 'Todos los grupos' }]
    if (!nivel) return [{ valor: 0, etiqueta: 'Seleccione nivel primero' }]
    return [...base, ...gruposOpcionesPorNivel(nivel)]
  }, [nivel])

  const cargarDestinatarios = useCallback(async () => {
    if (!cicloFiltro) return
    setCargandoLista(true)
    setError(null)
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
    } catch {
      setError('Error de red al cargar destinatarios')
      setDestinatarios([])
    } finally {
      setCargandoLista(false)
    }
  }, [cicloFiltro, nivel, grado, grupo, filtroAdicional])

  useEffect(() => {
    if (cargandoCiclos || !cicloFiltro) return
    const t = setTimeout(() => cargarDestinatarios(), 280)
    return () => clearTimeout(t)
  }, [cargarDestinatarios, cargandoCiclos, cicloFiltro])

  const grupos = useMemo(() => agruparDestinatariosPorSeccion(destinatarios), [destinatarios])
  const resumen = useMemo(() => resumenDestinatarios(destinatarios), [destinatarios])

  const onArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = e.target.files ? [...e.target.files] : []
    setArchivos((prev) => [...prev, ...lista])
    e.target.value = ''
  }

  const quitarArchivo = (idx: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== idx))
  }

  const onEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMensajeOk(null)

    if (!asunto.trim() || !mensaje.trim()) {
      setError('Captura asunto y mensaje.')
      return
    }
    if (!cicloFiltro) {
      setError('Selecciona el ciclo escolar.')
      return
    }
    if (resumen.conCorreo === 0) {
      setError('No hay alumnos con correo autorizado para enviar.')
      return
    }
    if (!window.confirm(`¿Enviar correo a ${resumen.conCorreo} alumno(s) con correo registrado?`)) {
      return
    }

    setEnviando(true)
    try {
      const fd = new FormData()
      fd.set('asunto', asunto.trim())
      fd.set('mensaje', mensaje.trim())
      fd.set(
        'filtros',
        JSON.stringify({
          cicloEscolar: cicloFiltro,
          nivel: nivel > 0 ? nivel : null,
          grado: grado > 0 ? grado : null,
          grupo: grupo > 0 ? grupo : null,
          filtroAdicional,
        })
      )
      for (const f of archivos) fd.append('archivos', f)

      const res = await fetch('/api/correo-masivo/enviar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Error al enviar correos')
        return
      }

      setDestinatarios(json.resultados ?? [])
      setFaseEnvio('resultado')
      const r = json.resumen
      setMensajeOk(
        `Proceso terminado: ${r.enviados} enviado(s), ${r.errores} error(es), ${r.sinCorreo} sin correo.`
      )
    } catch {
      setError('Error de red al enviar correos')
    } finally {
      setEnviando(false)
    }
  }

  const etiquetaCiclo = etiquetaCicloEscolar(cicloFiltro, opcionesCatalogo)

  return (
    <div className="servicios-panel-inner servicios-panel-inner--correo-masivo">
      <header className="servicios-panel-header cm-header">
        <div className="cm-header-texto">
          <h1 className="servicios-panel-title">
            <Mail size={26} strokeWidth={1.75} aria-hidden />
            Correo masivo
          </h1>
          <p className="servicios-panel-lead">
            Envía comunicados a padres y madres con correo autorizado desde{' '}
            <strong>avisos_no-replay@winston93.edu.mx</strong>.
          </p>
        </div>
      </header>

      <form className="cm-formulario" onSubmit={onEnviar}>
        <div className="cm-form-grid">
          <fieldset className="cm-fieldset">
            <legend>Filtros de destinatarios</legend>
            <div className="cm-filtros-grid">
              <label>
                Ciclo escolar
                <select
                  value={String(cicloFiltro)}
                  onChange={(e) => setCicloFiltro(Number(e.target.value))}
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
                  onChange={(e) => setNivel(Number(e.target.value))}
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
                  onChange={(e) => setGrado(Number(e.target.value))}
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
                  onChange={(e) => setGrupo(Number(e.target.value))}
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
                  onChange={(e) =>
                    setFiltroAdicional(e.target.value as FiltroAdicionalCorreo)
                  }
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
              <p className="cm-hint">Puede adjuntar uno o más archivos (PDF, imágenes, etc.).</p>
            )}
          </fieldset>
        </div>

        <div className="cm-form-acciones">
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
            Enviar correo
          </button>
        </div>
      </form>

      {(error || mensajeOk) && (
        <p className={`cm-alerta ${error ? 'cm-alerta--error' : 'cm-alerta--ok'}`} role="status">
          {error ?? mensajeOk}
        </p>
      )}

      <section className="cm-destinatarios" aria-labelledby="cm-dest-titulo">
        <div className="cm-destinatarios-header">
          <h2 id="cm-dest-titulo" className="cm-destinatarios-titulo">
            <Users size={20} aria-hidden />
            Destinatarios
            {etiquetaCiclo ? ` · ${etiquetaCiclo}` : ''}
          </h2>
          <div className="cm-resumen-chips">
            <span className="cm-chip">{resumen.total} alumno(s)</span>
            <span className="cm-chip cm-chip--ok">{resumen.conCorreo} con correo</span>
            {resumen.sinCorreo > 0 && (
              <span className="cm-chip cm-chip--warn">{resumen.sinCorreo} sin correo</span>
            )}
          </div>
        </div>

        {cargandoLista ? (
          <div className="cm-loading" role="status">
            <Loader2 size={24} className="cm-spin" aria-hidden />
            <span>Cargando alumnos activos…</span>
          </div>
        ) : grupos.length === 0 ? (
          <p className="cm-hint cm-hint--center">
            No hay alumnos activos con los filtros seleccionados.
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
