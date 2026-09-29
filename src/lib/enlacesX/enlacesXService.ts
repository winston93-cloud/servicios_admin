import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  CATEGORIAS,
  ENLACES_X_PIN_HEADER,
  parsearEnlaceX,
  type BorradorEnlaceX,
  type CategoriaEnlace,
  type EnlaceX,
} from './enlacesXTypes'

export class EnlacesXError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function responderError(e: unknown, contexto: string) {
  if (e instanceof EnlacesXError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(contexto, e)
  return NextResponse.json({ error: 'Error inesperado. Intenta de nuevo.' }, { status: 500 })
}

const SELECT = 'id, tweet_id, enlace, cuenta, autor, fecha, titulo, resumen, nota, categoria'
const db = () => createDbAdmin()

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/* ───────────── PIN de administración ───────────── */

export async function verificarPin(request: Request): Promise<void> {
  const esperado = process.env.ENLACES_X_PIN?.trim()
  if (!esperado) throw new EnlacesXError('La administración no está configurada (falta ENLACES_X_PIN).', 503)
  const recibido = Buffer.from((request.headers.get(ENLACES_X_PIN_HEADER) ?? '').trim())
  const ok = Buffer.from(esperado)
  if (recibido.length !== ok.length || !timingSafeEqual(recibido, ok)) {
    await new Promise((r) => setTimeout(r, 1000))
    throw new EnlacesXError('PIN incorrecto.', 401)
  }
}

/* ───────────── Consulta ───────────── */

export async function listarEnlaces(): Promise<EnlaceX[]> {
  const { data, error } = await db()
    .from('enlace_x')
    .select(SELECT)
    .eq('eliminado', false)
    .order('fecha', { ascending: false })
    .range(0, 999)
  if (error) throw new Error(`Enlaces X: ${error.message}`)
  return (data ?? []) as EnlaceX[]
}

/* ───────────── Autocompletado (oEmbed + IA) ───────────── */

function limpiarHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/pic\.twitter\.com\/\S+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

async function leerPost(enlace: string): Promise<{ autor: string; texto: string }> {
  try {
    const r = await fetch(`https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(enlace)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return { autor: '', texto: '' }
    const j = (await r.json()) as { author_name?: string; html?: string }
    const p = j.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''
    return { autor: j.author_name?.trim() ?? '', texto: limpiarHtml(p) }
  } catch {
    return { autor: '', texto: '' }
  }
}

const esCategoria = (v: unknown): v is CategoriaEnlace => CATEGORIAS.some((c) => c.valor === v)

async function redactarConIA(
  autor: string,
  cuenta: string,
  original: string
): Promise<{ titulo: string; resumen: string; categoria: CategoriaEnlace } | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key || !original) return null
  const categorias = CATEGORIAS.map((c) => `${c.valor} = ${c.etiqueta}`).join('; ')
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: process.env.OPENROUTER_CHAT_MODEL ?? 'openai/gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres editor de un boletín de tecnología para un equipo de desarrollo en México. ' +
              'Recibes una publicación de X y respondes SOLO un JSON con: ' +
              '"titulo" (titular en español, claro y atractivo, máximo 70 caracteres, sin comillas ni emojis), ' +
              '"resumen" (traducción/resumen fiel al español neutro de México, 1 a 3 oraciones, máximo 320 caracteres, sin emojis ni enlaces t.co), ' +
              `"categoria" (una de: ${categorias}).`,
          },
          { role: 'user', content: `Autor: ${autor} (@${cuenta})\nPublicación:\n${original}` },
        ],
      }),
    })
    if (!r.ok) {
      console.error('Enlaces X IA:', r.status, await r.text().catch(() => ''))
      return null
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = j.choices?.[0]?.message?.content ?? ''
    const obj = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Record<string, unknown>
    const titulo = texto(obj.titulo, 200)
    if (!titulo) return null
    return {
      titulo,
      resumen: texto(obj.resumen, 2000),
      categoria: esCategoria(obj.categoria) ? obj.categoria : 'tips',
    }
  } catch (e) {
    console.error('Enlaces X IA:', e)
    return null
  }
}

export async function autocompletarEnlace(url: unknown): Promise<BorradorEnlaceX> {
  const p = parsearEnlaceX(texto(url, 500))
  if (!p) throw new EnlacesXError('Pega el enlace de una publicación de X (x.com/usuario/status/…).')
  const { data: existe } = await db().from('enlace_x').select('id, eliminado').eq('tweet_id', p.tweetId).maybeSingle()
  if (existe && !(existe as { eliminado: boolean }).eliminado) {
    throw new EnlacesXError('Ese enlace ya está en la lista.', 409)
  }
  const post = await leerPost(p.enlace)
  const autor = post.autor || p.cuenta
  const ia = await redactarConIA(autor, p.cuenta, post.texto)
  return {
    tweet_id: p.tweetId,
    enlace: p.enlace,
    cuenta: p.cuenta,
    autor,
    titulo: ia?.titulo ?? '',
    resumen: ia?.resumen ?? post.texto.slice(0, 2000),
    categoria: ia?.categoria ?? 'tips',
    nota: null,
    textoOriginal: post.texto,
    autocompletadoIA: Boolean(ia),
  }
}

/* ───────────── Altas y bajas ───────────── */

export async function crearEnlace(body: Record<string, unknown>, registradoPor: string | null): Promise<EnlaceX> {
  const p = parsearEnlaceX(texto(body.enlace, 500))
  if (!p) throw new EnlacesXError('El enlace no es de una publicación de X.')
  const titulo = texto(body.titulo, 200)
  if (!titulo) throw new EnlacesXError('Escribe el título.')
  if (!esCategoria(body.categoria)) throw new EnlacesXError('Elige una categoría.')
  const fila = {
    tweet_id: p.tweetId,
    enlace: p.enlace,
    cuenta: p.cuenta,
    autor: texto(body.autor, 120) || p.cuenta,
    titulo,
    resumen: texto(body.resumen, 2000),
    nota: texto(body.nota, 1000) || null,
    categoria: body.categoria,
    registrado_por: registradoPor,
    eliminado: false,
    eliminado_por: null,
    eliminado_at: null,
    fecha: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db().from('enlace_x').upsert([fila], { onConflict: 'tweet_id' }).select(SELECT).single()
  if (error) throw new Error(`Guardar enlace X: ${error.message}`)
  return data as EnlaceX
}

export async function eliminarEnlace(id: unknown, eliminadoPor: string | null): Promise<void> {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new EnlacesXError('Enlace inválido.')
  const ahora = new Date().toISOString()
  const { data, error } = await db()
    .from('enlace_x')
    .update({ eliminado: true, eliminado_por: eliminadoPor, eliminado_at: ahora, updated_at: ahora })
    .eq('id', n)
    .eq('eliminado', false)
    .select('id')
  if (error) throw new Error(`Eliminar enlace X: ${error.message}`)
  if (!data?.length) throw new EnlacesXError('Ese enlace ya no existe.', 404)
}
