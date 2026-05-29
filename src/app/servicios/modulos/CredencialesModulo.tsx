'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  GraduationCap,
  ImagePlus,
  KeyRound,
  Loader2,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { gradoOpcionesPorNivel } from '@/lib/gradoEscolar'
import { NIVELES_ESCOLARES_OPCIONES } from '@/lib/nivelEscolar'
import { NIVELES_CREDENCIAL, urlVistaPreviaFondo } from '@/lib/credencialesConfig'

type TabCredenciales = 'alumnos' | 'maestros'

const GRUPOS = [
  { valor: 0, etiqueta: 'Todos los grupos' },
  { valor: 1, etiqueta: 'A' },
  { valor: 2, etiqueta: 'B' },
  { valor: 3, etiqueta: 'C' },
  { valor: 4, etiqueta: 'D' },
]

export default function CredencialesModulo() {
  const { cicloSeleccionado, cicloActualSistema, opcionesCatalogo } = useCicloEscolar()
  const [tab, setTab] = useState<TabCredenciales>('alumnos')
  const [nivel, setNivel] = useState(0)
  const [grado, setGrado] = useState(0)
  const [grupo, setGrupo] = useState(0)
  const [controles, setControles] = useState('')
  const [cicloReporte, setCicloReporte] = useState<number | null>(null)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [totalGenerado, setTotalGenerado] = useState<number | null>(null)
  const [subiendoNivel, setSubiendoNivel] = useState<number | null>(null)
  const [fondoBust, setFondoBust] = useState(Date.now())
  const [mensajeFondo, setMensajeFondo] = useState<string | null>(null)

  const cicloEfectivo = cicloReporte ?? cicloSeleccionado ?? cicloActualSistema ?? 22
  const opcionesGrado = useMemo(() => {
    if (!nivel) return [{ valor: 0, etiqueta: 'Todos los grados' }]
    return [{ valor: 0, etiqueta: 'Todos los grados' }, ...gradoOpcionesPorNivel(nivel)]
  }, [nivel])

  const generar = useCallback(async () => {
    setGenerando(true)
    setError(null)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setTotalGenerado(null)

    try {
      const res = await fetch('/api/credenciales/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tab,
          cicloEscolar: cicloEfectivo,
          nivel: nivel || undefined,
          grado: tab === 'alumnos' ? grado || undefined : undefined,
          grupo: tab === 'alumnos' ? grupo || undefined : undefined,
          controles: tab === 'alumnos' ? controles.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        return
      }
      setTotalGenerado(data.total as number)
      const bin = atob(data.pdfBase64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      setPdfUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setGenerando(false)
    }
  }, [tab, cicloEfectivo, nivel, grado, grupo, controles, pdfUrl])

  const subirFondo = useCallback(async (nivelFondo: number, file: File) => {
    setSubiendoNivel(nivelFondo)
    setMensajeFondo(null)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('nivel', String(nivelFondo))
      fd.set('archivo', file)
      const res = await fetch('/api/credenciales/fondo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el fondo')
        return
      }
      setFondoBust(Date.now())
      setMensajeFondo(`Fondo de ${data.etiqueta} actualizado (${data.via === 'storage' ? 'nube' : 'servidor'}).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setSubiendoNivel(null)
    }
  }, [])

  return (
    <div className="servicios-panel-inner cred-modulo">
      <header className="cred-hero">
        <div className="cred-hero-glow" aria-hidden />
        <div className="cred-hero-inner">
          <div className="cred-hero-icono" aria-hidden>
            <KeyRound size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="cred-hero-kicker">
              <Sparkles size={14} aria-hidden />
              Impresión institucional
            </p>
            <h1 className="cred-hero-titulo">Credenciales</h1>
            <p className="cred-hero-sub">
              Genera credenciales de alumnos o maestros con el diseño oficial por nivel. Personaliza
              el fondo de cada nivel cuando lo necesites.
            </p>
          </div>
        </div>
      </header>

      <section className="cred-fondos-panel">
        <div className="cred-fondos-head">
          <h2 className="cred-seccion-titulo">
            <ImagePlus size={18} aria-hidden />
            Fondos por nivel
          </h2>
          <p className="cred-seccion-lead">
            Imagen por defecto del sistema legacy. Sube una nueva para reemplazarla en el PDF (96×58
            mm por tarjeta).
          </p>
        </div>
        <div className="cred-fondos-grid">
          {NIVELES_CREDENCIAL.map((n) => (
            <article key={n.nivel} className="cred-fondo-card">
              <div className="cred-fondo-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlVistaPreviaFondo(n.nivel, fondoBust)}
                  alt={`Fondo ${n.etiqueta}`}
                  className="cred-fondo-preview"
                />
              </div>
              <div className="cred-fondo-meta">
                <span className="cred-fondo-nivel">{n.etiqueta}</span>
                <label className="cred-fondo-upload">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="cred-fondo-input"
                    disabled={subiendoNivel === n.nivel}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void subirFondo(n.nivel, f)
                      e.target.value = ''
                    }}
                  />
                  {subiendoNivel === n.nivel ? (
                    <>
                      <Loader2 className="cred-spin" size={14} aria-hidden />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload size={14} aria-hidden />
                      Cambiar fondo
                    </>
                  )}
                </label>
              </div>
            </article>
          ))}
        </div>
        {mensajeFondo && (
          <p className="cred-fondo-ok" role="status">
            {mensajeFondo}
          </p>
        )}
      </section>

      <div className="cred-tabs" role="tablist" aria-label="Tipo de credencial">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'alumnos'}
          className={`cred-tab ${tab === 'alumnos' ? 'cred-tab--activo' : ''}`}
          onClick={() => setTab('alumnos')}
        >
          <GraduationCap size={18} aria-hidden />
          Alumnos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'maestros'}
          className={`cred-tab ${tab === 'maestros' ? 'cred-tab--activo' : ''}`}
          onClick={() => setTab('maestros')}
        >
          <Users size={18} aria-hidden />
          Maestros
        </button>
      </div>

      <div className="cred-layout">
        <section className="cred-form-card" role="tabpanel">
          {tab === 'alumnos' ? (
            <>
              <h2 className="cred-form-titulo">Credenciales de alumnos</h2>

              <label className="cred-label" htmlFor="cred-ciclo">
                Ciclo escolar
              </label>
              <select
                id="cred-ciclo"
                className="cred-select"
                value={cicloEfectivo}
                onChange={(e) => setCicloReporte(Number(e.target.value))}
              >
                {opcionesCatalogo.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                    {o.valor === cicloActualSistema ? ' (activo)' : ''}
                  </option>
                ))}
              </select>

              <label className="cred-label" htmlFor="cred-nivel-a">
                Nivel
              </label>
              <select
                id="cred-nivel-a"
                className="cred-select"
                value={nivel}
                onChange={(e) => {
                  setNivel(Number(e.target.value))
                  setGrado(0)
                }}
              >
                <option value={0}>Todos</option>
                {NIVELES_ESCOLARES_OPCIONES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>

              <label className="cred-label" htmlFor="cred-grado">
                Grado
              </label>
              <select
                id="cred-grado"
                className="cred-select"
                value={grado}
                onChange={(e) => setGrado(Number(e.target.value))}
              >
                {opcionesGrado.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>

              <label className="cred-label" htmlFor="cred-grupo">
                Grupo
              </label>
              <select
                id="cred-grupo"
                className="cred-select"
                value={grupo}
                onChange={(e) => setGrupo(Number(e.target.value))}
              >
                {GRUPOS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>

              <label className="cred-label" htmlFor="cred-controles">
                Números de control
              </label>
              <input
                id="cred-controles"
                type="text"
                className="cred-input"
                placeholder="11111, 12345, 20064…"
                value={controles}
                onChange={(e) => setControles(e.target.value)}
              />
              <p className="cred-hint">Opcional. Si los capturas, ignoran nivel/grado/grupo.</p>
            </>
          ) : (
            <>
              <h2 className="cred-form-titulo">Credenciales de maestros</h2>
              <p className="cred-hint cred-hint--block">
                Genera credenciales del personal docente registrado en boleta (tablas{' '}
                <code>boleta_maestro</code>).
              </p>

              <label className="cred-label" htmlFor="cred-nivel-m">
                Filtrar por nivel
              </label>
              <select
                id="cred-nivel-m"
                className="cred-select"
                value={nivel}
                onChange={(e) => setNivel(Number(e.target.value))}
              >
                <option value={0}>Todos los maestros</option>
                {NIVELES_ESCOLARES_OPCIONES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            type="button"
            className="cred-btn cred-btn--primario"
            disabled={generando}
            onClick={() => void generar()}
          >
            {generando ? (
              <>
                <Loader2 className="cred-spin" size={18} aria-hidden />
                Generando PDF…
              </>
            ) : (
              <>Generar credenciales</>
            )}
          </button>
        </section>

        <section className="cred-preview-card">
          {pdfUrl ? (
            <>
              <div className="cred-preview-bar">
                {totalGenerado != null && (
                  <span className="cred-preview-badge">{totalGenerado} credencial(es)</span>
                )}
                <a href={pdfUrl} download={`credenciales_${tab}.pdf`} className="cred-btn cred-btn--sec">
                  Descargar PDF
                </a>
              </div>
              <iframe title="Vista previa credenciales" src={pdfUrl} className="cred-pdf-frame" />
            </>
          ) : (
            <div className="cred-preview-vacio">
              <KeyRound size={40} strokeWidth={1.25} aria-hidden />
              <p>El PDF aparecerá aquí al generar credenciales.</p>
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="cred-alerta cred-alerta--error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
