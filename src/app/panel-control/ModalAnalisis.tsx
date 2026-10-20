'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Cpu, X } from 'lucide-react'
import { UMBRALES_SALUD, type MedidorProceso } from '@/lib/panelControl/tipos'
import { DESCRIPCION_MEDIDOR, porQueMarca, reglaPieza } from '@/lib/panelControl/explicaciones'
import { Tacometro } from './Instrumentos'
import './modal-analisis.css'

const ESTADO_TXT = { normal: 'En verde', precaucion: 'Precaución', alarma: 'Alarma', 'sin-dato': 'Sin lectura' } as const

/** Ventana de análisis de un medidor: qué es, por qué marca su porcentaje y cómo se califica cada pieza. */
export default function ModalAnalisis({
  m,
  codigo,
  leidoEn,
  acento = 'cian',
  onCerrar,
}: {
  m: MedidorProceso
  codigo: string
  leidoEn?: string | null
  acento?: 'cian' | 'acero'
  onCerrar: () => void
}) {
  const tituloId = useId()
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => cerrarRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [onCerrar])

  const descripcion = DESCRIPCION_MEDIDOR[m.id] ?? m.mide
  const hora = leidoEn
    ? new Date(leidoEn).toLocaleTimeString('es-MX', { timeZone: 'America/Monterrey', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : null

  return createPortal(
    <div className="pma-root" data-acento={acento} data-estado={m.estado} role="presentation">
      <button type="button" className="pma-fondo" aria-label="Cerrar análisis" onClick={onCerrar} />
      <div className="pma-panel" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <span className="pma-esquina pma-esquina--a" aria-hidden />
        <span className="pma-esquina pma-esquina--b" aria-hidden />
        <span className="pma-barrido" aria-hidden />

        <header className="pma-cabeza">
          <span className="pma-chip">
            <Cpu size={14} aria-hidden /> Análisis · {codigo}
          </span>
          <h2 id={tituloId} className="pma-titulo">
            {m.nombre}
          </h2>
          <span className="pma-estado" data-estado={m.estado}>
            <span className="pma-lampara" aria-hidden />
            {ESTADO_TXT[m.estado]}
          </span>
          <button ref={cerrarRef} type="button" className="pma-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="pma-cuerpo">
          <div className="pma-resumen">
            <div className="pma-reloj">
              <Tacometro grande valor={m.valor} etiqueta="Salud" sub={m.mide} />
            </div>
            <div className="pma-textos">
              <section className="pma-bloque">
                <h3>Qué es</h3>
                <p>{descripcion}</p>
              </section>
              <section className="pma-bloque pma-bloque--ia">
                <h3>Por qué marca {m.valor == null ? 'sin lectura' : `${m.valor}%`}</h3>
                <p className="pma-dictamen">
                  {porQueMarca(m)}
                  <span className="pma-cursor" aria-hidden />
                </p>
              </section>
            </div>
          </div>

          <h3 className="pma-subtitulo">Piezas que mide · {m.piezas.length}</h3>
          <ul className="pma-piezas">
            {m.piezas.map((p, i) => {
              const regla = reglaPieza(m.id, p)
              return (
                <li key={p.id} className="pma-pieza" data-estado={p.estado} style={{ '--i': i } as React.CSSProperties}>
                  <div className="pma-pieza-fila">
                    <span className="pma-lampara" aria-hidden />
                    <span className="pma-pieza-nombre">{p.nombre}</span>
                    <span className="pma-pieza-valor">{p.valor == null ? '—' : `${p.valor}%`}</span>
                  </div>
                  <div className="pma-barra" aria-hidden>
                    <span style={{ width: `${p.valor ?? 0}%` }} />
                  </div>
                  <p className="pma-pieza-lectura">
                    <b>{p.corto === 'bien' ? 'Bien' : p.corto}</b> · {p.lectura}
                  </p>
                  {p.fallo ? <p className="pma-pieza-fallo">Último fallo: {p.fallo}</p> : null}
                  {regla ? (
                    <p className="pma-pieza-regla">
                      <span>Cómo se califica</span> {regla}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>

        <footer className="pma-pie">
          <span className="pma-escala">
            <i data-z="normal" /> Verde {UMBRALES_SALUD[1]}–100
            <i data-z="precaucion" /> Ámbar {UMBRALES_SALUD[0]}–{UMBRALES_SALUD[1] - 1}
            <i data-z="alarma" /> Rojo &lt;{UMBRALES_SALUD[0]}
          </span>
          {hora ? <span className="pma-hora">Lectura {hora}</span> : null}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
