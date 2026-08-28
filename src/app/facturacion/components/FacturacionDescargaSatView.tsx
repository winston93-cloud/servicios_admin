'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2, ShieldAlert, FileSpreadsheet } from 'lucide-react'
import FacturacionShell from './FacturacionShell'

type Etapa =
  | 'idle'
  | 'autenticando'
  | 'solicitud_enviada'
  | 'verificando'
  | 'procesando_xml'
  | 'generando_excel'
  | 'listo'
  | 'error'

const ETIQUETAS: Record<Etapa, string> = {
  idle: 'Listo para iniciar',
  autenticando: 'Autenticando e.firma con el SAT…',
  solicitud_enviada: 'Solicitud enviada — esperando paquetes del SAT…',
  verificando: 'Verificando disponibilidad en el SAT…',
  procesando_xml: 'Descargando y procesando XML…',
  generando_excel: 'Generando archivo Excel…',
  listo: 'Excel generado correctamente',
  error: 'Ocurrió un error',
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export default function FacturacionDescargaSatView() {
  const [cer, setCer] = useState<File | null>(null)
  const [key, setKey] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('idle')
  const [idSolicitud, setIdSolicitud] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const armarForm = useCallback(
    (accion: string, extra?: Record<string, string>) => {
      const fd = new FormData()
      fd.set('accion', accion)
      if (cer) fd.set('cer', cer)
      if (key) fd.set('key', key)
      fd.set('password', password)
      fd.set('fechaInicio', fechaInicio)
      fd.set('fechaFin', fechaFin)
      if (extra) {
        for (const [k, v] of Object.entries(extra)) fd.set(k, v)
      }
      return fd
    },
    [cer, key, password, fechaInicio, fechaFin]
  )

  const ejecutar = useCallback(async () => {
    cancelRef.current = false
    setError(null)
    setMensaje(null)
    setIdSolicitud(null)

    if (!cer || !key || !password.trim()) {
      setError('Suba .cer, .key e indique la contraseña de la e.firma.')
      setEtapa('error')
      return
    }
    if (!fechaInicio || !fechaFin) {
      setError('Seleccione fecha inicio y fin.')
      setEtapa('error')
      return
    }

    try {
      setEtapa('autenticando')
      const resSol = await fetch('/api/sat/descarga-masiva', {
        method: 'POST',
        body: armarForm('solicitar'),
      })
      const dataSol = await resSol.json().catch(() => ({}))
      if (!resSol.ok || !dataSol.ok) {
        throw new Error(dataSol.error || 'No se pudo enviar la solicitud al SAT.')
      }

      const id = String(dataSol.idSolicitud ?? '')
      setIdSolicitud(id)
      setEtapa('solicitud_enviada')
      setMensaje(`IdSolicitud: ${id}`)

      let paquetes: string[] = []
      const maxIntentos = 36
      for (let i = 0; i < maxIntentos; i++) {
        if (cancelRef.current) return
        setEtapa('verificando')
        await sleep(i === 0 ? 4000 : 5000)

        const resVer = await fetch('/api/sat/descarga-masiva', {
          method: 'POST',
          body: armarForm('verificar', { idSolicitud: id }),
        })
        const dataVer = await resVer.json().catch(() => ({}))
        if (!resVer.ok || dataVer.ok === false) {
          throw new Error(dataVer.error || 'Error al verificar solicitud.')
        }

        if (dataVer.estado === 'fallida') {
          throw new Error(dataVer.mensaje || 'El SAT rechazó o expiró la solicitud.')
        }
        if (dataVer.estado === 'lista') {
          paquetes = Array.isArray(dataVer.paquetes) ? dataVer.paquetes : []
          break
        }
        setMensaje(
          dataVer.mensaje ||
            `Verificación ${i + 1}/${maxIntentos} — el SAT sigue procesando…`
        )
      }

      if (!paquetes.length) {
        throw new Error(
          'El SAT no terminó a tiempo. Intente de nuevo con un rango de fechas más corto.'
        )
      }

      setEtapa('procesando_xml')
      setMensaje(`${paquetes.length} paquete(s) listos para descargar.`)

      setEtapa('generando_excel')
      const resXls = await fetch('/api/sat/descarga-masiva', {
        method: 'POST',
        body: armarForm('descargar', {
          idSolicitud: id,
          paquetes: JSON.stringify(paquetes),
        }),
      })

      if (!resXls.ok) {
        const errJson = await resXls.json().catch(() => ({}))
        throw new Error(errJson.error || 'Error al generar Excel.')
      }

      const count = Number(resXls.headers.get('X-Cfdi-Count') ?? 0)

      const blob = await resXls.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cfdi-recibidos_${fechaInicio}_${fechaFin}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      setEtapa('listo')
      setMensaje(
        `Se exportaron ${count} comprobante${count === 1 ? '' : 's'}. Descarga iniciada en su navegador.`
      )
    } catch (e) {
      setEtapa('error')
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }, [armarForm, cer, key, password, fechaInicio, fechaFin])

  const ocupado =
    etapa !== 'idle' && etapa !== 'listo' && etapa !== 'error'

  return (
    <FacturacionShell
      title="Facturación SAT (Descarga Masiva)"
      subtitle="CFDI recibidos → Excel · Web Service oficial del SAT · e.firma no se almacena"
    >
      <div className="facturacion-cfdi-panel space-y-5">
        <div
          className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          role="note"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">Seguridad de la e.firma</p>
            <p className="mt-1 text-pretty opacity-90">
              Los archivos <code>.cer</code> y <code>.key</code> y su contraseña se
              envían solo para firmar la petición SOAP y <strong>no se guardan</strong>{' '}
              en servidor ni base de datos. Use la FIEL del RFC receptor (no CSD de
              sellos). Rango máximo recomendado: 31 días por consulta.
            </p>
          </div>
        </div>

        <section className="facturacion-cfdi-card space-y-4">
          <h2 className="text-base font-semibold text-primary">e.firma (FIEL)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Certificado (.cer)</span>
              <input
                type="file"
                accept=".cer"
                className="min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium dark:bg-slate-900"
                onChange={(e) => setCer(e.target.files?.[0] ?? null)}
                disabled={ocupado}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Clave privada (.key)</span>
              <input
                type="file"
                accept=".key"
                className="min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium dark:bg-slate-900"
                onChange={(e) => setKey(e.target.files?.[0] ?? null)}
                disabled={ocupado}
              />
            </label>
          </div>
          <label className="flex max-w-md flex-col gap-1.5 text-sm">
            <span className="font-medium">Contraseña de la clave privada</span>
            <input
              type="password"
              autoComplete="off"
              className="min-h-[44px] rounded-lg border border-border bg-white px-3 py-2 text-base dark:bg-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={ocupado}
            />
          </label>
        </section>

        <section className="facturacion-cfdi-card space-y-4">
          <h2 className="text-base font-semibold text-primary">Filtros</h2>
          <p className="text-sm text-text-secondary">
            Tipo de comprobante: <strong>Recibidos</strong> (usted es el receptor en
            el CFDI).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Fecha inicio</span>
              <input
                type="date"
                className="min-h-[44px] rounded-lg border border-border bg-white px-3 py-2 text-base dark:bg-slate-900"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                disabled={ocupado}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Fecha fin</span>
              <input
                type="date"
                className="min-h-[44px] rounded-lg border border-border bg-white px-3 py-2 text-base dark:bg-slate-900"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                disabled={ocupado}
              />
            </label>
          </div>
        </section>

        <div
          className="rounded-xl border border-border/80 bg-white/60 px-4 py-3 dark:bg-slate-900/40"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Estado
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-primary">
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            ) : etapa === 'listo' ? (
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : null}
            {ETIQUETAS[etapa]}
          </p>
          {idSolicitud ? (
            <p className="mt-1 text-xs text-text-secondary break-all">
              IdSolicitud: {idSolicitud}
            </p>
          ) : null}
          {mensaje ? (
            <p className="mt-1 text-sm text-text-secondary">{mensaje}</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void ejecutar()}
            disabled={ocupado}
          >
            {ocupado ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Procesando…
              </>
            ) : (
              'Solicitar y generar Excel'
            )}
          </button>
          {ocupado ? (
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-border px-4 text-sm font-medium"
              onClick={() => {
                cancelRef.current = true
                setEtapa('idle')
                setMensaje('Proceso cancelado.')
              }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </FacturacionShell>
  )
}
