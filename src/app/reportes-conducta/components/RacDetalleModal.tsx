'use client'

import './rac-detalle-modal.css'

type Props = {
  row: Record<string, unknown>
  onClose: () => void
}

function Flag({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'rac-det__flag rac-det__flag--si' : 'rac-det__flag rac-det__flag--no'}>
      {ok ? 'Sí' : 'No'}
    </span>
  )
}

/**
 * Detalle de reporte/cita/suspensión.
 * Legacy secundaria_2.0: ID = reporte_id (no el control del alumno), No Control, Alumno,
 * Grado/Grupo, Asignatura, Motivo, Observaciones, Fecha, No Vuelta.
 */
export default function RacDetalleModal({ row, onClose }: Props) {
  const esCita = row.cita_id != null
  const esSusp = row.suspension_id != null
  const tituloTipo = String(row.escalon ?? row.tipoEtiqueta ?? (esCita ? 'Citatorio' : esSusp ? 'Suspensión' : 'Reporte'))
  const situacion = [tituloTipo, row.materia ? String(row.materia) : ''].filter(Boolean).join(' · ')
  const gradoGrupo =
    row.grado != null || row.grupo
      ? `${row.grado != null ? `${String(row.grado)}°` : ''} ${String(row.grupo ?? '')}`.trim()
      : '—'
  const enviado = Boolean(row.enviado ?? row.enviada)
  const confirmado = Boolean(row.confirmado ?? row.confirmada)
  const muestraEnvio = row.enviado != null || row.enviada != null
  const muestraConf = row.confirmado != null || row.confirmada != null

  const idLabel = esCita ? 'ID cita' : esSusp ? 'ID suspensión' : 'ID reporte'
  const idValor = esCita
    ? String(row.cita_id)
    : esSusp
      ? String(row.suspension_id)
      : row.reporte_id != null
        ? String(row.reporte_id)
        : null

  return (
    <div className="rac-det" role="dialog" aria-modal="true" aria-labelledby="rac-det-title">
      <div className="rac-det__card">
        <header className="rac-det__head">
          <div className="rac-det__head-text">
            <p className="rac-det__eyebrow">Detalle</p>
            <h3 id="rac-det-title">{String(row.nombre ?? 'Registro')}</h3>
            <p className="rac-det__sub">
              Control {String(row.alumno_ref ?? '—')}
              {gradoGrupo !== '—' ? ` · ${gradoGrupo}` : ''}
            </p>
          </div>
          <span className="rac-det__badge" title="Tipo de registro">
            {tituloTipo}
          </span>
        </header>

        <section className="rac-det__section" aria-label="Alumno">
          <h4 className="rac-det__section-title">Alumno</h4>
          <div className="rac-det__grid">
            <div className="rac-det__field">
              <span className="rac-det__label">No. control</span>
              <span className="rac-det__value">{String(row.alumno_ref ?? '—')}</span>
            </div>
            <div className="rac-det__field">
              <span className="rac-det__label">Grado y grupo</span>
              <span className="rac-det__value">{gradoGrupo}</span>
            </div>
            <div className="rac-det__field rac-det__field--wide">
              <span className="rac-det__label">Nombre</span>
              <span className="rac-det__value rac-det__value--strong">{String(row.nombre ?? '—')}</span>
            </div>
          </div>
        </section>

        <section className="rac-det__section" aria-label="Situación">
          <h4 className="rac-det__section-title">Situación</h4>
          <div className="rac-det__grid">
            {idValor ? (
              <div className="rac-det__field">
                <span className="rac-det__label">{idLabel}</span>
                <span className="rac-det__value" title="Identificador del registro (no es el no. de control)">
                  {idValor}
                </span>
              </div>
            ) : null}
            <div className="rac-det__field">
              <span className="rac-det__label">Fecha</span>
              <span className="rac-det__value">{String(row.fecha ?? '—')}</span>
            </div>
            {situacion ? (
              <div className="rac-det__field rac-det__field--wide">
                <span className="rac-det__label">Situación / materia</span>
                <span className="rac-det__value">{situacion}</span>
              </div>
            ) : null}
            {row.motivo ? (
              <div className="rac-det__field rac-det__field--wide">
                <span className="rac-det__label">Motivo</span>
                <span className="rac-det__value">{String(row.motivo)}</span>
              </div>
            ) : null}
            {row.vuelta != null && row.vuelta !== '' ? (
              <div className="rac-det__field">
                <span className="rac-det__label">No. vuelta</span>
                <span className="rac-det__value">{String(row.vuelta)}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rac-det__obs" aria-label="Observaciones">
          <h4 className="rac-det__section-title">Observaciones</h4>
          <p>{String(row.mensaje ?? '—')}</p>
        </section>

        {muestraEnvio || muestraConf ? (
          <section className="rac-det__status" aria-label="Estado de envío">
            {muestraEnvio ? (
              <div className="rac-det__status-item">
                <span className="rac-det__label">Enviado</span>
                <Flag ok={enviado} />
              </div>
            ) : null}
            {muestraConf ? (
              <div className="rac-det__status-item">
                <span className="rac-det__label">Confirmado</span>
                <Flag ok={confirmado} />
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="rac-det__actions">
          <button type="button" className="rac-det__btn" onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
