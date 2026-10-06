import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import type { TeClassroomDetalle, TeClassroomResumen, TeNivel } from '@/lib/teamEnglish/teTypes'

async function leerJson(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(String(json.error || 'Algo salió mal, intenta de nuevo.'))
  return json
}

export async function teAccion<T = Record<string, unknown>>(nivel: TeNivel, accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/team-english', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...portalSessionFetchHeaders() },
    body: JSON.stringify({ ...datos, nivel, accion }),
  })
  return (await leerJson(res)) as T
}

export async function teClassroomGoogle(nivel: TeNivel, maestroId: number): Promise<TeClassroomResumen> {
  const res = await fetch(`/api/team-english/classroom?nivel=${nivel}&maestro_id=${maestroId}`, {
    headers: portalSessionFetchHeaders(),
    cache: 'no-store',
  })
  return (await leerJson(res)) as unknown as TeClassroomResumen
}

export async function teClassroomDetalle(nivel: TeNivel, maestroId: number, cursoId: string): Promise<TeClassroomDetalle> {
  const res = await fetch(
    `/api/team-english/classroom?nivel=${nivel}&maestro_id=${maestroId}&curso_id=${encodeURIComponent(cursoId)}`,
    { headers: portalSessionFetchHeaders(), cache: 'no-store' },
  )
  return (await leerJson(res)) as unknown as TeClassroomDetalle
}

export async function teSubir(nivel: TeNivel, campos: Record<string, string | number | Blob | null | undefined>): Promise<void> {
  const form = new FormData()
  form.set('nivel', String(nivel))
  for (const [k, v] of Object.entries(campos)) {
    if (v == null) continue
    form.set(k, v instanceof Blob ? v : String(v))
  }
  const res = await fetch('/api/team-english/archivo', { method: 'POST', headers: portalSessionFetchHeaders(), body: form })
  await leerJson(res)
}

const cacheBlobs = new Map<string, string>()

/** URL local (blob:) de un archivo privado del bucket. */
export async function teArchivoUrl(key: string, conSesion = true): Promise<string> {
  const previa = cacheBlobs.get(key)
  if (previa) return previa
  const res = await fetch(`/api/team-english/archivo?key=${encodeURIComponent(key)}`, {
    headers: conSesion ? portalSessionFetchHeaders() : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || 'No se pudo abrir el archivo.')
  }
  const url = URL.createObjectURL(await res.blob())
  cacheBlobs.set(key, url)
  return url
}

export async function teAbrirArchivo(key: string, conSesion = true): Promise<void> {
  const ventana = window.open('', '_blank')
  try {
    const url = await teArchivoUrl(key, conSesion)
    if (ventana) ventana.location.href = url
    else window.location.href = url
  } catch (e) {
    ventana?.close()
    throw e
  }
}
