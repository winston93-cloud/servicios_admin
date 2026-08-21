'use client'

/**
 * 2026-08-21 - Pad de firma mejorado (trazo grueso, guía, touch-none).
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
  onChange?: (empty: boolean) => void
}

export default function SignaturePad({
  disabled = false,
  onBind,
  onChange,
}: Props) {
  const canvasRef = useRef<SignatureCanvas | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!onBind) return
    onBind({
      clear: () => {
        canvasRef.current?.clear()
        onChangeRef.current?.(true)
      },
      isEmpty: () => canvasRef.current?.isEmpty() ?? true,
      toDataURL: () => {
        const c = canvasRef.current
        if (!c || c.isEmpty()) return ''
        return c.getTrimmedCanvas().toDataURL('image/png')
      },
    })
  }, [onBind])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const resize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const prev = canvas.isEmpty() ? null : canvas.toData()
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
      if (prev && prev.length > 0) {
        canvas.fromData(prev)
        onChangeRef.current?.(false)
      } else {
        onChangeRef.current?.(true)
      }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className={`fe-pad-wrap touch-none${disabled ? ' is-disabled' : ''}`}
      aria-label="Área para dibujar la firma"
    >
      <SignatureCanvas
        ref={canvasRef}
        penColor="#0f172a"
        backgroundColor="#ffffff"
        minWidth={1.1}
        maxWidth={2.6}
        velocityFilterWeight={0.65}
        throttle={12}
        onEnd={() => onChangeRef.current?.(canvasRef.current?.isEmpty() ?? true)}
        canvasProps={{
          className: 'fe-pad-canvas touch-none',
        }}
      />
      <span className="fe-pad-guide" aria-hidden />
      <p className="fe-pad-hint">Firma sobre la línea</p>
    </div>
  )
}
