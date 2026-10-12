'use client'

/**
 * 2026-10-12 — Tarjeta «Beca SEP» del módulo Becas: si el alumno tiene Beca SEP en el ciclo, si renunció a su
 * beca del colegio (y a cuál) y, si se revirtió, a qué regresó. Solo lectura.
 */
import { useEffect, useState } from 'react'
import { ArrowLeftRight, BadgeCheck, GraduationCap, Loader2, RotateCcw } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import type { ResumenBecaSep } from '@/lib/becasSep/resumenBecaSep'
import './beca-sep-resumen.css'

const pesos = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const fecha = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ESTADO: Record<ResumenBecaSep['estado'], { texto: string; tono: string }> = {
  activa: { texto: 'Activa', tono: 'ok' },
  reversion_pendiente: { texto: 'Reversión por autorizar', tono: 'aviso' },
  revertida: { texto: 'Revertida', tono: 'neutro' },
  suspendida: { texto: 'Suspendida', tono: 'neutro' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

function nombreBeca(b: NonNullable<ResumenBecaSep['becaRenunciada']>) {
  return `${b.clase ? `${b.clase} ` : ''}del ${b.porcentaje} %`
}

export default function BecaSepResumen({
  alumnoRef,
  ciclo,
  etiquetaCiclo,
  onCargado,
}: {
  alumnoRef: string | number
  ciclo: number
  etiquetaCiclo: string
  onCargado?: (sep: ResumenBecaSep | null) => void
}) {
  const [estado, setEstado] = useState<{ clave: string; sep: ResumenBecaSep | null; error: string | null } | null>(null)
  const clave = `${alumnoRef}-${ciclo}`

  useEffect(() => {
    let vivo = true
    fetch(`/api/servicios/beca-sep-alumno?ref=${encodeURIComponent(String(alumnoRef))}&ciclo=${ciclo}`, {
      headers: portalSessionFetchHeaders(),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { ok?: boolean; sep?: ResumenBecaSep | null; error?: string } | null
        if (!vivo) return
        const sep = j?.ok ? (j.sep ?? null) : null
        setEstado({ clave, sep, error: j?.ok ? null : (j?.error ?? 'No se pudo consultar la Beca SEP.') })
        onCargado?.(sep)
      })
      .catch(() => {
        if (!vivo) return
        setEstado({ clave, sep: null, error: 'No se pudo consultar la Beca SEP.' })
        onCargado?.(null)
      })
    return () => {
      vivo = false
    }
  }, [alumnoRef, ciclo, clave, onCargado])

  if (!estado || estado.clave !== clave) {
    return (
      <div className="bsep-card bsep-card--cargando" role="status">
        <Loader2 size={16} className="bsep-spin" aria-hidden /> Consultando Beca SEP…
      </div>
    )
  }
  if (estado.error) return <p className="bsep-vacio bsep-vacio--error">{estado.error}</p>
  const sep = estado.sep
  if (!sep) {
    return (
      <p className="bsep-vacio">
        <GraduationCap size={15} aria-hidden /> Sin Beca SEP en {etiquetaCiclo}.
      </p>
    )
  }

  const e = ESTADO[sep.estado]
  const revertida = sep.estado === 'revertida'

  return (
    <section className={`bsep-card bsep-card--${e.tono}`} aria-label="Beca SEP">
      <header className="bsep-head">
        <div className="bsep-titulo">
          <GraduationCap size={20} aria-hidden />
          <div>
            <h3>Beca SEP · {etiquetaCiclo}</h3>
            <p>
              {sep.folio ? `Folio ${sep.folio} · ` : ''}
              {sep.cobroAutomatico ? 'Se cobra en automático en el baucher' : 'Registro de la carga inicial'}
            </p>
          </div>
        </div>
        <div className="bsep-pills">
          {sep.prueba && <span className="bsep-pill bsep-pill--prueba">Alumno de prueba</span>}
          <span className={`bsep-pill bsep-pill--${e.tono}`}>{e.texto}</span>
        </div>
      </header>

      <dl className="bsep-datos">
        <div>
          <dt>Porcentaje SEP</dt>
          <dd className="bsep-grande">{sep.porcentajeSep} %</dd>
        </div>
        <div>
          <dt>{revertida ? 'Mensualidad SEP (ya no aplica)' : 'Mensualidad en el baucher'}</dt>
          <dd className={revertida ? 'bsep-tachado' : 'bsep-grande'}>
            {sep.anioCompleto && !revertida ? 'Año cubierto' : pesos(sep.montoMensual)}
          </dd>
        </div>
        <div>
          <dt>Meses por cobrar</dt>
          <dd>
            {sep.mesesRestantes ?? '—'}
            {sep.planMeses ? <small> · plan de {sep.planMeses} meses</small> : null}
          </dd>
        </div>
        <div>
          <dt>Otorgada</dt>
          <dd>
            {fecha(sep.otorgadaEn)}
            {sep.aprobadoPor ? <small> · {sep.aprobadoPor}</small> : null}
          </dd>
        </div>
      </dl>

      {sep.saldoFavor > 0 && !revertida && (
        <p className="bsep-nota">Saldo a favor de la familia: {pesos(sep.saldoFavor)}.</p>
      )}

      {revertida ? (
        <div className="bsep-renuncia bsep-renuncia--revertida">
          <RotateCcw size={18} aria-hidden />
          <div>
            <strong>
              {sep.becaRenunciada
                ? `Regresó a su beca ${nombreBeca(sep.becaRenunciada)}`
                : 'Regresó a pagar sin beca del colegio'}
            </strong>
            <span>
              Nueva mensualidad: {pesos(sep.reversion?.mensual)}
              {sep.reversion?.resueltaEn ? ` · autorizó ${sep.reversion.resueltaPor ?? '—'} el ${fecha(sep.reversion.resueltaEn)}` : ''}
              {sep.reversion?.motivo ? ` · motivo: ${sep.reversion.motivo}` : ''}
            </span>
          </div>
        </div>
      ) : sep.becaRenunciada ? (
        <div className="bsep-renuncia">
          <ArrowLeftRight size={18} aria-hidden />
          <div>
            <strong>Renunció a su beca {nombreBeca(sep.becaRenunciada)}</strong>
            <span>
              {sep.estado === 'activa' || sep.estado === 'reversion_pendiente'
                ? 'La Beca SEP la sustituye: mientras esté activa, el baucher no aplica la beca del colegio.'
                : 'La Beca SEP no está activa.'}
            </span>
          </div>
        </div>
      ) : (
        <div className="bsep-renuncia bsep-renuncia--sin">
          <BadgeCheck size={18} aria-hidden />
          <div>
            <strong>No tenía beca del colegio</strong>
            <span>No renunció a nada al aceptar la Beca SEP.</span>
          </div>
        </div>
      )}
    </section>
  )
}
