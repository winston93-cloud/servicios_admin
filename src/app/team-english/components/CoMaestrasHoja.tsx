'use client'

import { useEffect, useState } from 'react'
import type { TeCoMaestrasPlan, TeNivel } from '@/lib/teamEnglish/teTypes'
import { teCoMaestrasAplicar, teCoMaestrasPlan } from '../teApi'
import { Hoja } from './ui'

export default function CoMaestrasHoja({ nivel, abierta, onCerrar, avisar }: {
  nivel: TeNivel
  abierta: boolean
  onCerrar: () => void
  avisar: (msg: string, tipo?: 'ok' | 'error') => void
}) {
  const [plan, setPlan] = useState<TeCoMaestrasPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setPlan(await teCoMaestrasPlan(nivel))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer Classroom.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (abierta) void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, nivel])

  const aplicar = async (email: string, etiqueta: string, quitar: boolean) => {
    if (!plan) return
    const ids = plan.cursos.filter((c) => c.ya.includes(email) === quitar).map((c) => c.id)
    if (!ids.length) return
    const texto = quitar
      ? `¿Quitar a ${etiqueta} como co-maestra de ${ids.length} clase(s)?`
      : `¿Agregar a ${etiqueta} como co-maestra en ${ids.length} clase(s)? Los alumnos la verán en la lista de maestros.`
    if (!window.confirm(texto)) return
    setOcupado(email)
    try {
      const r = await teCoMaestrasAplicar(email, ids, quitar)
      avisar(
        r.errores.length ? `${r.ok} listas, ${r.errores.length} con error.` : `${r.ok} clase(s) ${quitar ? 'sin' : 'con'} ${etiqueta}.`,
        r.errores.length ? 'error' : 'ok',
      )
      if (r.errores.length) console.warn('Co-maestras:', r.errores)
      await cargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Hoja abierta={abierta} titulo="Co-maestras en Classroom" emoji="🧑‍🏫" onCerrar={onCerrar}>
      <p className="te-nota">
        Agrega cuentas como co-maestras en las clases activas de las teachers para que puedan abrirlas en Classroom. Como co-maestras
        pueden editar y calificar, y los alumnos las ven en la lista de maestros.
      </p>
      {error ? (
        <p className="te-gclass-error" role="alert">😿 {error}</p>
      ) : cargando && !plan ? (
        <p className="te-cargando">Revisando las clases de cada teacher…</p>
      ) : plan ? (
        <>
          <div className="te-comaestras-cuentas">
            {plan.cuentas.map((c) => {
              const con = plan.cursos.filter((x) => x.ya.includes(c.email)).length
              const sin = plan.cursos.length - con
              return (
                <article key={c.email}>
                  <strong>{c.etiqueta}</strong>
                  <small>{c.email}</small>
                  <span className="te-chip te-chip-suave">En {con} de {plan.cursos.length} clases</span>
                  <div className="te-comaestras-acciones">
                    <button type="button" className="te-btn te-btn-primary te-btn-sm" disabled={!sin || !!ocupado}
                      onClick={() => void aplicar(c.email, c.etiqueta, false)}>
                      {ocupado === c.email ? 'Aplicando…' : `Agregar en ${sin}`}
                    </button>
                    <button type="button" className="te-btn te-btn-ghost te-btn-sm" disabled={!con || !!ocupado}
                      onClick={() => void aplicar(c.email, c.etiqueta, true)}>
                      Quitar de {con}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {plan.errores.length ? (
            <p className="te-gclass-error" role="alert">No se pudo revisar: {plan.errores.join(' · ')}</p>
          ) : null}
          <div className="te-tabla-scroll">
            <table className="te-comaestras-tabla">
              <thead>
                <tr>
                  <th scope="col">Clase</th>
                  <th scope="col">Teacher</th>
                  {plan.cuentas.map((c) => <th key={c.email} scope="col">{c.etiqueta}</th>)}
                </tr>
              </thead>
              <tbody>
                {plan.cursos.map((x) => (
                  <tr key={x.id}>
                    <td>{x.nombre}</td>
                    <td>{x.teacher}</td>
                    {plan.cuentas.map((c) => <td key={c.email} aria-label={x.ya.includes(c.email) ? 'Sí' : 'No'}>{x.ya.includes(c.email) ? '✅' : '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Hoja>
  )
}
