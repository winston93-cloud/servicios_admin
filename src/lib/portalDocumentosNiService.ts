import type { AppDatabaseClient, AppInsforgeClient } from '@/lib/dbTypes'
import { enviarCorreoMasivo } from '@/lib/emailServicios'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  DOCUMENTOS_NI_BUCKET,
  DOCUMENTOS_NI_MAX_BYTES,
  correoDocumentosNiEfectivo,
  documentosNiRequeridosPorNivel,
  esDocumentoNiTipoId,
  etiquetaDocumentoNi,
  type DocumentoNiTipoId,
} from '@/lib/portalDocumentosNiTipos'

export interface DocumentoNiArchivoMeta {
  tipo: DocumentoNiTipoId
  etiqueta: string
  nombreArchivo: string
  storageKey: string
  storageUrl: string
  size: number
}

export interface PortalDocumentosNiEnvio {
  id: number
  alumno_id: number
  alumno_ref: number
  ciclo_valor: number
  nivel: number
  correo_destino: string
  documentos: DocumentoNiArchivoMeta[]
  message_id: string | null
  enviado_at: string
}

export interface DocumentoNiSubidaTemp {
  tipo: DocumentoNiTipoId
  etiqueta: string
  nombreArchivo: string
  storageKey: string
  storageUrl: string
  size: number
}

const SELECT =
  'id, alumno_id, alumno_ref, ciclo_valor, nivel, correo_destino, documentos, message_id, enviado_at'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function prefijoStorageAlumno(cicloValor: number, alumnoId: number): string {
  return `${cicloValor}/${alumnoId}/`
}

export function storageKeyPerteneceAlumno(
  key: string,
  cicloValor: number,
  alumnoId: number
): boolean {
  return key.startsWith(prefijoStorageAlumno(cicloValor, alumnoId))
}

export async function obtenerUltimoEnvioDocumentosNi(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<PortalDocumentosNiEnvio | null> {
  const { data, error } = await db
    .from('portal_documentos_ni')
    .select(SELECT)
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .order('enviado_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return data as PortalDocumentosNiEnvio
}

export async function documentosNiYaEnviados(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<boolean> {
  const envio = await obtenerUltimoEnvioDocumentosNi(db, alumnoId, cicloValor)
  return Boolean(envio)
}

function htmlCorreoDocumentosNi(opts: {
  nivel: number
  alumnoNombre: string
  alumnoRef: number
  cicloNombre: string
  documentos: DocumentoNiArchivoMeta[]
}): string {
  const institucion =
    opts.nivel === 1 || opts.nivel === 2
      ? 'Instituto Educativo Winston'
      : 'Instituto Winston Churchill'
  const nivelEtiqueta = etiquetaNivelEscolar(opts.nivel)
  const lista = opts.documentos
    .map(
      (d) =>
        `<li style="margin:0 0 8px;color:#334155;font-size:0.95rem;">${escapeHtml(d.etiqueta)} — <span style="color:#64748b;">${escapeHtml(d.nombreArchivo)}</span></li>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0e7490 100%);border-radius:16px 16px 0 0;padding:22px 20px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:1.05rem;font-weight:700;">Documentos de nuevo ingreso</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;">
        <p style="margin:0 0 14px;color:#334155;font-size:1rem;line-height:1.65;">
          Buen día. Se recibieron los documentos de inscripción (PDF) del siguiente alumno:
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0 0 6px;color:#0f172a;font-size:1.05rem;font-weight:700;">${escapeHtml(opts.alumnoNombre)}</p>
              <p style="margin:0;color:#64748b;font-size:0.9rem;">No. ${String(opts.alumnoRef).padStart(5, '0')} · ${escapeHtml(nivelEtiqueta)} · Ciclo ${escapeHtml(opts.cicloNombre)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 10px;color:#1e293b;font-size:0.95rem;font-weight:600;">Archivos adjuntos:</p>
        <ul style="margin:0 0 18px;padding-left:20px;">${lista}</ul>
        <p style="margin:0;color:#64748b;font-size:0.85rem;line-height:1.55;">
          Los PDF también quedan resguardados en el expediente digital del portal.
        </p>
        <p style="margin:20px 0 0;color:#94a3b8;font-size:0.75rem;text-align:center;">${escapeHtml(institucion)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function subirDocumentoNiTemporal(opts: {
  client: AppInsforgeClient
  alumnoId: number
  cicloValor: number
  tipo: DocumentoNiTipoId
  buffer: Buffer
  nombreArchivo: string
}): Promise<DocumentoNiSubidaTemp> {
  if (opts.buffer.length > DOCUMENTOS_NI_MAX_BYTES) {
    throw new Error(
      `${etiquetaDocumentoNi(opts.tipo)}: máximo ${DOCUMENTOS_NI_MAX_BYTES / (1024 * 1024)} MB`
    )
  }
  if (opts.buffer.length < 64) {
    throw new Error(`${etiquetaDocumentoNi(opts.tipo)}: el archivo parece vacío o inválido`)
  }

  const safeName = opts.nombreArchivo
    .replace(/[^\w.\-() áéíóúÁÉÍÓÚñÑ]+/g, '_')
    .slice(0, 120)
  const key = `${prefijoStorageAlumno(opts.cicloValor, opts.alumnoId)}${opts.tipo}_${Date.now()}.pdf`
  const blob = new Blob([new Uint8Array(opts.buffer)], { type: 'application/pdf' })
  const { data, error } = await opts.client.storage
    .from(DOCUMENTOS_NI_BUCKET)
    .upload(key, blob)

  if (error || !data) {
    throw new Error(
      `No se pudo guardar ${etiquetaDocumentoNi(opts.tipo)}: ${error?.message ?? 'error de storage'}`
    )
  }

  return {
    tipo: opts.tipo,
    etiqueta: etiquetaDocumentoNi(opts.tipo),
    nombreArchivo: safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`,
    storageKey: data.key,
    storageUrl: data.url,
    size: opts.buffer.length,
  }
}

export async function enviarDocumentosNiDesdeStorage(opts: {
  client: AppInsforgeClient
  alumnoId: number
  alumnoRef: number
  alumnoNombre: string
  nivel: number
  cicloValor: number
  cicloNombre: string
  subidas: DocumentoNiSubidaTemp[]
}): Promise<PortalDocumentosNiEnvio> {
  const correo = correoDocumentosNiEfectivo(opts.nivel)
  if (!correo) {
    throw new Error(`Nivel inválido para envío de documentos: ${opts.nivel}`)
  }

  const porTipo = new Map(opts.subidas.map((s) => [s.tipo, s]))
  const requeridos = documentosNiRequeridosPorNivel(opts.nivel)
  for (const tipo of requeridos) {
    if (!porTipo.has(tipo.id)) {
      throw new Error(`Falta el documento: ${tipo.etiqueta}`)
    }
  }

  const metas: DocumentoNiArchivoMeta[] = []
  const adjuntos: { filename: string; content: Buffer; contentType: string }[] = []

  for (const tipo of requeridos) {
    const subida = porTipo.get(tipo.id)!
    if (!storageKeyPerteneceAlumno(subida.storageKey, opts.cicloValor, opts.alumnoId)) {
      throw new Error(`Archivo inválido para ${tipo.etiqueta}`)
    }

    const { data: blob, error } = await opts.client.storage
      .from(DOCUMENTOS_NI_BUCKET)
      .download(subida.storageKey)

    if (error || !blob) {
      throw new Error(
        `No se pudo leer ${tipo.etiqueta}: ${error?.message ?? 'archivo no encontrado'}`
      )
    }

    const buffer = Buffer.from(await blob.arrayBuffer())
    const meta: DocumentoNiArchivoMeta = {
      tipo: tipo.id,
      etiqueta: tipo.etiqueta,
      nombreArchivo: subida.nombreArchivo,
      storageKey: subida.storageKey,
      storageUrl: subida.storageUrl,
      size: buffer.length,
    }
    metas.push(meta)
    adjuntos.push({
      filename: `${tipo.id}_${opts.alumnoRef}.pdf`,
      content: buffer,
      contentType: 'application/pdf',
    })
  }

  const asunto = `Documentos NI · ${opts.alumnoNombre} · No. ${String(opts.alumnoRef).padStart(5, '0')} · ${etiquetaNivelEscolar(opts.nivel)}`
  const html = htmlCorreoDocumentosNi({
    nivel: opts.nivel,
    alumnoNombre: opts.alumnoNombre,
    alumnoRef: opts.alumnoRef,
    cicloNombre: opts.cicloNombre,
    documentos: metas,
  })

  const resultadoCorreo = await enviarCorreoMasivo({
    to: [correo],
    subject: asunto,
    html,
    nivel: opts.nivel,
    attachments: adjuntos,
  })

  if (!resultadoCorreo.ok) {
    throw new Error(resultadoCorreo.error ?? 'No se pudo enviar el correo a control escolar')
  }

  const { data: fila, error: insertError } = await opts.client.database
    .from('portal_documentos_ni')
    .insert([
      {
        alumno_id: opts.alumnoId,
        alumno_ref: opts.alumnoRef,
        ciclo_valor: opts.cicloValor,
        nivel: opts.nivel,
        correo_destino: correo,
        documentos: metas,
        message_id: resultadoCorreo.messageId ?? null,
      },
    ])
    .select(SELECT)
    .single()

  if (insertError || !fila) {
    throw new Error(insertError?.message ?? 'Correo enviado pero no se pudo registrar el envío')
  }

  return fila as PortalDocumentosNiEnvio
}

export function validarArchivoPdf(
  file: File,
  tipo: string
): { ok: true; tipo: DocumentoNiTipoId } | { ok: false; error: string } {
  if (!esDocumentoNiTipoId(tipo)) {
    return { ok: false, error: `Tipo de documento inválido: ${tipo}` }
  }
  const etiqueta = etiquetaDocumentoNi(tipo)
  if (!file.size) {
    return { ok: false, error: `${etiqueta}: archivo vacío` }
  }
  if (file.size > DOCUMENTOS_NI_MAX_BYTES) {
    return {
      ok: false,
      error: `${etiqueta}: máximo ${DOCUMENTOS_NI_MAX_BYTES / (1024 * 1024)} MB`,
    }
  }
  const esPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!esPdf) {
    return { ok: false, error: `${etiqueta}: solo se aceptan PDF` }
  }
  return { ok: true, tipo }
}
