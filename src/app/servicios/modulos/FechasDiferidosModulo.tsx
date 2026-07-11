'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { CheckCircle2, Copy, Loader2, Save } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import type { FechasDiferidosRegistro } from '@/lib/fechasDiferidosService'

type FormFechas = {
  plan10_dif1_ini: string
  plan10_dif1_fin: string
  plan10_dif2_ini: string
  plan10_dif2_fin: string
  plan11_dif1_ini: string
  plan11_dif1_fin: string
  plan11_dif2_ini: string
  plan11_dif2_fin: string
}

const FORM_VACIO: FormFechas = {
  plan10_dif1_ini: '',
  plan10_dif1_fin: '',
  plan10_dif2_ini: '',
  plan10_dif2_fin: '',
  plan11_dif1_ini: '',
  plan11_dif1_fin: '',
  plan11_dif2_ini: '',
  plan11_dif2_fin: '',
}

function filaAForm(fila: FechasDiferidosRegistro | null | undefined): FormFechas {
  if (!fila) return { ...FORM_VACIO }
  return {
    plan10_dif1_ini: fila.plan10_dif1_ini,
    plan10_dif1_fin: fila.plan10_dif1_fin,
    plan10_dif2_ini: fila.plan10_dif2_ini,
    plan10_dif2_fin: fila.plan10_dif2_fin,
    plan11_dif1_ini: fila.plan11_dif1_ini,
    plan11_dif1_fin: fila.plan11_dif1_fin,
    plan11_dif2_ini: fila.plan11_dif2_ini,
    plan11_dif2_fin: fila.plan11_dif2_fin,
  }
}

function fmtFecha(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default function FechasDiferidosModulo() {
  const { cicloSeleccionado, cicloActualSistema, opcionesCatalogo } = useCicloEscolar()
  const [ciclo, setCiclo] = useState<number | null>(null)
  const [form, setForm] = useState<FormFechas>(FORM_VACIO)
  const [lista, setLista] = useState<FechasDiferidosRegistro[]>([])
  const [existe, setExiste] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [copiarDesde, setCopiarDesde] = useState<number | ''>('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cicloId = useId()

  const cicloEfectivo = ciclo ?? cicloSeleccionado ?? cicloActualSistema ?? null

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch('/api/fechas-diferidos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setLista((data.filas ?? []) as FechasDiferidosRegistro[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al listar fechas')
      setLista([])
    }
  }, [])

  const cargarCiclo = useCallback(async (cicloValor: number) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/fechas-diferidos?ciclo=${cicloValor}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      const fila = (data.fila ?? null) as FechasDiferidosRegistro | null
      setExiste(fila != null)
      setForm(filaAForm(fila))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
      setExiste(false)
      setForm({ ...FORM_VACIO })
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarLista()
  }, [cargarLista])

  useEffect(() => {
    if (cicloEfectivo == null) return
    void cargarCiclo(cicloEfectivo)
  }, [cicloEfectivo, cargarCiclo])

  const setCampo = (key: keyof FormFechas, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
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
      const res = await fetch('/api/fechas-diferidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo: cicloEfectivo, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setExiste(true)
      setForm(filaAForm(data.fila as FechasDiferidosRegistro))
      setMensaje(`Fechas de diferidos guardadas para el ciclo ${cicloEfectivo}.`)
      await cargarLista()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const onCopiar = async () => {
    if (cicloEfectivo == null || copiarDesde === '') {
      setError('Elige ciclo origen y destino.')
      return
    }
    setCopiando(true)
    setMensaje(null)
    setError(null)
    try {
      const res = await fetch('/api/fechas-diferidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo: cicloEfectivo, copiarDesde: Number(copiarDesde) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setExiste(true)
      setForm(filaAForm(data.fila as FechasDiferidosRegistro))
      setMensaje(`Fechas copiadas del ciclo ${copiarDesde} al ${cicloEfectivo}.`)
      await cargarLista()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al copiar')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Fechas de diferidos</h1>
        <p className="servicios-panel-lead">
          Ventanas del 1.er y 2.º diferido de reinscripción por ciclo (
          <code>iwc_gral_ins</code>). El portal las usa según el plan del alumno: 10 meses o 11
          meses.
        </p>
      </header>

      <div className="costos-layout">
        <section className="ciclos-crud-form-card costos-form-card" aria-labelledby="fd-form-titulo">
          <h2 id="fd-form-titulo" className="ciclos-crud-form-title">
            {existe ? 'Editar fechas' : 'Capturar fechas'}
          </h2>

          <form className="ciclos-crud-form" onSubmit={onGuardar}>
            <div className="ciclos-crud-field">
              <label htmlFor={cicloId}>Ciclo de inscripción (cen)</label>
              <select
                id={cicloId}
                value={cicloEfectivo ?? ''}
                onChange={(e) => setCiclo(Number(e.target.value) || null)}
              >
                <option value="">Selecciona…</option>
                {opcionesCatalogo.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
              <p className="costos-field-hint">
                Es el ciclo al que se reinscriben (ej. 23 = 2026-2027), no necesariamente el ciclo
                activo del sistema.
              </p>
            </div>

            {cargando ? (
              <p className="servicios-panel-hint">
                <Loader2 className="servicios-inline-spin" size={16} /> Cargando…
              </p>
            ) : (
              <>
                <fieldset className="fd-fieldset">
                  <legend>Plan 10 meses</legend>
                  <p className="costos-field-hint">
                    Alumnos con plan a 10 meses (<code>alumno.mes = 1</code>). El 2.º diferido suele
                    abrir en junio.
                  </p>
                  <div className="fd-grid">
                    <div className="ciclos-crud-field">
                      <label>1.er diferido · inicio</label>
                      <input
                        type="date"
                        value={form.plan10_dif1_ini}
                        onChange={(e) => setCampo('plan10_dif1_ini', e.target.value)}
                        required
                      />
                    </div>
                    <div className="ciclos-crud-field">
                      <label>1.er diferido · fin</label>
                      <input
                        type="date"
                        value={form.plan10_dif1_fin}
                        onChange={(e) => setCampo('plan10_dif1_fin', e.target.value)}
                        required
                      />
                    </div>
                    <div className="ciclos-crud-field">
                      <label>2.º diferido · inicio</label>
                      <input
                        type="date"
                        value={form.plan10_dif2_ini}
                        onChange={(e) => setCampo('plan10_dif2_ini', e.target.value)}
                        required
                      />
                    </div>
                    <div className="ciclos-crud-field">
                      <label>2.º diferido · fin</label>
                      <input
                        type="date"
                        value={form.plan10_dif2_fin}
                        onChange={(e) => setCampo('plan10_dif2_fin', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="fd-fieldset">
                  <legend>Plan 11 meses</legend>
                  <p className="costos-field-hint">
                    Alumnos con plan a 11 meses (<code>alumno.mes = 2</code>). El 2.º diferido suele
                    abrir en julio.
                  </p>
                  <div className="fd-grid">
                    <div className="ciclos-crud-field">
                      <label>1.er diferido · inicio</label>
                      <input
                        type="date"
                        value={form.plan11_dif1_ini}
                        onChange={(e) => setCampo('plan11_dif1_ini', e.target.value)}
                        required
                      />
                    </div>
                    <div className="ciclos-crud-field">
                      <label>1.er diferido · fin</label>
                      <input
                        type="date"
                        value={form.plan11_dif1_fin}
                        onChange={(e) => setCampo('plan11_dif1_fin', e.target.value)}
                        required
                      />
                    </div>
                    <div className="ciclos-crud-field">
                      <label>2.º diferido · inicio</label>
                      <input
                        type="date"
                        value={form.plan11_dif2_ini}
                        onChange={(e) => setCampo('plan11_dif2_ini', e.target.value)}
                        required
                      />
                    </div>
                    <div className="ciclos-crud-field">
                      <label>2.º diferido · fin</label>
                      <input
                        type="date"
                        value={form.plan11_dif2_fin}
                        onChange={(e) => setCampo('plan11_dif2_fin', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </fieldset>
              </>
            )}

            {error ? <p className="ciclos-crud-msg ciclos-crud-msg--error">{error}</p> : null}
            {mensaje ? (
              <p className="ciclos-crud-msg ciclos-crud-msg--ok">
                <CheckCircle2 size={16} /> {mensaje}
              </p>
            ) : null}

            <div className="ciclos-crud-actions">
              <button type="submit" className="ciclos-crud-btn ciclos-crud-btn--primary" disabled={guardando || cargando}>
                {guardando ? <Loader2 className="servicios-inline-spin" size={16} /> : <Save size={16} />}
                Guardar
              </button>
            </div>
          </form>

          <div className="costos-copy-block">
            <h3 className="costos-copy-title">Copiar desde otro ciclo</h3>
            <p className="costos-field-hint">
              Útil para partir del ciclo anterior y solo ajustar las fechas nuevas.
            </p>
            <div className="costos-copy-row">
              <select
                value={copiarDesde}
                onChange={(e) =>
                  setCopiarDesde(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">Origen…</option>
                {lista.map((f) => (
                  <option key={f.ins_ce} value={f.ins_ce}>
                    Ciclo {f.ins_ce}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ciclos-crud-btn"
                onClick={() => void onCopiar()}
                disabled={copiando || cicloEfectivo == null || copiarDesde === ''}
              >
                {copiando ? <Loader2 className="servicios-inline-spin" size={16} /> : <Copy size={16} />}
                Copiar
              </button>
            </div>
          </div>
        </section>

        <section className="ciclos-crud-table-card" aria-labelledby="fd-lista-titulo">
          <h2 id="fd-lista-titulo" className="ciclos-crud-form-title">
            Resumen por ciclo
          </h2>
          {lista.length === 0 ? (
            <p className="servicios-panel-hint">Aún no hay filas en iwc_gral_ins.</p>
          ) : (
            <ul className="costos-nivel-grid">
              {lista.map((f) => {
                const activo = f.ins_ce === cicloEfectivo
                return (
                  <li key={f.ins_ce}>
                    <button
                      type="button"
                      className={`costos-nivel-card is-ready${activo ? ' is-active' : ''}`}
                      onClick={() => setCiclo(f.ins_ce)}
                    >
                      <div className="costos-nivel-card-top">
                        <span className="costos-nivel-name">Ciclo {f.ins_ce}</span>
                        <span className="costos-nivel-badge costos-nivel-badge--ok">Con fechas</span>
                      </div>
                      <dl className="costos-nivel-stats">
                        <div>
                          <dt>10m Dif1</dt>
                          <dd>
                            {fmtFecha(f.plan10_dif1_ini)} – {fmtFecha(f.plan10_dif1_fin)}
                          </dd>
                        </div>
                        <div>
                          <dt>10m Dif2</dt>
                          <dd>
                            {fmtFecha(f.plan10_dif2_ini)} – {fmtFecha(f.plan10_dif2_fin)}
                          </dd>
                        </div>
                        <div>
                          <dt>11m Dif1</dt>
                          <dd>
                            {fmtFecha(f.plan11_dif1_ini)} – {fmtFecha(f.plan11_dif1_fin)}
                          </dd>
                        </div>
                        <div>
                          <dt>11m Dif2</dt>
                          <dd>
                            {fmtFecha(f.plan11_dif2_ini)} – {fmtFecha(f.plan11_dif2_fin)}
                          </dd>
                        </div>
                      </dl>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
