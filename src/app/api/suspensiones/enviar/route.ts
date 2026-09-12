import { NextResponse } from 'next/server'
import { htmlCuerpoCorreoMasivo, enviarCorreoMasivo } from '@/lib/emailServicios'
import { generarPdfCartaSuspension } from '@/lib/suspensionesPdf'
import type { AlumnoDeudorSuspension } from '@/lib/suspensionesService'
import type { TipoReporteSuspension } from '@/lib/suspensionesAdeudos'
import {
  SUSPENSIONES_CORREO_PRUEBA,
  SUSPENSIONES_ENVIO_MODO_PRUEBA,
} from '@/lib/suspensionesEnvioConfig'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Copia del primer aviso de cada lote (Winston o Educativo). */
const COPIA_PRIMER_AVISO_PLANTEL = 'iwinston.adm@winston93.edu.mx'

interface EnvioFila {
  alumnoId: number
  alumnoRef: string
  nombre: string
  nivel: number
  adeudos: string
  emails?: string[]
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const plantel = Number(body.plantel) === 1 ? 1 : 2
    const tipo = Number(body.tipo) as TipoReporteSuspension
    const fechaCartas = String(body.fechaCartas ?? '').trim()
    const filas = (body.alumnos ?? []) as EnvioFila[]

    if (!filas.length) {
      return NextResponse.json({ error: 'No hay alumnos seleccionados' }, { status: 400 })
    }

    if (SUSPENSIONES_ENVIO_MODO_PRUEBA && !SUSPENSIONES_CORREO_PRUEBA.includes('@')) {
      return NextResponse.json(
        { error: 'Correo de prueba no configurado (SUSPENSIONES_CORREO_PRUEBA)' },
        { status: 500 }
      )
    }

    const asuntoBase =
      tipo === 3 || tipo === 4
        ? 'Aviso de Suspensión Administrativa'
        : 'Aviso por Adeudo'
    const asunto = SUSPENSIONES_ENVIO_MODO_PRUEBA
      ? `[PRUEBA] ${asuntoBase}`
      : asuntoBase

    let enviados = 0
    let errores = 0
    let sinCorreo = 0
    let copiaPlantelEnviada = false
    const detalle: { alumnoRef: string; ok: boolean; mensaje: string }[] = []

    for (const fila of filas) {
      const emailsPadres = (fila.emails ?? []).filter((e) => e.includes('@'))
      if (!SUSPENSIONES_ENVIO_MODO_PRUEBA && !emailsPadres.length) {
        sinCorreo++
        detalle.push({
          alumnoRef: fila.alumnoRef,
          ok: false,
          mensaje: 'Sin correo autorizado',
        })
        continue
      }

      const destinatarios = SUSPENSIONES_ENVIO_MODO_PRUEBA
        ? [SUSPENSIONES_CORREO_PRUEBA]
        : emailsPadres

      const deudor: AlumnoDeudorSuspension = {
        alumnoId: fila.alumnoId,
        alumnoRef: fila.alumnoRef,
        nombre: fila.nombre,
        nivel: fila.nivel,
        grado: 0,
        grupo: 0,
        gradoEtiqueta: '',
        adeudos: fila.adeudos,
        prorroga: null,
        planMes: null,
        emails: emailsPadres,
      }

      const pdf = generarPdfCartaSuspension({ deudor, plantel, fechaCartas })

      const notaPrueba = SUSPENSIONES_ENVIO_MODO_PRUEBA
        ? `\n\n[MODO PRUEBA — no se envió a familias]\nDestinatarios reales que quedarían: ${
            emailsPadres.length ? emailsPadres.join(', ') : '(sin correo en base de datos)'
          }`
        : ''

      const html = htmlCuerpoCorreoMasivo(
        `Por medio del presente hacemos llegar el aviso de suspensión administrativa correspondiente al alumno ${fila.nombre} (control ${fila.alumnoRef}).${notaPrueba}`,
        fila.nivel
      )

      // Solo el primer aviso del lote de este plantel (Winston o Educativo).
      const bccExtra =
        !SUSPENSIONES_ENVIO_MODO_PRUEBA && !copiaPlantelEnviada
          ? [COPIA_PRIMER_AVISO_PLANTEL]
          : undefined

      const res = await enviarCorreoMasivo({
        to: destinatarios,
        subject: asunto,
        html,
        nivel: fila.nivel,
        bcc: bccExtra,
        attachments: [
          {
            filename: `carta_suspension_${fila.alumnoRef}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      })

      if (res.ok) {
        if (bccExtra?.length) copiaPlantelEnviada = true
        enviados++
        detalle.push({
          alumnoRef: fila.alumnoRef,
          ok: true,
          mensaje: SUSPENSIONES_ENVIO_MODO_PRUEBA
            ? `Prueba → ${SUSPENSIONES_CORREO_PRUEBA}`
            : bccExtra?.length
              ? `Enviado (+ copia ${COPIA_PRIMER_AVISO_PLANTEL})`
              : 'Enviado',
        })
      } else {
        errores++
        detalle.push({
          alumnoRef: fila.alumnoRef,
          ok: false,
          mensaje: res.error ?? 'Error al enviar',
        })
      }
    }

    return NextResponse.json({
      ok: errores === 0,
      modoPrueba: SUSPENSIONES_ENVIO_MODO_PRUEBA,
      correoPrueba: SUSPENSIONES_ENVIO_MODO_PRUEBA ? SUSPENSIONES_CORREO_PRUEBA : undefined,
      resumen: {
        enviados,
        errores,
        sinCorreo,
        total: filas.length,
        copiaPrimerAvisoPlantel: copiaPlantelEnviada ? COPIA_PRIMER_AVISO_PLANTEL : null,
      },
      detalle,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar correos'
    console.error('suspensiones/enviar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
