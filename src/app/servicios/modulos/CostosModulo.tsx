'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Loader2, Save } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { NIVELES_ESCOLARES_OPCIONES, etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import ConceptosPagoCatalogo from './ConceptosPagoCatalogo'

type TabCostos = 'precios' | 'conceptos'

type CostoFila = {
  precio_id: number
  alumno_nivel: number
  precio_inscripcion: number
  precio_agosto: number
  precio_colegiatura: number
  precio_colegiatura2: number
  precio_material: number
  precio_seguro: number
  precio_cuota_padres: number
  precio_cambridge: number
  precio_dtitulacion: number
  descuento_cambio_nivel: number
  descuento_cambio_grado: number
  precio_ciclo_escolar: number
  etiqueta: string
  evaluacion_herramientas: number
}

type FormCostos = {
  precio_inscripcion: string
  precio_agosto: string
  precio_colegiatura: string
  precio_colegiatura2: string
  evaluacion_herramientas: string
  precio_cuota_padres: string
  precio_cambridge: string
  precio_dtitulacion: string
  descuento_cambio_nivel: string
  descuento_cambio_grado: string
}

const FORM_VACIO: FormCostos = {
  precio_inscripcion: '0',
  precio_agosto: '0',
  precio_colegiatura: '0',
  precio_colegiatura2: '0',
  evaluacion_herramientas: '0',
  precio_cuota_padres: '0',
  precio_cambridge: '0',
  precio_dtitulacion: '0',
  descuento_cambio_nivel: '0',
  descuento_cambio_grado: '0',
}

function filaAForm(fila: CostoFila | null | undefined): FormCostos {
  if (!fila) return { ...FORM_VACIO }
  return {
    precio_inscripcion: String(fila.precio_inscripcion),
    precio_agosto: String(fila.precio_agosto),
    precio_colegiatura: String(fila.precio_colegiatura),
    precio_colegiatura2: String(fila.precio_colegiatura2),
    evaluacion_herramientas: String(fila.evaluacion_herramientas),
    precio_cuota_padres: String(fila.precio_cuota_padres),
    precio_cambridge: String(fila.precio_cambridge),
    precio_dtitulacion: String(fila.precio_dtitulacion),
    descuento_cambio_nivel: String(fila.descuento_cambio_nivel),
    descuento_cambio_grado: String(fila.descuento_cambio_grado),
  }
}

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default function CostosModulo() {
  const { cicloSeleccionado, cicloActualSistema, opcionesCatalogo } = useCicloEscolar()
  const [tab, setTab] = useState<TabCostos>('precios')
  const [ciclo, setCiclo] = useState<number | null>(null)
  const [nivel, setNivel] = useState(1)
  const [lista, setLista] = useState<CostoFila[]>([])
  const [form, setForm] = useState<FormCostos>(FORM_VACIO)
  const [cicloOrigenCopia, setCicloOrigenCopia] = useState<number | ''>('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cicloId = useId()
  const nivelId = useId()
  const copiaId = useId()

  const cicloEfectivo = ciclo ?? cicloSeleccionado ?? cicloActualSistema ?? null

  const porNivel = useMemo(() => new Map(lista.map((f) => [f.alumno_nivel, f])), [lista])

  const cargar = useCallback(async (cicloValor: number) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/costos?ciclo=${cicloValor}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        setLista([])
        return
      }
      setLista((data.filas ?? []) as CostoFila[])
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

  useEffect(() => {
    setForm(filaAForm(porNivel.get(nivel)))
  }, [nivel, porNivel])

  const setCampo = (key: keyof FormCostos, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cicloEfectivo == null) {
      setError('Selecciona un ciclo escolar.')
      return
    }
    setGuardando(true)
    setMensaje(null)
    setError(null)
    try {
      const res = await fetch('/api/costos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciclo: cicloEfectivo,
          nivel,
          precio_inscripcion: Number(form.precio_inscripcion),
          precio_agosto: Number(form.precio_agosto),
          precio_colegiatura: Number(form.precio_colegiatura),
          precio_colegiatura2: Number(form.precio_colegiatura2),
          evaluacion_herramientas: Number(form.evaluacion_herramientas),
          precio_cuota_padres: Number(form.precio_cuota_padres),
          precio_cambridge: Number(form.precio_cambridge),
          precio_dtitulacion: Number(form.precio_dtitulacion),
          descuento_cambio_nivel: Number(form.descuento_cambio_nivel),
          descuento_cambio_grado: Number(form.descuento_cambio_grado),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar')
        return
      }
      setMensaje(
        `Costos de ${etiquetaNivelEscolar(nivel)} guardados para el ciclo ${cicloEfectivo}.`
      )
      await cargar(cicloEfectivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  const onCopiar = async () => {
    if (cicloEfectivo == null || cicloOrigenCopia === '') {
      setError('Elige ciclo origen y destino.')
      return
    }
    if (
      !window.confirm(
        `¿Copiar todos los niveles del ciclo ${cicloOrigenCopia} al ciclo ${cicloEfectivo}? Se sobrescribirán los precios del destino.`
      )
    ) {
      return
    }
    setCopiando(true)
    setMensaje(null)
    setError(null)
    try {
      const res = await fetch('/api/costos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cicloOrigen: Number(cicloOrigenCopia),
          cicloDestino: cicloEfectivo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo copiar')
        return
      }
      setMensaje(`Se copiaron ${data.copiados} nivel(es) al ciclo ${cicloEfectivo}.`)
      await cargar(cicloEfectivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setCopiando(false)
    }
  }

  const camposPrincipales: { key: keyof FormCostos; label: string; hint?: string }[] = [
    { key: 'precio_inscripcion', label: 'Inscripción', hint: 'Conceptos 11 / 12 / 13' },
    {
      key: 'precio_agosto',
      label: 'Cuota de inicio de ciclo escolar',
      hint: 'Concepto 00',
    },
    {
      key: 'precio_colegiatura',
      label: 'Colegiatura 10 meses (sep–jun)',
      hint: 'Plan mensual 01–10',
    },
    {
      key: 'precio_colegiatura2',
      label: 'Colegiatura 11 meses (sep–jul)',
      hint: 'Plan 11 meses / concepto 26',
    },
    {
      key: 'evaluacion_herramientas',
      label: 'Herramientas Tecnológicas y Evaluaciones',
      hint: 'Concepto 17 · 2do. pago (Enero)',
    },
    {
      key: 'precio_cambridge',
      label: 'Cambridge (total anual)',
      hint: '18/19 = mitad · 20 = total',
    },
    {
      key: 'precio_dtitulacion',
      label: 'Doble titulación (total)',
      hint: '23 / 24 / 25 = tercio cada uno',
    },
    { key: 'precio_cuota_padres', label: 'Cuota de padres', hint: 'Concepto 21' },
  ]

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Costos</h1>
        <p className="servicios-panel-lead">
          Precios por ciclo/nivel (<code>pago_boucher_precio</code>) y catálogo de conceptos de
          pago (<code>concepto_boucher</code>).
        </p>
      </header>

      <div className="costos-tabs" role="tablist" aria-label="Secciones de costos">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'precios'}
          className={`costos-tab${tab === 'precios' ? ' is-active' : ''}`}
          onClick={() => setTab('precios')}
        >
          Precios por nivel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'conceptos'}
          className={`costos-tab${tab === 'conceptos' ? ' is-active' : ''}`}
          onClick={() => setTab('conceptos')}
        >
          Conceptos de pago
        </button>
      </div>

      {tab === 'conceptos' ? (
        <ConceptosPagoCatalogo />
      ) : (
      <div className="costos-layout">
        <section className="ciclos-crud-form-card costos-form-card" aria-labelledby="costos-form-titulo">
          <h2 id="costos-form-titulo" className="ciclos-crud-form-title">
            Editar costos
          </h2>

          <form className="ciclos-crud-form" onSubmit={onGuardar}>
            <div className="ciclos-crud-field-row">
              <div className="ciclos-crud-field">
                <label htmlFor={cicloId}>Ciclo escolar</label>
                <select
                  id={cicloId}
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
              </div>
              <div className="ciclos-crud-field">
                <label htmlFor={nivelId}>Nivel</label>
                <select
                  id={nivelId}
                  value={nivel}
                  onChange={(e) => setNivel(Number(e.target.value))}
                >
                  {NIVELES_ESCOLARES_OPCIONES.map((n) => (
                    <option key={n.valor} value={n.valor}>
                      {n.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="costos-fields-grid">
              {camposPrincipales.map((campo) => (
                <div key={campo.key} className="ciclos-crud-field">
                  <label htmlFor={`costo-${campo.key}`}>{campo.label}</label>
                  {campo.hint ? <p className="costos-field-hint">{campo.hint}</p> : null}
                  <input
                    id={`costo-${campo.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form[campo.key]}
                    onChange={(e) => setCampo(campo.key, e.target.value)}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="ciclos-crud-field-row">
              <div className="ciclos-crud-field">
                <label htmlFor="costo-desc-nivel">Descuento cambio de nivel (%)</label>
                <input
                  id="costo-desc-nivel"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.descuento_cambio_nivel}
                  onChange={(e) => setCampo('descuento_cambio_nivel', e.target.value)}
                />
              </div>
              <div className="ciclos-crud-field">
                <label htmlFor="costo-desc-grado">Descuento cambio de grado (%)</label>
                <input
                  id="costo-desc-grado"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.descuento_cambio_grado}
                  onChange={(e) => setCampo('descuento_cambio_grado', e.target.value)}
                />
              </div>
            </div>

            {mensaje ? (
              <p className="ciclos-crud-msg ciclos-crud-msg--ok" role="status">
                {mensaje}
              </p>
            ) : null}
            {error ? (
              <p className="ciclos-crud-msg ciclos-crud-msg--error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ciclos-crud-form-actions">
              <button
                type="submit"
                className="ciclos-crud-btn ciclos-crud-btn--primary"
                disabled={guardando || cicloEfectivo == null}
              >
                {guardando ? (
                  <>
                    <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save size={18} aria-hidden />
                    Guardar costos
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="costos-copy-block">
            <h3 className="costos-copy-title">Copiar desde otro ciclo</h3>
            <p className="costos-field-hint">
              Rellena o sobrescribe los 4 niveles del ciclo seleccionado arriba.
            </p>
            <div className="costos-copy-row">
              <div className="ciclos-crud-field">
                <label htmlFor={copiaId}>Ciclo origen</label>
                <select
                  id={copiaId}
                  value={cicloOrigenCopia}
                  onChange={(e) =>
                    setCicloOrigenCopia(e.target.value === '' ? '' : Number(e.target.value))
                  }
                >
                  <option value="">Selecciona origen</option>
                  {opcionesCatalogo
                    .filter((c) => c.valor !== cicloEfectivo)
                    .map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.etiqueta}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                className="ciclos-crud-btn ciclos-crud-btn--secondary"
                disabled={copiando || cicloEfectivo == null || cicloOrigenCopia === ''}
                onClick={onCopiar}
              >
                {copiando ? (
                  <>
                    <Loader2 size={16} className="ciclos-crud-spin" aria-hidden />
                    Copiando…
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden />
                    Copiar al ciclo actual
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <section className="ciclos-crud-table-card" aria-labelledby="costos-lista-titulo">
          <div className="ciclos-crud-table-header">
            <h2 id="costos-lista-titulo" className="ciclos-crud-form-title">
              Resumen por nivel
              {cicloEfectivo != null ? ` · ciclo ${cicloEfectivo}` : ''}
            </h2>
            {!cargando ? (
              <p className="costos-list-summary">
                {lista.length} de {NIVELES_ESCOLARES_OPCIONES.length} con fila
              </p>
            ) : null}
          </div>

          {cargando ? (
            <p className="ciclos-crud-loading">
              <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
              Cargando…
            </p>
          ) : (
            <ul className="costos-nivel-grid">
              {NIVELES_ESCOLARES_OPCIONES.map((n) => {
                const fila = porNivel.get(n.valor)
                const activo = n.valor === nivel
                return (
                  <li key={n.valor}>
                    <button
                      type="button"
                      className={`costos-nivel-card${fila ? ' is-ready' : ''}${activo ? ' is-active' : ''}`}
                      onClick={() => setNivel(n.valor)}
                    >
                      <div className="costos-nivel-card-top">
                        <span className="costos-nivel-name">{n.etiqueta}</span>
                        {fila ? (
                          <span className="costos-nivel-badge costos-nivel-badge--ok">
                            <CheckCircle2 size={14} aria-hidden />
                            Con precios
                          </span>
                        ) : (
                          <span className="costos-nivel-badge">Sin fila</span>
                        )}
                      </div>
                      {fila ? (
                        <dl className="costos-nivel-stats">
                          <div>
                            <dt>Inscripción</dt>
                            <dd>{money(fila.precio_inscripcion)}</dd>
                          </div>
                          <div>
                            <dt>Inicio ciclo</dt>
                            <dd>{money(fila.precio_agosto)}</dd>
                          </div>
                          <div>
                            <dt>Coleg. 10m</dt>
                            <dd>{money(fila.precio_colegiatura)}</dd>
                          </div>
                          <div>
                            <dt>Coleg. 11m</dt>
                            <dd>{money(fila.precio_colegiatura2)}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="costos-nivel-empty">
                          Aún no hay precios. Guarda el formulario o copia desde otro ciclo.
                        </p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      )}
    </div>
  )
}
