'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import { numeroCicloEscolarAdmin } from '@/lib/cicloEscolarAdmin'
import { etiquetaEstatusAlumno, parseEstatusAlumno } from '@/lib/alumnoStatus'
import {
  NIVEL_ETIQUETA,
  etiquetaCicloEscolar,
  type PosCampoCoincidente,
  type PosCliente,
} from '@/lib/pos/posTipos'

export type ClienteBuscadorRef = { focus: () => void }

const MIN_CARACTERES = 2

const TIPO_ETIQUETA = { alumno: 'Alumno', maestro: 'Docente', externo: 'Externo' } as const

const ETIQUETA_CAMPO: Record<PosCampoCoincidente, string> = {
  nombre: 'Nombre',
  app: 'Ap. paterno',
  apm: 'Ap. materno',
  ref: 'No. control',
}

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Resalta cada palabra buscada dentro del nombre (sin importar acentos). */
function resaltar(texto: string, consulta: string): ReactNode[] {
  const tokens = normalizar(consulta).split(' ').filter(Boolean)
  if (!tokens.length) return [texto]
  const partes: ReactNode[] = []
  let resto = texto
  let key = 0
  while (resto.length > 0) {
    const restoNorm = normalizar(resto)
    let idx = -1
    let largo = 0
    for (const t of tokens) {
      const i = restoNorm.indexOf(t)
      if (i !== -1 && (idx === -1 || i < idx)) {
        idx = i
        largo = t.length
      }
    }
    if (idx === -1) {
      partes.push(<span key={key++}>{resto}</span>)
      break
    }
    if (idx > 0) partes.push(<span key={key++}>{resto.slice(0, idx)}</span>)
    partes.push(
      <mark key={key++} className="cj-mark">
        {resto.slice(idx, idx + largo)}
      </mark>
    )
    resto = resto.slice(idx + largo)
  }
  return partes
}

/** Grupo numérico en BD → letra (1 = A, 2 = B, …). */
function grupoALetra(grupo: string | null): string | null {
  if (grupo == null || grupo === '') return null
  const n = parseInt(grupo, 10)
  if (Number.isNaN(n)) return grupo
  return n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : String(n)
}

function claseEstatus(status: number | null): string {
  switch (status) {
    case 0:
      return 'cj-tag--baja'
    case 2:
      return 'cj-tag--inactivo'
    case 3:
      return 'cj-tag--temporal'
    case 4:
    case 5:
      return 'cj-tag--bloqueo'
    default:
      return 'cj-tag--activo'
  }
}

function metaCliente(c: PosCliente): string {
  if (c.tipo === 'maestro') return `Personal docente · ${c.ref}`
  if (c.tipo === 'externo') return `Externo · ${c.ref}`
  const partes = [`No. control ${c.ref}`]
  if (c.nivel != null) partes.push(NIVEL_ETIQUETA[c.nivel] ?? `Nivel ${c.nivel}`)
  if (c.grado) partes.push(`${c.grado}°`)
  const letra = grupoALetra(c.grupo)
  if (letra) partes.push(`Grupo ${letra}`)
  return partes.join(' · ')
}

const ClienteBuscador = forwardRef<ClienteBuscadorRef, { onSeleccion: (c: PosCliente) => void }>(
  function ClienteBuscador({ onSeleccion }, ref) {
    const baseId = useId()
    const listboxId = `${baseId}-listbox`
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    const [consulta, setConsulta] = useState('')
    const [resultados, setResultados] = useState<PosCliente[]>([])
    const [cargando, setCargando] = useState(false)
    const [abierto, setAbierto] = useState(false)
    const [indiceActivo, setIndiceActivo] = useState(-1)
    const [mensajeVacio, setMensajeVacio] = useState<string | null>(null)
    const [ciclo, setCiclo] = useState(() => numeroCicloEscolarAdmin())

    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

    const cerrarLista = useCallback(() => {
      setAbierto(false)
      setIndiceActivo(-1)
    }, [])

    useEffect(() => {
      const texto = consulta.trim()
      if (texto.length < MIN_CARACTERES) {
        abortRef.current?.abort()
        setResultados([])
        setCargando(false)
        setMensajeVacio(null)
        return
      }
      const timer = window.setTimeout(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setCargando(true)
        setMensajeVacio(null)
        try {
          const r = await posApi.buscar(texto, controller.signal)
          if (controller.signal.aborted) return
          setResultados(r.clientes)
          setCiclo(r.ciclo)
          setAbierto(true)
          setIndiceActivo(r.clientes.length > 0 ? 0 : -1)
          setMensajeVacio(
            r.clientes.length === 0
              ? 'No encontramos a nadie con ese criterio. Prueba otro nombre, apellido o número de control.'
              : null
          )
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setResultados([])
            setMensajeVacio('Ocurrió un error al buscar. Intenta de nuevo.')
          }
        } finally {
          if (!controller.signal.aborted) setCargando(false)
        }
      }, 110)
      return () => window.clearTimeout(timer)
    }, [consulta])

    useEffect(() => {
      if (indiceActivo < 0 || !listRef.current) return
      const item = listRef.current.children[indiceActivo] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }, [indiceActivo])

    const limpiar = () => {
      abortRef.current?.abort()
      setConsulta('')
      setResultados([])
      setMensajeVacio(null)
      cerrarLista()
      inputRef.current?.focus()
    }

    const elegir = (c: PosCliente) => {
      onSeleccion(c)
      abortRef.current?.abort()
      setConsulta('')
      setResultados([])
      setMensajeVacio(null)
      cerrarLista()
    }

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      const hayLista = abierto && resultados.length > 0
      switch (e.key) {
        case 'ArrowDown':
          if (!hayLista) return
          e.preventDefault()
          setIndiceActivo((i) => (i < resultados.length - 1 ? i + 1 : 0))
          break
        case 'ArrowUp':
          if (!hayLista) return
          e.preventDefault()
          setIndiceActivo((i) => (i > 0 ? i - 1 : resultados.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          if (hayLista && indiceActivo >= 0 && indiceActivo < resultados.length) elegir(resultados[indiceActivo])
          break
        case 'Escape':
          e.preventDefault()
          if (abierto) cerrarLista()
          else limpiar()
          break
        case 'Tab':
          if (hayLista && indiceActivo >= 0) elegir(resultados[indiceActivo])
          cerrarLista()
          break
      }
    }

    const mostrarPanel =
      abierto && consulta.trim().length >= MIN_CARACTERES && (cargando || resultados.length > 0 || !!mensajeVacio)

    return (
      <div className="cj-search">
        <label htmlFor={`${baseId}-input`} className="cj-label">
          Buscar alumno, docente o externo
          <span className="cj-muted"> · Ciclo {etiquetaCicloEscolar(ciclo)}</span>
        </label>
        <div className="cj-input-wrap">
          <Search size={18} className="cj-input-icon" aria-hidden />
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            type="search"
            role="combobox"
            className="cj-input cj-input--lg"
            placeholder="Nombre, apellidos o número de control…"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              if (e.target.value.trim().length >= MIN_CARACTERES) setAbierto(true)
            }}
            onFocus={() => {
              if (resultados.length > 0 && consulta.trim().length >= MIN_CARACTERES) setAbierto(true)
            }}
            onBlur={() => window.setTimeout(cerrarLista, 150)}
            onKeyDown={onKeyDown}
            aria-autocomplete="list"
            aria-expanded={mostrarPanel}
            aria-controls={listboxId}
            aria-activedescendant={indiceActivo >= 0 ? `${baseId}-opt-${indiceActivo}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {cargando ? (
            <Loader2 size={18} className="cj-input-trail cj-spin" aria-label="Buscando" />
          ) : consulta ? (
            <button type="button" className="cj-input-trail cj-input-clear" onClick={limpiar} aria-label="Limpiar búsqueda">
              <X size={16} />
            </button>
          ) : (
            <kbd className="cj-input-trail cj-kbd">F2</kbd>
          )}
        </div>

        {mostrarPanel ? (
          <div className="cj-results" role="presentation">
            {cargando && resultados.length === 0 ? <p className="cj-results-status">Buscando coincidencias…</p> : null}
            {mensajeVacio && !cargando ? (
              <p className="cj-results-status cj-results-status--empty">{mensajeVacio}</p>
            ) : null}
            {resultados.length > 0 ? (
              <ul ref={listRef} id={listboxId} role="listbox" className="cj-results-list" aria-label="Resultados">
                {resultados.map((c, i) => {
                  const activo = i === indiceActivo
                  const estatus = parseEstatusAlumno(c.estatus)
                  return (
                    <li
                      key={`${c.tipo}-${c.ref}`}
                      id={`${baseId}-opt-${i}`}
                      role="option"
                      aria-selected={activo}
                      className={`cj-result${activo ? ' is-active' : ''}`}
                      onMouseEnter={() => setIndiceActivo(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(c)}
                    >
                      <span className="cj-result-rank" aria-hidden>
                        {i + 1}
                      </span>
                      <span className={`cj-avatar cj-avatar--${c.tipo}`} aria-hidden>
                        {iniciales(c.nombre)}
                      </span>
                      <span className="cj-result-main">
                        <span className="cj-result-name">{resaltar(c.nombre, consulta)}</span>
                        <span className="cj-result-meta">{metaCliente(c)}</span>
                        <span className="cj-result-tags">
                          <span className={`cj-tag cj-tag--${c.tipo}`}>{TIPO_ETIQUETA[c.tipo]}</span>
                          {c.tipo === 'alumno' ? (
                            <span className={`cj-tag ${claseEstatus(estatus)}`}>{etiquetaEstatusAlumno(c.estatus)}</span>
                          ) : null}
                          {(c.campos ?? []).map((campo) => (
                            <span key={campo} className="cj-tag cj-tag--campo">
                              {ETIQUETA_CAMPO[campo]}
                            </span>
                          ))}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }
)

export default ClienteBuscador
