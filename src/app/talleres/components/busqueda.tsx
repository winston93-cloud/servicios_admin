import type { ReactNode } from 'react'

/** Minúsculas y sin acentos, para comparar búsquedas. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Resalta la primera coincidencia (sin acentos) dentro del texto. */
export function Resaltar({ texto, q }: { texto: string; q: string }): ReactNode {
  const nq = norm(q)
  if (!nq) return texto
  const i = norm(texto).indexOf(nq)
  if (i === -1) return texto
  return (
    <>
      {texto.slice(0, i)}
      <mark className="tl-mark">{texto.slice(i, i + nq.length)}</mark>
      {texto.slice(i + nq.length)}
    </>
  )
}
