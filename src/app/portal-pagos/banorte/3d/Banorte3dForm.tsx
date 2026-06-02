'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  BANORTE_3DS_URL,
  opcionesAnioExpiracion,
  type BanorteAfiliacion3ds,
} from '@/lib/banorteConfig'

interface Banorte3dFormProps {
  referencia: string
  monto: string
  concepto: string
  afiliacion: BanorteAfiliacion3ds
  urlRespuesta: string
}

export default function Banorte3dForm({
  referencia,
  monto,
  concepto,
  afiliacion,
  urlRespuesta,
}: Banorte3dFormProps) {
  const años = useMemo(() => opcionesAnioExpiracion(), [])
  const [mes, setMes] = useState('')
  const [anio, setAnio] = useState('')
  const [enviando, setEnviando] = useState(false)

  const fechaExp = mes && anio ? `${mes}/${anio}` : ''

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      if (!fechaExp) {
        e.preventDefault()
        return
      }
      setEnviando(true)
    },
    [fechaExp]
  )

  return (
    <section className="banorte-card">
      <h1 className="banorte-card-title">Formulario 1 de 2</h1>
      <p className="banorte-card-lead">
        Comercio electrónico Banorte: verificación 3D Secure. El banco emisor de su tarjeta
        (cualquier institución) confirmará que usted es el titular antes del cargo.
      </p>

      <dl className="banorte-summary">
        <div>
          <dt>Concepto</dt>
          <dd>{concepto}</dd>
        </div>
        <div>
          <dt>Referencia</dt>
          <dd>
            <code>{referencia}</code>
          </dd>
        </div>
        <div>
          <dt>Importe</dt>
          <dd className="banorte-amount">${monto}</dd>
        </div>
      </dl>

      <form
        action={BANORTE_3DS_URL}
        method="POST"
        acceptCharset="UTF-8"
        className="banorte-form-grid"
        onSubmit={onSubmit}
      >
        <input type="hidden" name="ID_AFILIACION" value={afiliacion.idAfiliacion} />
        <input type="hidden" name="NOMBRE_COMERCIO" value={afiliacion.nombreComercio} />
        <input type="hidden" name="CIUDAD_COMERCIO" value={afiliacion.ciudadComercio} />
        <input type="hidden" name="CERTIFICACION_3D" value={afiliacion.certificacion3d} />
        <input type="hidden" name="URL_RESPUESTA" value={urlRespuesta} />
        <input type="hidden" name="VERSION_3D" value="2" />
        <input type="hidden" name="MONTO" value={monto} readOnly />
        <input type="hidden" name="REFERENCIA3D" value={referencia} readOnly />
        <input type="hidden" name="FECHA_EXP" value={fechaExp} readOnly />

        <div className="banorte-field banorte-field--half">
          <label htmlFor="MARCA_TARJETA">Marca de tarjeta</label>
          <select name="MARCA_TARJETA" id="MARCA_TARJETA" required defaultValue="VISA">
            <option value="VISA">VISA</option>
            <option value="MC">MasterCard</option>
          </select>
        </div>

        <div className="banorte-field banorte-field--half">
          <label htmlFor="TIPO_TARJETA">Tipo</label>
          <select name="TIPO_TARJETA" id="TIPO_TARJETA" required defaultValue="DB">
            <option value="DB">Débito</option>
            <option value="CR">Crédito</option>
          </select>
        </div>

        <div className="banorte-field">
          <label htmlFor="NUMERO_TARJETA">Número de tarjeta</label>
          <input
            type="text"
            name="NUMERO_TARJETA"
            id="NUMERO_TARJETA"
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={16}
            pattern="[0-9]{16}"
            placeholder="0000 0000 0000 0000"
            required
          />
        </div>

        <div className="banorte-field banorte-field--half">
          <label>Vencimiento</label>
          <div className="banorte-exp-row">
            <select
              id="mes"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              required
              aria-label="Mes de vencimiento"
            >
              <option value="">Mes</option>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0')
                return (
                  <option key={m} value={m}>
                    {m}
                  </option>
                )
              })}
            </select>
            <select
              id="anio"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              required
              aria-label="Año de vencimiento"
            >
              <option value="">Año</option>
              {años.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <span className="banorte-hint">Formato enviado a Banorte: MM/AA</span>
        </div>

        <div className="banorte-field banorte-field--half">
          <label htmlFor="NOMBRE">Nombre(s)</label>
          <input type="text" name="NOMBRE" id="NOMBRE" autoComplete="given-name" required />
        </div>

        <div className="banorte-field banorte-field--half">
          <label htmlFor="APELLIDO">Apellidos</label>
          <input type="text" name="APELLIDO" id="APELLIDO" autoComplete="family-name" required />
        </div>

        <div className="banorte-field banorte-field--third">
          <label htmlFor="PAIS">País</label>
          <select name="PAIS" id="PAIS" defaultValue="MX">
            <option value="MX">México</option>
            <option value="US">Estados Unidos</option>
          </select>
        </div>

        <div className="banorte-field banorte-field--third">
          <label htmlFor="CIUDAD">Ciudad</label>
          <input type="text" name="CIUDAD" id="CIUDAD" autoComplete="address-level2" required />
        </div>

        <div className="banorte-field banorte-field--third">
          <label htmlFor="ESTADO">Estado</label>
          <input type="text" name="ESTADO" id="ESTADO" autoComplete="address-level1" required />
        </div>

        <div className="banorte-field">
          <label htmlFor="CALLE">Calle y número</label>
          <input type="text" name="CALLE" id="CALLE" autoComplete="street-address" required />
        </div>

        <div className="banorte-field banorte-field--half">
          <label htmlFor="CORREO">Correo electrónico</label>
          <input type="email" name="CORREO" id="CORREO" autoComplete="email" required />
        </div>

        <div className="banorte-field banorte-field--half">
          <label htmlFor="NUMERO_CELULAR">Celular</label>
          <input
            type="tel"
            name="NUMERO_CELULAR"
            id="NUMERO_CELULAR"
            autoComplete="tel"
            pattern="[0-9]{10,15}"
            placeholder="Sin espacios ni guiones"
            required
          />
          <span className="banorte-hint">10 a 15 dígitos, sin espacios</span>
        </div>

        <div className="banorte-field banorte-field--half">
          <label htmlFor="CODIGO_POSTAL">Código postal</label>
          <input
            type="text"
            name="CODIGO_POSTAL"
            id="CODIGO_POSTAL"
            autoComplete="postal-code"
            required
          />
        </div>

        <div className="banorte-actions" style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="banorte-btn banorte-btn--primary" disabled={enviando}>
            {enviando ? 'Redirigiendo al banco…' : 'Continuar con verificación segura'}
          </button>
        </div>
      </form>

      <p className="banorte-secure-note">
        <span aria-hidden="true">🔒</span>
        Será redirigido al 3D Secure del comercio electrónico Banorte (su banco emisor valida la
        tarjeta). No almacenamos su número de tarjeta en este paso.
      </p>
    </section>
  )
}
