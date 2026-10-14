'use client'

import { AlertTriangle, Check, Loader2, RotateCcw } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'

export type SecGridCol = {
  key: string
  titulo: string
  /** Tooltip del encabezado y mensaje cuando la celda no es válida. */
  ayuda: string
  /** Texto capturado → valor canónico ('' = vacío). null = inválido. */
  normalizar: (raw: string) => string | null
  numerico?: boolean
  maxLength: number
}

export type SecGridFila = { id: number; nombre: string; valores: Record<string, string> }

export type SecGridCambio = { id: number; valores: Record<string, string> }

export type SecGridControl = {
  /** Guarda lo pendiente. false si algo no se guardó (error o celdas en rojo). */
  guardarPendientes: () => Promise<boolean>
}

type Valores = Record<number, Record<string, string>>
type Estado = 'listo' | 'pendiente' | 'guardando' | 'guardado' | 'error'

type Props = {
  filas: SecGridFila[]
  columnas: SecGridCol[]
  editable: boolean
  guardar: (cambios: SecGridCambio[]) => Promise<void>
  controlRef?: Ref<SecGridControl | null>
  /** Encabezado sobre las columnas editables (p. ej. «Trimestre 2»). */
  tituloEdicion?: ReactNode
  /** Columnas de solo lectura al final (encabezado + celdas por fila con los valores vigentes). */
  extra?: {
    titulo: ReactNode
    encabezados: ReactNode
    celdas: (fila: SecGridFila, vigentes: Record<string, string>) => ReactNode
    span: number
  }
  onVigentes?: (vigentes: Valores) => void
}

const ESPERA_AUTOGUARDADO = 800

function copiar(v: Valores): Valores {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { ...x }]))
}

const canon = (col: SecGridCol, raw: string) => col.normalizar(raw)

function hora(d: Date): string {
  return d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}

/** Hoja tipo Excel: flechas/Enter/Tab para moverse, escribir reemplaza, pegar columnas desde Excel y autoguardado. */
export default function SecGrid({ filas, columnas, editable, guardar, controlRef, tituloEdicion, extra, onVigentes }: Props) {
  const inicial = useCallback(() => {
    const v: Valores = {}
    for (const f of filas) v[f.id] = Object.fromEntries(columnas.map((c) => [c.key, f.valores[c.key] ?? '']))
    return v
  }, [filas, columnas])

  const [texto, setTextoState] = useState<Valores>(inicial)
  const [base, setBaseState] = useState<Valores>(inicial)
  const textoRef = useRef(texto)
  const baseRef = useRef(base)
  const [estado, setEstado] = useState<Estado>('listo')
  const [error, setError] = useState('')
  const [ultimo, setUltimo] = useState<Date | null>(null)
  const [aviso, setAviso] = useState('')
  const [activa, setActiva] = useState<{ r: number; c: number } | null>(null)
  const celdas = useRef(new Map<string, HTMLInputElement>())
  const timer = useRef<number | null>(null)
  const enCurso = useRef<Promise<boolean> | null>(null)
  const guardarRef = useRef(guardar)

  useEffect(() => {
    guardarRef.current = guardar
  }, [guardar])

  const setTexto = (v: Valores) => {
    textoRef.current = v
    setTextoState(v)
  }
  const setBase = (v: Valores) => {
    baseRef.current = v
    setBaseState(v)
  }

  const pendientesDe = useCallback(
    (t: Valores, b: Valores) => {
      const cambios: SecGridCambio[] = []
      let invalidas = 0
      for (const f of filas) {
        const valores: Record<string, string> = {}
        for (const col of columnas) {
          const v = canon(col, t[f.id]?.[col.key] ?? '')
          if (v == null) invalidas++
          else if (v !== (b[f.id]?.[col.key] ?? '')) valores[col.key] = v
        }
        if (Object.keys(valores).length) cambios.push({ id: f.id, valores })
      }
      return { cambios, invalidas }
    },
    [filas, columnas]
  )

  const pendientesDeRef = useRef(() => pendientesDe(textoRef.current, baseRef.current))
  useEffect(() => {
    pendientesDeRef.current = () => pendientesDe(textoRef.current, baseRef.current)
  }, [pendientesDe])

  const guardarPendientes = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    while (enCurso.current) await enCurso.current
    const { cambios, invalidas } = pendientesDe(textoRef.current, baseRef.current)
    if (!cambios.length) {
      setEstado((e) => (e === 'pendiente' ? (ultimo ? 'guardado' : 'listo') : e))
      return invalidas === 0
    }
    const tarea = (async () => {
      setEstado('guardando')
      setError('')
      try {
        await guardarRef.current(cambios)
        const nueva = copiar(baseRef.current)
        for (const c of cambios) nueva[c.id] = { ...nueva[c.id], ...c.valores }
        setBase(nueva)
        setUltimo(new Date())
        setEstado(pendientesDe(textoRef.current, nueva).cambios.length ? 'pendiente' : 'guardado')
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar.')
        setEstado('error')
        return false
      }
    })()
    enCurso.current = tarea
    const ok = await tarea
    enCurso.current = null
    return ok && invalidas === 0
  }, [pendientesDe, ultimo])

  useImperativeHandle(controlRef, () => ({ guardarPendientes }), [guardarPendientes])

  const programar = useCallback(() => {
    setEstado('pendiente')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void guardarPendientes(), ESPERA_AUTOGUARDADO)
  }, [guardarPendientes])

  const alDesmontar = useRef(guardarPendientes)
  useEffect(() => {
    alDesmontar.current = guardarPendientes
  }, [guardarPendientes])
  useEffect(
    () => () => {
      if (pendientesDeRef.current().cambios.length) void alDesmontar.current()
      else if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  const { cambios: pendientes, invalidas } = pendientesDe(texto, base)
  const sucio = pendientes.length > 0 || estado === 'guardando'

  useEffect(() => {
    if (!sucio) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  const vigentes = useCallback(
    (id: number) => {
      const out: Record<string, string> = {}
      for (const col of columnas) {
        const v = canon(col, texto[id]?.[col.key] ?? '')
        out[col.key] = v ?? base[id]?.[col.key] ?? ''
      }
      return out
    },
    [columnas, texto, base]
  )

  useEffect(() => {
    if (!onVigentes) return
    onVigentes(Object.fromEntries(filas.map((f) => [f.id, vigentes(f.id)])))
  }, [onVigentes, filas, vigentes])

  function enfocar(r: number, c: number) {
    const el = celdas.current.get(`${r}-${c}`)
    if (!el) return
    el.focus()
    el.select()
  }

  function cambiar(id: number, key: string, valor: string) {
    const t = copiar(textoRef.current)
    t[id] = { ...t[id], [key]: valor }
    setTexto(t)
    setAviso('')
    programar()
  }

  function alSalir(id: number, col: SecGridCol) {
    const raw = textoRef.current[id]?.[col.key] ?? ''
    const v = canon(col, raw)
    if (v != null && v !== raw) {
      const t = copiar(textoRef.current)
      t[id] = { ...t[id], [col.key]: v }
      setTexto(t)
    }
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>, r: number, c: number, id: number, col: SecGridCol) {
    const ultimaCol = columnas.length - 1
    const mover = (rr: number, cc: number) => {
      e.preventDefault()
      if (rr < 0 || rr >= filas.length) return
      enfocar(rr, cc)
    }
    switch (e.key) {
      case 'ArrowDown':
        return mover(r + 1, c)
      case 'ArrowUp':
        return mover(r - 1, c)
      case 'Enter':
        return mover(e.shiftKey ? r - 1 : r + 1, c)
      case 'ArrowRight':
        return c < ultimaCol ? mover(r, c + 1) : mover(r + 1, 0)
      case 'ArrowLeft':
        return c > 0 ? mover(r, c - 1) : mover(r - 1, ultimaCol)
      case 'Escape': {
        e.preventDefault()
        cambiar(id, col.key, baseRef.current[id]?.[col.key] ?? '')
        e.currentTarget.select()
        return
      }
    }
  }

  function pegar(e: ClipboardEvent<HTMLInputElement>, r: number, c: number) {
    const raw = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(raw.replace(/[\r\n]+$/, ''))) return
    e.preventDefault()
    const lineas = raw.replace(/\r/g, '').replace(/\n+$/, '').split('\n')
    const t = copiar(textoRef.current)
    let n = 0
    lineas.forEach((linea, i) => {
      const fila = filas[r + i]
      if (!fila) return
      linea.split('\t').forEach((v, j) => {
        const col = columnas[c + j]
        if (!col) return
        t[fila.id] = { ...t[fila.id], [col.key]: v.trim() }
        n++
      })
    })
    setTexto(t)
    const sobran = Math.max(0, r + lineas.length - filas.length)
    setAviso(
      `Pegaste ${n} celda${n === 1 ? '' : 's'}.` +
        (sobran ? ` Sobraron ${sobran} renglón(es) porque la lista llegó al último alumno: revisa que el orden coincida.` : '')
    )
    programar()
  }

  const primeraInvalida = (() => {
    for (const f of filas) {
      for (const col of columnas) {
        if (canon(col, texto[f.id]?.[col.key] ?? '') == null) return { f, col }
      }
    }
    return null
  })()

  return (
    <div className="sg-wrap">
      <div className="sg-scroll" role="region" aria-label="Hoja de captura" tabIndex={-1}>
        <table className="sg-tabla">
          <thead>
            {(tituloEdicion || extra) && (
              <tr className="sg-supra">
                <th className="sg-num" aria-hidden />
                <th className="sg-nombre" aria-hidden />
                <th colSpan={columnas.length} className="sg-supra-edit">
                  {tituloEdicion}
                </th>
                {extra && (
                  <th colSpan={extra.span} className="sg-supra-extra">
                    {extra.titulo}
                  </th>
                )}
              </tr>
            )}
            <tr>
              <th className="sg-num" scope="col">
                #
              </th>
              <th className="sg-nombre" scope="col">
                Alumno
              </th>
              {columnas.map((col, c) => (
                <th
                  key={col.key}
                  scope="col"
                  title={col.ayuda}
                  className={`sg-th-edit${activa?.c === c ? ' is-col' : ''}`}
                >
                  {col.titulo}
                </th>
              ))}
              {extra?.encabezados}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, r) => {
              const vig = vigentes(f.id)
              return (
                <tr key={f.id} className={activa?.r === r ? 'is-activa' : undefined}>
                  <td className="sg-num">{r + 1}</td>
                  <th scope="row" className="sg-nombre">
                    {f.nombre}
                  </th>
                  {columnas.map((col, c) => {
                    const raw = texto[f.id]?.[col.key] ?? ''
                    const v = canon(col, raw)
                    const invalida = v == null
                    const sucia = !invalida && v !== (base[f.id]?.[col.key] ?? '')
                    const cls = ['sg-celda', invalida && 'is-error', sucia && 'is-sucia', !raw && 'is-vacia']
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <td key={col.key} className={cls} title={invalida ? `${f.nombre}: ${col.ayuda}` : undefined}>
                        {editable ? (
                          <input
                            ref={(el) => {
                              if (el) celdas.current.set(`${r}-${c}`, el)
                              else celdas.current.delete(`${r}-${c}`)
                            }}
                            value={raw}
                            maxLength={col.maxLength}
                            inputMode={col.numerico ? 'numeric' : 'text'}
                            autoCapitalize={col.numerico ? 'off' : 'characters'}
                            autoComplete="off"
                            spellCheck={false}
                            enterKeyHint="next"
                            aria-label={`${col.titulo} de ${f.nombre}`}
                            aria-invalid={invalida || undefined}
                            onChange={(e) => cambiar(f.id, col.key, e.target.value)}
                            onFocus={(e) => {
                              setActiva({ r, c })
                              e.target.select()
                            }}
                            onBlur={() => {
                              setActiva((a) => (a?.r === r && a?.c === c ? null : a))
                              alSalir(f.id, col)
                            }}
                            onKeyDown={(e) => teclas(e, r, c, f.id, col)}
                            onPaste={(e) => pegar(e, r, c)}
                          />
                        ) : (
                          <span className="sg-ro">{raw || '·'}</span>
                        )}
                      </td>
                    )
                  })}
                  {extra?.celdas(f, vig)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="sg-estado" role="status" aria-live="polite">
          {estado === 'guardando' && (
            <span className="sg-chip is-guardando">
              <Loader2 size={14} className="sg-gira" aria-hidden /> Guardando…
            </span>
          )}
          {estado === 'pendiente' && <span className="sg-chip is-pendiente">Cambios por guardar…</span>}
          {estado === 'guardado' && ultimo && (
            <span className="sg-chip is-ok">
              <Check size={14} aria-hidden /> Guardado {hora(ultimo)}
            </span>
          )}
          {estado === 'error' && (
            <span className="sg-chip is-error">
              <AlertTriangle size={14} aria-hidden /> No se guardó: {error}
              <button type="button" className="sg-reintentar" onClick={() => void guardarPendientes()}>
                <RotateCcw size={13} aria-hidden /> Reintentar
              </button>
            </span>
          )}
          {invalidas > 0 && primeraInvalida && (
            <span className="sg-chip is-error">
              <AlertTriangle size={14} aria-hidden />
              {invalidas} celda{invalidas === 1 ? '' : 's'} en rojo no se guarda{invalidas === 1 ? '' : 'n'}. Ej.:{' '}
              {primeraInvalida.f.nombre} — {primeraInvalida.col.ayuda}
            </span>
          )}
          {aviso && <span className="sg-chip">{aviso}</span>}
        </div>
      )}
    </div>
  )
}
