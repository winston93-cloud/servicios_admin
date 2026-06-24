'use client'

import { useAuth } from '@/contexts/AuthContext'
import {
  MONEDAS,
  REGIMENES_FISCALES,
  USOS_CFDI,
} from '@/lib/datosFacturacionCatalog'
import {
  DATOS_FACTURACION_VACIO,
  type DatosFacturacionFormulario,
} from '@/lib/datosFacturacionTypes'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export default function PortalFacturacionView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [form, setForm] = useState<DatosFacturacionFormulario>(DATOS_FACTURACION_VACIO)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const setCampo = <K extends keyof DatosFacturacionFormulario>(
    key: K,
    value: DatosFacturacionFormulario[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
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
  }, [alumnoId])

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
      setExito('Datos fiscales guardados correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="portal-pagos-page portal-facturacion-page">
      <header className="portal-pagos-header">
        <button
          type="button"
          className="servicios-back-btn"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft size={16} aria-hidden />
          Volver al inicio
        </button>
        <div>
          <h1>Portal de facturación</h1>
          <p className="portal-pagos-subtitle">
            Alta y actualización de datos fiscales para CFDI
          </p>
        </div>
      </header>

      {cargando ? (
        <p className="portal-pagos-loading">Cargando datos…</p>
      ) : (
        <form className="portal-facturacion-form" onSubmit={guardar}>
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
                  onChange={(e) => setCampo('rfc', e.target.value.toUpperCase())}
                  placeholder="XAXX010101000"
                  required
                />
              </label>
              <label className="pi-form-label portal-facturacion-span2">
                Denominación / razón social
                <input
                  className="pi-form-input"
                  value={form.razsocial}
                  onChange={(e) => setCampo('razsocial', e.target.value)}
                  required
                />
              </label>
              <label className="pi-form-label">
                Régimen fiscal
                <select
                  className="pi-form-input"
                  value={form.regfiscal}
                  onChange={(e) => setCampo('regfiscal', e.target.value)}
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
                  onChange={(e) => setCampo('codpostal', e.target.value)}
                  required
                />
              </label>
              <label className="pi-form-label portal-facturacion-span2">
                Calle
                <input
                  className="pi-form-input"
                  value={form.calle}
                  onChange={(e) => setCampo('calle', e.target.value)}
                  required
                />
              </label>
              <label className="pi-form-label">
                No. exterior
                <input
                  className="pi-form-input"
                  value={form.nexterior}
                  onChange={(e) => setCampo('nexterior', e.target.value)}
                />
              </label>
              <label className="pi-form-label">
                No. interior
                <input
                  className="pi-form-input"
                  value={form.ninterior}
                  onChange={(e) => setCampo('ninterior', e.target.value)}
                />
              </label>
              <label className="pi-form-label">
                Colonia
                <input
                  className="pi-form-input"
                  value={form.ncolonia}
                  onChange={(e) => setCampo('ncolonia', e.target.value)}
                  required
                />
              </label>
              <label className="pi-form-label">
                Municipio
                <input
                  className="pi-form-input"
                  value={form.nmunicipio}
                  onChange={(e) => setCampo('nmunicipio', e.target.value)}
                  required
                />
              </label>
              <label className="pi-form-label">
                Entidad
                <input
                  className="pi-form-input"
                  value={form.nentidad}
                  onChange={(e) => setCampo('nentidad', e.target.value)}
                  required
                />
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
                  onChange={(e) => setCampo('email', e.target.value)}
                  required
                />
              </label>
              <label className="pi-form-label">
                Lada
                <input
                  className="pi-form-input"
                  value={form.lada}
                  onChange={(e) => setCampo('lada', e.target.value)}
                />
              </label>
              <label className="pi-form-label">
                Teléfono
                <input
                  className="pi-form-input"
                  value={form.numero}
                  onChange={(e) => setCampo('numero', e.target.value)}
                />
              </label>
            </div>
          </section>

          <div className="portal-facturacion-actions">
            <button type="submit" className="portal-pagos-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar datos fiscales'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
