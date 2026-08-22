'use client'

/**
 * 2026-08-21 - Vista PDF en canvas (Safari iOS / Android no muestran PDF en iframe).
 * Espera ancho real del host y re-renderiza al rotar (evita descuadre en iPhone).
 */
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

type Props = {
  url: string
  title: string
  /** 1 = ancho del contenedor; >1 re-render a más resolución (visor grande). */
  zoom?: number
}

function measureHostWidth(host: HTMLElement): number {
  const raw = host.clientWidth || host.getBoundingClientRect().width || 0
  const vv = window.visualViewport?.width
  const viewportCap = Math.max(
    240,
    Math.floor((vv || window.innerWidth || 320) - 48)
  )
  if (raw < 8) return viewportCap
  return Math.max(240, Math.min(Math.floor(raw), viewportCap))
}

export default function PdfInlineViewer({ url, title, zoom = 1 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let pdfDoc: PDFDocumentProxy | null = null
    let pdfBytes: Uint8Array | null = null
    let lastWidth = 0
    let renderToken = 0

    const waitForWidth = async (): Promise<number> => {
      for (let i = 0; i < 20; i++) {
        if (cancelled) return 0
        const w = measureHostWidth(host)
        if (host.clientWidth >= 8 || i > 4) return w
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r()))
        )
      }
      return measureHostWidth(host)
    }

    const paint = async (pdf: PDFDocumentProxy, cssWidth: number) => {
      const token = ++renderToken
      host.replaceChildren()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled || token !== renderToken) return
        const page = await pdf.getPage(pageNum)
        const base = page.getViewport({ scale: 1 })
        const scale = cssWidth / base.width
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.className = 'fe-pdf-page'
        canvas.setAttribute('aria-label', `${title} · página ${pageNum}`)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        if (zoom === 1) {
          canvas.style.width = '100%'
          canvas.style.maxWidth = '100%'
        } else {
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.maxWidth = 'none'
        }
        canvas.style.height = 'auto'
        canvas.style.display = 'block'

        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise

        if (!cancelled && token === renderToken) host.appendChild(canvas)
      }
    }

    const loadAndPaint = async () => {
      try {
        setLoading(true)
        setError(null)
        host.replaceChildren()

        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc =
          '/firma-electronica/pdf.worker.min.mjs'

        if (!pdfBytes) {
          const res = await fetch(url)
          if (!res.ok) throw new Error('No se pudo cargar el PDF.')
          pdfBytes = new Uint8Array(await res.arrayBuffer())
        }
        if (cancelled) return

        if (!pdfDoc) {
          const task = pdfjs.getDocument({ data: pdfBytes })
          pdfDoc = await task.promise
        }
        if (cancelled) return

        const cssWidth = Math.floor((await waitForWidth()) * Math.max(0.5, zoom))
        if (cancelled || cssWidth < 8) return
        lastWidth = cssWidth
        await paint(pdfDoc, cssWidth)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo mostrar el PDF en el dispositivo.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAndPaint()

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRepaint = () => {
      if (!pdfDoc || cancelled) return
      const next = Math.floor(measureHostWidth(host) * Math.max(0.5, zoom))
      if (Math.abs(next - lastWidth) < 12) return
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (cancelled || !pdfDoc) return
        lastWidth = next
        void paint(pdfDoc, next)
      }, 180)
    }

    const ro = new ResizeObserver(scheduleRepaint)
    ro.observe(host)
    window.addEventListener('orientationchange', scheduleRepaint)
    window.visualViewport?.addEventListener('resize', scheduleRepaint)

    return () => {
      cancelled = true
      if (resizeTimer) clearTimeout(resizeTimer)
      ro.disconnect()
      window.removeEventListener('orientationchange', scheduleRepaint)
      window.visualViewport?.removeEventListener('resize', scheduleRepaint)
      try {
        pdfDoc?.cleanup()
      } catch {
        // ignore
      }
    }
  }, [url, title, zoom])

  return (
    <div className="fe-pdf-viewer">
      {loading ? (
        <p className="fe-doc-empty" aria-live="polite">
          Cargando documento…
        </p>
      ) : null}
      {error ? (
        <div className="fe-pdf-fallback">
          <p className="fe-doc-empty">{error}</p>
          <a
            className="fe-btn fe-btn--primary fe-pdf-open-btn"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir PDF en otra pestaña
          </a>
        </div>
      ) : null}
      <div
        ref={hostRef}
        className="fe-pdf-pages"
        hidden={loading || Boolean(error)}
      />
    </div>
  )
}
