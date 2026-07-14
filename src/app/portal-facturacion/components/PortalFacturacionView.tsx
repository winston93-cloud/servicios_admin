'use client'

import { useAuth } from '@/contexts/AuthContext'
import {
  ENTIDADES_FEDERATIVAS,
  MONEDAS,
  REGIMENES_FISCALES,
  USOS_CFDI,
} from '@/lib/datosFacturacionCatalog'
import {
  DATOS_FACTURACION_VACIO,
  type DatosFacturacionFormulario,
} from '@/lib/datosFacturacionTypes'
import { ArrowLeft, FileText, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export default function PortalFacturacionView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [form, setForm] = useState<DatosFacturacionFormulario>(DATOS_FACTURACION_VACIO)
  const [nombreAlumno, setNombreAlumno] = useState<string | null>(null)
  const [existeAlta, setExisteAlta] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const setCampo = <K extends keyof DatosFacturacionFormulario>(
    key: K,
    value: DatosFacturacionFormulario[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setExito(null)
  }

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal-facturacion?alumnoId=${alumnoId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron cargar los datos')

      setNombreAlumno(
        typeof data.nombreAlumno === 'string' && data.nombreAlumno.trim()
          ? data.nombreAlumno.trim()
          : session?.displayName ?? null
      )
      setExisteAlta(Boolean(data.existeAlta))

      if (data.datos) {
        const d = data.datos
        setForm({
          moneda: d.moneda ?? 'MXN',
          rfc: d.rfc ?? '',
          razsocial: d.razsocial ?? '',
          regfiscal: d.regfiscal ?? '605',
          usocfdi: d.usocfdi ?? 'D10',
          codpostal: d.codpostal ?? '',
          calle: d.calle ?? '',
          nexterior: d.nexterior ?? '',
          ninterior: d.ninterior ?? '',
          ncolonia: d.ncolonia ?? '',
          nmunicipio: d.nmunicipio ?? '',
          nentidad: d.nentidad ?? '',
          email: d.email ?? '',
          lada: d.lada ?? '',
          numero: d.numero ?? '',
          alumno_ref: d.alumno_ref ?? data.alumnoRef ?? 0,
        })
      } else if (data.alumnoRef) {
        setForm((prev) => ({ ...prev, alumno_ref: data.alumnoRef }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [alumnoId, session?.displayName])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (alumnoId == null) return
    setGuardando(true)
    setError(null)
    setExito(null)
    try {
      const res = await fetch('/api/portal-facturacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId, formulario: form }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.errores?.length) {
          throw new Error(data.errores.join(' '))
        }
        throw new Error(data.error ?? 'No se pudo guardar')
      }
      setExisteAlta(true)
      setExito(
        existeAlta
          ? 'Datos fiscales actualizados correctamente.'
          : 'Alta de facturación guardada correctamente.'
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setGuardando(false)
    }
  }

  const refFmt =
    form.alumno_ref > 0
      ? String(form.alumno_ref).padStart(5, '0')
      : session?.alumno_ref != null
        ? String(session.alumno_ref).padStart(5, '0')
        : '—'

  return (
    <div className="portal-pagos-page portal-facturacion-page">
      <header className="portal-facturacion-header">
        <button
          type="button"
          className="servicios-back-btn"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft size={16} aria-hidden />
          Volver al inicio
        </button>
        <div className="portal-facturacion-header-main">
          <div className="portal-facturacion-title-row">
            <span className="portal-facturacion-title-icon" aria-hidden>
              <FileText size={22} />
            </span>
            <div>
              <h1>Alta de Facturación</h1>
              <p className="portal-pagos-subtitle">
                Alta y actualización de datos fiscales para CFDI
              </p>
            </div>
          </div>
          {!cargando && (
            <div className="portal-facturacion-meta">
              <span className="portal-facturacion-chip">
                Control <strong>{refFmt}</strong>
              </span>
              {nombreAlumno ? (
                <span className="portal-facturacion-chip portal-facturacion-chip--muted">
                  {nombreAlumno}
                </span>
              ) : null}
              <span
                className={`portal-facturacion-chip ${
                  existeAlta
                    ? 'portal-facturacion-chip--ok'
                    : 'portal-facturacion-chip--warn'
                }`}
              >
                {existeAlta ? 'Alta registrada' : 'Sin alta todavía'}
              </span>
            </div>
          )}
        </div>
      </header>

      {cargando ? (
        <div className="portal-facturacion-skeleton" aria-busy="true">
          <div className="portal-facturacion-skel-block" />
          <div className="portal-facturacion-skel-block" />
          <div className="portal-facturacion-skel-block" />
        </div>
      ) : (
        <form className="portal-facturacion-form" onSubmit={guardar} noValidate>
          <p className="portal-facturacion-aviso" role="note">
            Los datos deben coincidir exactamente con su constancia de situación fiscal.
          </p>

          {error && (
            <p className="portal-facturacion-error" role="alert">
              {error}
            </p>
          )}
          {exito && (
            <p className="portal-facturacion-exito" role="status">
              {exito}
            </p>
          )}

          <section className="portal-facturacion-section">
            <h2>Moneda</h2>
            <label className="pi-form-label">
              Tipo de moneda
              <select
                className="pi-form-input"
                value={form.moneda}
                onChange={(e) => setCampo('moneda', e.target.value)}
              >
                {MONEDAS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="portal-facturacion-section">
            <h2>Datos del contribuyente</h2>
            <div className="portal-facturacion-grid">
              <label className="pi-form-label">
                RFC
                <input
                  className="pi-form-input"
                  value={form.rfc}
                  onChange={(e) =>
                    setCampo('rfc', e.target.value.toUpperCase().replace(/\s/g, ''))
                  }
                  placeholder="XAXX010101000"
                  maxLength={13}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
              <label className="pi-form-label portal-facturacion-span2">
                Denominación / razón social
                <input
                  className="pi-form-input"
                  value={form.razsocial}
                  onChange={(e) => setCampo('razsocial', e.target.value.toUpperCase())}
                  maxLength={75}
                  required
                />
              </label>
              <label className="pi-form-label">
                Régimen fiscal
                <select
                  className="pi-form-input"
                  value={form.regfiscal}
                  onChange={(e) => setCampo('regfiscal', e.target.value)}
                  required
                >
                  {Object.entries(REGIMENES_FISCALES).map(([code, desc]) => (
                    <option key={code} value={code}>
                      {code} | {desc}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pi-form-label">
                Uso de CFDI
                <select
                  className="pi-form-input"
                  value={form.usocfdi}
                  onChange={(e) => setCampo('usocfdi', e.target.value)}
                  required
                >
                  {Object.entries(USOS_CFDI).map(([code, desc]) => (
                    <option key={code} value={code}>
                      {code} | {desc}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="portal-facturacion-section">
            <h2>Domicilio fiscal</h2>
            <div className="portal-facturacion-grid">
              <label className="pi-form-label">
                Código postal
                <input
                  className="pi-form-input"
                  value={form.codpostal}
                  onChange={(e) =>
                    setCampo('codpostal', e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  inputMode="numeric"
                  maxLength={5}
                  pattern="\d{5}"
                  required
                />
              </label>
              <label className="pi-form-label portal-facturacion-span2">
                Calle
                <input
                  className="pi-form-input"
                  value={form.calle}
                  onChange={(e) => setCampo('calle', e.target.value.toUpperCase())}
                  maxLength={35}
                  required
                />
              </label>
              <label className="pi-form-label">
                No. exterior
                <input
                  className="pi-form-input"
                  value={form.nexterior}
                  onChange={(e) => setCampo('nexterior', e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </label>
              <label className="pi-form-label">
                No. interior
                <input
                  className="pi-form-input"
                  value={form.ninterior}
                  onChange={(e) => setCampo('ninterior', e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </label>
              <label className="pi-form-label">
                Colonia
                <input
                  className="pi-form-input"
                  value={form.ncolonia}
                  onChange={(e) => setCampo('ncolonia', e.target.value.toUpperCase())}
                  maxLength={50}
                  required
                />
              </label>
              <label className="pi-form-label">
                Municipio
                <input
                  className="pi-form-input"
                  value={form.nmunicipio}
                  onChange={(e) => setCampo('nmunicipio', e.target.value.toUpperCase())}
                  maxLength={35}
                  required
                />
              </label>
              <label className="pi-form-label portal-facturacion-span2">
                Entidad
                <select
                  className="pi-form-input"
                  value={form.nentidad}
                  onChange={(e) => setCampo('nentidad', e.target.value)}
                  required
                >
                  <option value="">Seleccione entidad federativa</option>
                  {ENTIDADES_FEDERATIVAS.map((ent) => (
                    <option key={ent} value={ent.toUpperCase()}>
                      {ent}
                    </option>
                  ))}
                  {form.nentidad &&
                  !ENTIDADES_FEDERATIVAS.map((e) => e.toUpperCase()).includes(
                    form.nentidad.toUpperCase()
                  ) ? (
                    <option value={form.nentidad}>{form.nentidad}</option>
                  ) : null}
                </select>
              </label>
            </div>
          </section>

          <section className="portal-facturacion-section">
            <h2>Contacto</h2>
            <div className="portal-facturacion-grid">
              <label className="pi-form-label portal-facturacion-span2">
                Correo electrónico
                <input
                  className="pi-form-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setCampo('email', e.target.value.trim())}
                  maxLength={45}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="pi-form-label">
                Lada
                <input
                  className="pi-form-input"
                  value={form.lada}
                  onChange={(e) =>
                    setCampo('lada', e.target.value.replace(/[^\d+]/g, '').slice(0, 15))
                  }
                  inputMode="tel"
                  placeholder="833"
                  maxLength={15}
                />
              </label>
              <label className="pi-form-label">
                Teléfono
                <input
                  className="pi-form-input"
                  value={form.numero}
                  onChange={(e) =>
                    setCampo('numero', e.target.value.replace(/\D/g, '').slice(0, 15))
                  }
                  inputMode="tel"
                  placeholder="1234567"
                  maxLength={15}
                />
              </label>
            </div>
          </section>

          <div className="portal-facturacion-actions">
            <p className="portal-facturacion-hint">
              Uso de CFDI recomendado para colegiaturas:{' '}
              <strong>D10 — Pagos por servicios educativos</strong>.
            </p>
            <button
              type="submit"
              className="portal-pagos-btn-primary portal-facturacion-submit"
              disabled={guardando}
            >
              <Save size={18} aria-hidden />
              {guardando
                ? 'Guardando…'
                : existeAlta
                  ? 'Actualizar datos fiscales'
                  : 'Guardar alta de facturación'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
