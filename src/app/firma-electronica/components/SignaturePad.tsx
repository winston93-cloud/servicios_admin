'use client'

/**
 * 2026-08-21 - Pad de firma con react-signature-canvas (solo cliente).
 */
import { useEffect, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'

export type SignaturePadHandle = {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

type Props = {
  disabled?: boolean
  onBind?: (api: SignaturePadHandle) => void
}

export default function SignaturePad({ disabled = false, onBind }: Props) {
  const canvasRef = useRef<SignatureCanvas | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!onBind) return
    onBind({
      clear: () => canvasRef.current?.clear(),
      isEmpty: () => canvasRef.current?.isEmpty() ?? true,
      toDataURL: () =>
        canvasRef.current?.getTrimmedCanvas().toDataURL('image/png') ?? '',
    })
  }, [onBind])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const resize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const width = el.clientWidth
      const height = el.clientHeight
      const raw = canvas.getCanvas()
      raw.width = Math.floor(width * ratio)
      raw.height = Math.floor(height * ratio)
      raw.style.width = `${width}px`
      raw.style.height = `${height}px`
      const ctx = raw.getContext('2d')
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(ratio, ratio)
      }
      canvas.clear()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className={`fe-pad-wrap${disabled ? ' is-disabled' : ''}`}
      aria-label="Área para dibujar la firma"
    >
      <SignatureCanvas
        ref={canvasRef}
        penColor="#0f172a"
        backgroundColor="#ffffff"
        canvasProps={{
          className: 'fe-pad-canvas',
        }}
      />
      <p className="fe-pad-hint">Dibuja tu firma con el dedo, mouse o stylus</p>
    </div>
  )
}
