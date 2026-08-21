'use client'

/**
 * 2026-08-21 - Vista PDF en canvas (Android/iPhone Safari no muestran PDF en iframe).
 */
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

type Props = {
  url: string
  title: string
}

export default function PdfInlineViewer({ url, title }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let pdfDoc: PDFDocumentProxy | null = null

    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        host.replaceChildren()

        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc =
          '/firma-electronica/pdf.worker.min.mjs'

        // ArrayBuffer evita fallos de blob: en Safari iOS / WebViews Android.
        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo cargar el PDF.')
        const data = new Uint8Array(await res.arrayBuffer())
        if (cancelled) return

        const task = pdfjs.getDocument({ data })
        const pdf = await task.promise
        pdfDoc = pdf
        if (cancelled) {
          pdf.cleanup()
          return
        }

        const cssWidth = Math.max(
          Math.min(host.clientWidth || 300, window.innerWidth - 32),
          240
        )
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break
          const page = await pdf.getPage(pageNum)
          const base = page.getViewport({ scale: 1 })
          const scale = cssWidth / base.width
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.className = 'fe-pdf-page'
          canvas.setAttribute('aria-label', `${title} · página ${pageNum}`)
          canvas.width = Math.floor(viewport.width * dpr)
          canvas.height = Math.floor(viewport.height * dpr)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`

          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
          }).promise

          if (!cancelled) host.appendChild(canvas)
        }
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
    })()

    return () => {
      cancelled = true
      try {
        pdfDoc?.cleanup()
      } catch {
        // ignore
      }
    }
  }, [url, title])

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
            Abrir / descargar PDF
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
