'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Cloud,
  Database,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { ModoMigracion } from '@/lib/migracionTablasService'

export type TipoConfirmacionMigracion = 'migrar' | 'verificar'

interface MigracionConfirmModalProps {
  abierto: boolean
  tipo: TipoConfirmacionMigracion
  cantidadTablas: number
  modo?: ModoMigracion
  mysqlDatabase?: string | null
  onCancelar: () => void
  onConfirmar: () => void
}

function textoModo(modo: ModoMigracion): { titulo: string; detalle: string; peligroso: boolean } {
  switch (modo) {
    case 'espejo':
      return {
        titulo: 'Modo espejo',
        detalle: 'Inserta, actualiza y elimina huérfanos para igualar phpMyAdmin.',
        peligroso: false,
      }
    case 'solo_upsert':
      return {
        titulo: 'Solo upsert',
        detalle: 'Inserta o actualiza filas; no borra registros extra en InsForge.',
        peligroso: false,
      }
    case 'vaciar_copiar':
      return {
        titulo: 'Vaciar y copiar',
        detalle: 'Borra cada tabla en InsForge y vuelve a cargar todo desde MySQL.',
        peligroso: true,
      }
  }
}

export default function MigracionConfirmModal({
  abierto,
  tipo,
  cantidadTablas,
  modo = 'espejo',
  mysqlDatabase,
  onCancelar,
  onConfirmar,
}: MigracionConfirmModalProps) {
  const tituloId = useId()
  const btnConfirmarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    btnConfirmarRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCancelar])

  if (!abierto || typeof document === 'undefined') return null

  const esMigrar = tipo === 'migrar'
  const infoModo = esMigrar ? textoModo(modo) : null

  const pasosMigrar =
    modo === 'espejo'
      ? [
          'Lee las tablas seleccionadas en MySQL (phpMyAdmin).',
          'Adapta columnas y tipos al esquema de InsForge.',
          'Sincroniza insertando, actualizando y eliminando huérfanos.',
        ]
      : modo === 'solo_upsert'
        ? [
            'Lee las tablas seleccionadas en MySQL.',
            'Inserta filas nuevas y actualiza las existentes en InsForge.',
            'No elimina registros que solo existan en InsForge.',
          ]
        : [
            'Vacía primero las tablas hijas (orden inverso de dependencias).',
            'Luego copia todas las filas desde MySQL.',
            'Operación destructiva: no se puede deshacer desde aquí.',
          ]

  const pasosVerificar = [
    'Compara conteos y PKs entre MySQL e InsForge.',
    'Revisa filas con el mismo ID y contenido de negocio equivalente.',
    'Ignora marcas *_actualizacion (las gestiona Postgres).',
  ]

  return createPortal(
    <div
      className="migracion-confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancelar()
      }}
    >
      <div
        className={`migracion-confirm-dialog${infoModo?.peligroso ? ' migracion-confirm-dialog--peligro' : ''}${!esMigrar ? ' migracion-confirm-dialog--verificar' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <button
          type="button"
          className="migracion-confirm-cerrar"
          onClick={onCancelar}
          aria-label="Cerrar"
        >
          <X size={18} aria-hidden />
        </button>

        <div
          className={`migracion-confirm-icono${esMigrar ? '' : ' migracion-confirm-icono--verificar'}`}
          aria-hidden
        >
          {esMigrar ? (
            infoModo?.peligroso ? <AlertTriangle size={28} /> : <ArrowRightLeft size={28} />
          ) : (
            <ShieldCheck size={28} />
          )}
        </div>

        <h2 id={tituloId} className="migracion-confirm-titulo">
          {esMigrar ? 'Confirmar migración' : 'Confirmar verificación espejo'}
        </h2>

        <p className="migracion-confirm-subtitulo">
          {esMigrar
            ? `Vas a migrar ${cantidadTablas} tabla(s) hacia InsForge (Winston Servicios).`
            : `Vas a auditar ${cantidadTablas} tabla(s) sin modificar datos.`}
        </p>

        <div className="migracion-confirm-chips">
          <span className="migracion-confirm-chip">
            <Database size={14} aria-hidden />
            {cantidadTablas} tabla{cantidadTablas === 1 ? '' : 's'}
          </span>
          {esMigrar && infoModo && (
            <span
              className={`migracion-confirm-chip${infoModo.peligroso ? ' migracion-confirm-chip--alerta' : ''}`}
            >
              {infoModo.titulo}
            </span>
          )}
          {mysqlDatabase && (
            <span className="migracion-confirm-chip">
              <Server size={14} aria-hidden />
              {mysqlDatabase}
            </span>
          )}
          <span className="migracion-confirm-chip">
            <Cloud size={14} aria-hidden />
            Vercel
          </span>
        </div>

        {esMigrar && infoModo && (
          <p className="migracion-confirm-modo-detalle">{infoModo.detalle}</p>
        )}

        <ul className="migracion-confirm-lista">
          {(esMigrar ? pasosMigrar : pasosVerificar).map((paso) => (
            <li key={paso}>
              <CheckCircle2 size={16} aria-hidden />
              {paso}
            </li>
          ))}
        </ul>

        <p className="migracion-confirm-nota">
          La operación se ejecuta en el servidor; puede tardar varios minutos según el volumen de
          datos.
        </p>

        <div className="migracion-confirm-acciones">
          <button type="button" className="migracion-confirm-btn-cancelar" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            ref={btnConfirmarRef}
            type="button"
            className={`migracion-confirm-btn-confirmar${infoModo?.peligroso ? ' migracion-confirm-btn-confirmar--peligro' : ''}${!esMigrar ? ' migracion-confirm-btn-confirmar--verificar' : ''}`}
            onClick={onConfirmar}
          >
            {esMigrar ? 'Iniciar migración' : 'Iniciar verificación'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
