'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import './estatus.css'

type Detalle = {
  kind: string
  titulo: string
  alumno: string
  ref?: string | number | null
  motivo?: string
  mensaje?: string
  fecha?: string
  confirmado?: boolean
}

function EstatusInner() {
  const sp = useSearchParams()
  const id = sp.get('id') ?? ''
  const alt = Number(sp.get('alt') ?? 1)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) {
      setError('Enlace incompleto')
      return
    }
    void fetch(`/api/rac/publico?id=${encodeURIComponent(id)}&alt=${alt}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'No encontrado')
        setDetalle(data as Detalle)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
  }, [id, alt])

  async function confirmar() {
    setBusy(true)
    try {
      const r = await fetch('/api/rac/publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, alt }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'No se pudo confirmar')
      setOk(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="rac-estatus">
      <header>
        <p>Instituto Winston Churchill</p>
        <h1>Reportes académicos y de conducta</h1>
      </header>
      {error ? <p className="err">{error}</p> : null}
      {detalle ? (
        <article>
          <h2>{detalle.titulo}</h2>
          <p>
            <strong>{detalle.alumno}</strong>
            {detalle.ref ? ` · ${detalle.ref}` : ''}
          </p>
          {detalle.motivo ? <p>Motivo: {detalle.motivo}</p> : null}
          {detalle.fecha ? <p>Fecha: {detalle.fecha}</p> : null}
          <p>{detalle.mensaje}</p>
          {ok || detalle.confirmado ? (
            <p className="ok">Enterado. Gracias por confirmar.</p>
          ) : (
            <button type="button" disabled={busy} onClick={() => void confirmar()}>
              Confirmar de enterado
            </button>
          )}
        </article>
      ) : !error ? (
        <p>Cargando…</p>
      ) : null}
    </main>
  )
}

export default function EstatusPage() {
  return (
    <Suspense fallback={<p className="rac-estatus">Cargando…</p>}>
      <EstatusInner />
    </Suspense>
  )
}
