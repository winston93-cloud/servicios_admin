'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Users } from 'lucide-react'
import type { BoletaModulo, BoletaPublicacion } from '@/lib/boletasPortal'
import { etiquetaCicloBoletas } from '@/lib/boletasCiclo'
import './boletas-publicar-papas.css'

const TRIMESTRES = [1, 2, 3] as const

function fechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

/**
 * Dirección/coordinación publica cada trimestre al portal de papás.
 * Mientras no se publique, los papás no ven esa boleta aunque ya esté capturada.
 */
export default function BoletasPublicarPapas({
  modulo,
  ciclo,
}: {
  modulo: BoletaModulo
  ciclo: number
}) {
  const [publicaciones, setPublicaciones] = useState<BoletaPublicacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/boletas-publicacion?modulo=${modulo}&ciclo=${ciclo}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = (await res.json().catch(() => ({}))) as {
        publicaciones?: BoletaPublicacion[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setPublicaciones(data.publicaciones ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la publicación.')
    } finally {
      setCargando(false)
    }
  }, [modulo, ciclo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function cambiar(trimestre: number, accion: 'publicar' | 'retirar') {
    const texto =
      accion === 'publicar'
        ? `¿Publicar las boletas del trimestre ${trimestre} a los papás de TODOS los grados y grupos de este módulo? Las verán en su portal de inmediato.`
        : `¿Retirar las boletas del trimestre ${trimestre} del portal de papás (todos los grados y grupos de este módulo)?`
    if (!window.confirm(texto)) return
    setOcupado(trimestre)
    setError('')
    try {
      const res = await fetch('/api/boletas-publicacion', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo, ciclo, trimestre, accion }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        publicaciones?: BoletaPublicacion[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setPublicaciones(data.publicaciones ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section className="bpp" aria-labelledby={`bpp-titulo-${modulo}`}>
      <header className="bpp-head">
        <Users size={18} aria-hidden />
        <div>
          <h2 id={`bpp-titulo-${modulo}`} className="bpp-titulo">
            Portal de papás · Ciclo {etiquetaCicloBoletas(ciclo)}
          </h2>
          <p className="bpp-sub">
            Se publica para <strong>todos los grados y grupos</strong> de este módulo, no solo el
            que tienes en pantalla. Publica cada trimestre cuando todos los grupos estén capturados;
            hasta entonces los papás no lo ven.
          </p>
        </div>
      </header>

      {error && (
        <p className="bpp-error" role="alert">
          {error}
        </p>
      )}

      <ul className="bpp-lista">
        {TRIMESTRES.map((t) => {
          const pub = publicaciones.find((p) => p.trimestre === t && p.grado === 0 && p.grupo === '')
          return (
            <li key={t} className={`bpp-item${pub ? ' is-publicada' : ''}`}>
              <div className="bpp-item-info">
                <span className="bpp-item-titulo">Trimestre {t}</span>
                <span className="bpp-item-estado">
                  {cargando
                    ? 'Cargando…'
                    : pub
                      ? `Publicada${pub.publicadaEn ? ` el ${fechaCorta(pub.publicadaEn)}` : ''}${
                          pub.publicadaPor ? ` · ${pub.publicadaPor}` : ''
                        }`
                      : 'No visible para papás'}
                </span>
              </div>
              <button
                type="button"
                className={`bpp-btn${pub ? ' is-retirar' : ''}`}
                disabled={cargando || ocupado != null}
                onClick={() => void cambiar(t, pub ? 'retirar' : 'publicar')}
              >
                {pub ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                {ocupado === t ? 'Guardando…' : pub ? 'Retirar' : 'Publicar a papás'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
