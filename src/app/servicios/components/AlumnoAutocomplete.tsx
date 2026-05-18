'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Search, Loader2, X } from 'lucide-react'
import {
  buscarAlumnosServicios,
  construirNombreCompleto,
  MIN_CARACTERES,
  type AlumnoBusquedaResultado,
  type CampoBusquedaAlumno,
  grupoALetra,
} from '@/lib/alumnoBusquedaServicios'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  claseTagEstatusAlumno,
  etiquetaEstatusAlumno,
  parseEstatusAlumno,
} from '@/lib/alumnoStatus'

const ETIQUETA_CAMPO: Record<CampoBusquedaAlumno, string> = {
  nombre: 'Nombre',
  app: 'Ap. paterno',
  apm: 'Ap. materno',
  ref: 'No. control',
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function fragmentosResaltados(texto: string, consulta: string): ReactNode[] {
  const tokens = normalizar(consulta)
    .split(' ')
    .filter((t) => t.length >= 1)
  if (!tokens.length) return [texto]

  const partes: ReactNode[] = []
  let resto = texto
  let key = 0

  while (resto.length > 0) {
    const restoNorm = normalizar(resto)
    let mejorIndice = -1
    let mejorLongitud = 0

    for (const token of tokens) {
      const idx = restoNorm.indexOf(token)
      if (idx !== -1 && (mejorIndice === -1 || idx < mejorIndice)) {
        mejorIndice = idx
        mejorLongitud = token.length
      }
    }

    if (mejorIndice === -1) {
      partes.push(<span key={key++}>{resto}</span>)
      break
    }

    if (mejorIndice > 0) {
      partes.push(<span key={key++}>{resto.slice(0, mejorIndice)}</span>)
    }

    partes.push(
      <mark key={key++} className="alumno-ac-match">
        {resto.slice(mejorIndice, mejorIndice + mejorLongitud)}
      </mark>
    )
    resto = resto.slice(mejorIndice + mejorLongitud)
  }

  return partes
}

function textoNivel(nivel: number): string {
  switch (nivel) {
    case 1:
      return 'Maternal'
    case 2:
      return 'Kinder'
    case 3:
      return 'Primaria'
    case 4:
      return 'Secundaria'
    default:
      return `Nivel ${nivel}`
  }
}

interface AlumnoAutocompleteProps {
  onSeleccionar?: (alumno: AlumnoBusquedaResultado | null) => void
  /** Alumno compartido entre módulos (Alumnos, Becas, …). */
  alumnoSeleccionado?: AlumnoBusquedaResultado | null
  autoFocus?: boolean
  etiqueta?: string
}

export default function AlumnoAutocomplete({
  onSeleccionar,
  alumnoSeleccionado: alumnoControlado = null,
  autoFocus = true,
  etiqueta = 'Buscar alumno',
}: AlumnoAutocompleteProps) {
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState<AlumnoBusquedaResultado[]>([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(-1)
  const [seleccionado, setSeleccionado] = useState<AlumnoBusquedaResultado | null>(null)
  const [mensajeVacio, setMensajeVacio] = useState<string | null>(null)
  const { cicloSeleccionado, opcionesSelector } = useCicloEscolar()
  const etiquetaCiclo =
    opcionesSelector.find((o) => o.valor === cicloSeleccionado)?.etiqueta ?? 'ciclo actual'

  const alumnoVisible = alumnoControlado ?? seleccionado

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (!alumnoControlado) return
    setSeleccionado(alumnoControlado)
    setConsulta(alumnoControlado.nombre_completo)
  }, [alumnoControlado])

  const cerrarLista = useCallback(() => {
    setAbierto(false)
    setIndiceActivo(-1)
  }, [])

  const elegir = useCallback(
    async (pick: AlumnoBusquedaResultado) => {
      const canon = await obtenerAlumnoPorRef(pick.alumno_ref, cicloSeleccionado)
      const alumno: AlumnoBusquedaResultado = canon
        ? {
            ...pick,
            alumno_id: canon.alumno_id,
            alumno_ref: String(canon.alumno_ref),
            alumno_nombre: canon.alumno_nombre,
            alumno_app: canon.alumno_app,
            alumno_apm: canon.alumno_apm,
            alumno_nivel: canon.alumno_nivel,
            alumno_grado:
              canon.alumno_grado != null ? String(canon.alumno_grado) : null,
            alumno_grupo:
              canon.alumno_grupo != null ? String(canon.alumno_grupo) : null,
            nombre_completo: construirNombreCompleto(
              canon.alumno_nombre,
              canon.alumno_app,
              canon.alumno_apm
            ),
          }
        : pick

      setSeleccionado(alumno)
      setConsulta(alumno.nombre_completo)
      cerrarLista()
      setResultados([])
      onSeleccionar?.(alumno)
    },
    [cerrarLista, onSeleccionar, cicloSeleccionado]
  )

  useEffect(() => {
    const texto = consulta.trim()
    if (texto.length < MIN_CARACTERES) {
      abortRef.current?.abort()
      setResultados([])
      setCargando(false)
      setMensajeVacio(null)
      return
    }

    if (alumnoVisible && texto === alumnoVisible.nombre_completo) {
      return
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setCargando(true)
      setMensajeVacio(null)

      try {
        const lista = await buscarAlumnosServicios(texto, cicloSeleccionado, controller.signal)
        if (controller.signal.aborted) return
        setResultados(lista)
        setAbierto(true)
        setIndiceActivo(lista.length > 0 ? 0 : -1)
        setMensajeVacio(
          lista.length === 0
            ? 'No encontramos alumnos con ese criterio. Prueba otro nombre o apellido.'
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
  }, [consulta, alumnoVisible, cicloSeleccionado])

  useEffect(() => {
    if (indiceActivo < 0 || !listRef.current) return
    const item = listRef.current.children[indiceActivo] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [indiceActivo])

  const prepararNuevaBusqueda = useCallback(() => {
    abortRef.current?.abort()
    setConsulta('')
    setResultados([])
    setMensajeVacio(null)
    cerrarLista()
  }, [cerrarLista])

  const limpiar = () => {
    prepararNuevaBusqueda()
    setSeleccionado(null)
    onSeleccionar?.(null)
    inputRef.current?.focus()
  }

  const alClicEnInput = () => {
    prepararNuevaBusqueda()
    setSeleccionado(null)
    onSeleccionar?.(null)
    inputRef.current?.select()
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
        if (hayLista && indiceActivo >= 0 && indiceActivo < resultados.length) {
          elegir(resultados[indiceActivo])
        }
        break
      case 'Escape':
        e.preventDefault()
        if (abierto) cerrarLista()
        else limpiar()
        break
      case 'Tab':
        if (hayLista && indiceActivo >= 0) {
          elegir(resultados[indiceActivo])
        }
        cerrarLista()
        break
    }
  }

  const mostrarPanel =
    consulta.trim().length >= MIN_CARACTERES &&
    (cargando || resultados.length > 0 || !!mensajeVacio)

  return (
    <div className="alumno-ac">
      <label htmlFor={`${baseId}-input`} className="alumno-ac-label">
        {etiqueta}
        <span className="alumno-ac-label-ciclo"> · Ciclo {etiquetaCiclo}</span>
      </label>

      <div className="alumno-ac-input-wrap">
        <Search className="alumno-ac-input-icon" size={20} aria-hidden />
        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={mostrarPanel}
          aria-controls={listboxId}
          aria-activedescendant={
            indiceActivo >= 0 ? `${baseId}-opt-${indiceActivo}` : undefined
          }
          className="alumno-ac-input"
          placeholder="Nombre, apellidos o número de control…"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value)
            if (seleccionado) {
              setSeleccionado(null)
              onSeleccionar?.(null)
            }
            if (e.target.value.trim().length >= MIN_CARACTERES) setAbierto(true)
          }}
          onClick={alClicEnInput}
          onFocus={() => {
            if (resultados.length > 0 && consulta.trim().length >= MIN_CARACTERES) {
              setAbierto(true)
            }
          }}
          onKeyDown={onKeyDown}
        />
        {cargando && <Loader2 className="alumno-ac-spinner" size={20} aria-hidden />}
        {consulta && !cargando && (
          <button
            type="button"
            className="alumno-ac-clear"
            onClick={limpiar}
            aria-label="Limpiar búsqueda"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {mostrarPanel && (
        <div className="alumno-ac-panel" role="presentation">
          {cargando && resultados.length === 0 && (
            <p className="alumno-ac-status">Buscando coincidencias…</p>
          )}
          {mensajeVacio && !cargando && (
            <p className="alumno-ac-status alumno-ac-status--empty">{mensajeVacio}</p>
          )}
          {resultados.length > 0 && (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              className="alumno-ac-list"
              aria-label="Resultados de alumnos"
            >
              {resultados.map((alumno, index) => {
                const activo = index === indiceActivo
                const grupoLetra = grupoALetra(alumno.alumno_grupo)
                return (
                  <li
                    key={alumno.alumno_id}
                    id={`${baseId}-opt-${index}`}
                    role="option"
                    aria-selected={activo}
                    className={`alumno-ac-option ${activo ? 'alumno-ac-option--active' : ''}`}
                    onMouseEnter={() => setIndiceActivo(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(alumno)}
                  >
                    <span className="alumno-ac-option-rank" aria-hidden>
                      {index + 1}
                    </span>
                    <span className="alumno-ac-option-body">
                      <span className="alumno-ac-option-name">
                        {fragmentosResaltados(alumno.nombre_completo, consulta)}
                      </span>
                      <span className="alumno-ac-option-meta">
                        No. control {alumno.alumno_ref} · {textoNivel(alumno.alumno_nivel)}
                        {alumno.alumno_grado ? ` · ${alumno.alumno_grado}°` : ''}
                        {grupoLetra ? ` · Grupo ${grupoLetra}` : ''}
                      </span>
                      <span className="alumno-ac-option-tags">
                        <span
                          className={`alumno-ac-tag ${claseTagEstatusAlumno(parseEstatusAlumno(alumno.alumno_status))}`}
                        >
                          {etiquetaEstatusAlumno(alumno.alumno_status)}
                        </span>
                        {alumno.campos_coincidentes.map((c) => (
                          <span key={c} className="alumno-ac-tag alumno-ac-tag--campo">
                            {ETIQUETA_CAMPO[c]}
                          </span>
                        ))}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}