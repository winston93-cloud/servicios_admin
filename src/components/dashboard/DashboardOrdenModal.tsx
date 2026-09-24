'use client'

import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, X } from 'lucide-react'
import { moverEnLista } from '@/lib/dashboardNavOrder'
import './dashboard-orden.css'

export type DashboardOrdenItem = {
  id: string
  label: string
  /** Número de catálogo 1..25 (referencia). */
  catalogN: number | null
}

type DashboardOrdenModalProps = {
  abierto: boolean
  items: DashboardOrdenItem[]
  onCerrar: () => void
  onGuardar: (ids: string[]) => void
  onRestablecer: () => void
}

export default function DashboardOrdenModal({
  abierto,
  items,
  onCerrar,
  onGuardar,
  onRestablecer,
}: DashboardOrdenModalProps) {
  const tituloId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<DashboardOrdenItem[]>(items)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setDraft(items)
    setDraggingId(null)
    setOverId(null)
  }, [abierto, items])

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    }, 40)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  const mover = (from: number, to: number) => {
    setDraft((prev) => moverEnLista(prev, from, to))
  }

  const onDragStart = (e: DragEvent<HTMLLIElement>, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const onDragOver = (e: DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }

  const onDrop = (e: DragEvent<HTMLLIElement>, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId
    setDraggingId(null)
    setOverId(null)
    if (!sourceId || sourceId === targetId) return
    setDraft((prev) => {
      const from = prev.findIndex((x) => x.id === sourceId)
      const to = prev.findIndex((x) => x.id === targetId)
      return moverEnLista(prev, from, to)
    })
  }

  const onDragEnd = () => {
    setDraggingId(null)
    setOverId(null)
  }

  return (
    <div className="dash-orden-root" role="presentation">
      <button
        type="button"
        className="dash-orden-backdrop"
        aria-label="Cerrar cambiar orden"
        onClick={onCerrar}
      />
      <div
        ref={panelRef}
        className="dash-orden-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <header className="dash-orden-header">
          <div>
            <p className="dash-orden-kicker">Dashboard</p>
            <h2 id={tituloId} className="dash-orden-title">
              Cambiar orden
            </h2>
            <p className="dash-orden-lead">
              Arrastra o usa las flechas. El orden se guarda solo en tu cuenta.
            </p>
          </div>
          <button type="button" className="dash-orden-close" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <ol className="dash-orden-list" aria-label="Sistemas del dashboard">
          {draft.map((item, index) => {
            const isDragging = draggingId === item.id
            const isOver = overId === item.id && draggingId !== item.id
            return (
              <li
                key={item.id}
                className={`dash-orden-row${isDragging ? ' is-dragging' : ''}${isOver ? ' is-over' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, item.id)}
                onDragOver={(e) => onDragOver(e, item.id)}
                onDrop={(e) => onDrop(e, item.id)}
                onDragEnd={onDragEnd}
              >
                <span className="dash-orden-grip" aria-hidden>
                  <GripVertical size={18} strokeWidth={2} />
                </span>
                <span className="dash-orden-pos">{index + 1}</span>
                {item.catalogN != null ? (
                  <span className="dash-orden-cat" title="Número de catálogo">
                    #{item.catalogN}
                  </span>
                ) : null}
                <span className="dash-orden-label">{item.label}</span>
                <div className="dash-orden-moves">
                  <button
                    type="button"
                    className="dash-orden-move"
                    disabled={index === 0}
                    aria-label={`Subir ${item.label}`}
                    onClick={() => mover(index, index - 1)}
                  >
                    <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="dash-orden-move"
                    disabled={index === draft.length - 1}
                    aria-label={`Bajar ${item.label}`}
                    onClick={() => mover(index, index + 1)}
                  >
                    <ArrowDown size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>

        <footer className="dash-orden-footer">
          <button
            type="button"
            className="dash-orden-btn dash-orden-btn--ghost"
            onClick={() => {
              onRestablecer()
              onCerrar()
            }}
          >
            <RotateCcw size={16} strokeWidth={2} aria-hidden />
            Restablecer
          </button>
          <div className="dash-orden-footer-actions">
            <button type="button" className="dash-orden-btn dash-orden-btn--ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="dash-orden-btn dash-orden-btn--primary"
              onClick={() => {
                onGuardar(draft.map((x) => x.id))
                onCerrar()
              }}
            >
              Guardar orden
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
