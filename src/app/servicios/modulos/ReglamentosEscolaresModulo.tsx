'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { NIVELES_ESCOLARES_OPCIONES } from '@/lib/nivelEscolar'

type ReglamentoFila = {
  id: number
  nivel: number
  ciclo_valor: number
  storage_key: string
  storage_url: string
  nombre_archivo: string | null
  updated_at: string
  etiqueta: string
  href: string
}

export default function ReglamentosEscolaresModulo() {
  const { cicloSeleccionado, cicloActualSistema, opcionesCatalogo } = useCicloEscolar()
  const [ciclo, setCiclo] = useState<number | null>(null)
  const [nivel, setNivel] = useState(1)
  const [lista, setLista] = useState<ReglamentoFila[]>([])
  const [cargando, setCargando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminandoNivel, setEliminandoNivel] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cicloEfectivo = ciclo ?? cicloSeleccionado ?? cicloActualSistema ?? null

  const cargar = useCallback(async (cicloValor: number) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/reglamentos?ciclo=${cicloValor}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        setLista([])
        return
      }
      setLista((data.reglamentos ?? []) as ReglamentoFila[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (cicloEfectivo == null) return
    cargar(cicloEfectivo)
  }, [cicloEfectivo, cargar])

  const onSubir = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (cicloEfectivo == null) {
      setError('Selecciona un ciclo escolar.')
      return
    }
    const form = e.currentTarget
    const input = form.elements.namedItem('archivo') as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) {
      setError('Selecciona un PDF.')
      return
    }

    setSubiendo(true)
    setMensaje(null)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('nivel', String(nivel))
      fd.set('ciclo', String(cicloEfectivo))
      fd.set('archivo', file)
      const res = await fetch('/api/reglamentos', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el reglamento')
        return
      }
      setMensaje(
        `Reglamento de ${data.reglamento?.etiqueta ?? 'nivel'} cargado para el ciclo ${cicloEfectivo}.`
      )
      form.reset()
      await cargar(cicloEfectivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setSubiendo(false)
    }
  }

  const onEliminar = async (fila: ReglamentoFila) => {
    if (
      !window.confirm(
        `¿Eliminar el reglamento de ${fila.etiqueta} (ciclo ${fila.ciclo_valor})?`
      )
    ) {
      return
    }
    setEliminandoNivel(fila.nivel)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(
        `/api/reglamentos?nivel=${fila.nivel}&ciclo=${fila.ciclo_valor}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo eliminar')
        return
      }
      setMensaje('Reglamento eliminado.')
      if (cicloEfectivo != null) await cargar(cicloEfectivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setEliminandoNivel(null)
    }
  }

  const porNivel = new Map(lista.map((r) => [r.nivel, r]))

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header">
        <h1 className="servicios-panel-title">Reglamentos escolares</h1>
        <p className="servicios-panel-lead">
          Carga el PDF del reglamento y carta compromiso por nivel y ciclo. El portal de
          inscripciones usa este archivo en el paso «Reglamento escolar».
        </p>
      </header>

      <div className="ciclos-crud-layout">
        <form className="ciclos-crud-form-card" onSubmit={onSubir}>
          <h2 className="ciclos-crud-form-title">Subir PDF</h2>

          <label className="ciclos-crud-field">
            <span>Ciclo escolar</span>
            <select
              value={cicloEfectivo ?? ''}
              onChange={(e) => setCiclo(Number(e.target.value))}
              required
            >
              <option value="" disabled>
                Selecciona ciclo
              </option>
              {opcionesCatalogo.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="ciclos-crud-field">
            <span>Nivel</span>
            <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))}>
              {NIVELES_ESCOLARES_OPCIONES.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="ciclos-crud-field">
            <span>Archivo PDF (reglamento + carta compromiso)</span>
            <input name="archivo" type="file" accept="application/pdf,.pdf" required />
          </label>

          {mensaje ? <p className="ciclos-crud-msg ciclos-crud-msg--ok">{mensaje}</p> : null}
          {error ? <p className="ciclos-crud-msg ciclos-crud-msg--error">{error}</p> : null}

          <button type="submit" className="ciclos-crud-btn ciclos-crud-btn--primary" disabled={subiendo}>
            {subiendo ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Subiendo…
              </>
            ) : (
              <>
                <Upload size={16} /> Cargar reglamento
              </>
            )}
          </button>
        </form>

        <div className="ciclos-crud-table-card">
          <h2 className="ciclos-crud-form-title">
            Publicados
            {cicloEfectivo != null ? ` · ciclo ${cicloEfectivo}` : ''}
          </h2>

          {cargando ? (
            <p className="servicios-panel-hint">
              <Loader2 size={16} className="animate-spin" /> Cargando…
            </p>
          ) : (
            <div className="ciclos-crud-table-wrap">
              <table className="ciclos-crud-table">
                <thead>
                  <tr>
                    <th>Nivel</th>
                    <th>Archivo</th>
                    <th>Actualizado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {NIVELES_ESCOLARES_OPCIONES.map((n) => {
                    const fila = porNivel.get(n.valor)
                    return (
                      <tr key={n.valor} className={fila ? 'ciclos-crud-row--active' : undefined}>
                        <td>{n.etiqueta}</td>
                        <td>
                          {fila ? (
                            <a href={fila.href} target="_blank" rel="noreferrer">
                              <FileText size={14} /> {fila.nombre_archivo ?? 'Ver PDF'}{' '}
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="servicios-panel-hint">Sin cargar</span>
                          )}
                        </td>
                        <td>
                          {fila
                            ? new Date(fila.updated_at).toLocaleString('es-MX', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td>
                          {fila ? (
                            <button
                              type="button"
                              className="ciclos-crud-btn"
                              disabled={eliminandoNivel === fila.nivel}
                              onClick={() => onEliminar(fila)}
                              title="Eliminar"
                            >
                              {eliminandoNivel === fila.nivel ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
