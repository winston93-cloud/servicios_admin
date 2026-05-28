import { NextResponse } from 'next/server'
import { htmlCuerpoCorreoMasivo, enviarCorreoMasivo } from '@/lib/emailServicios'
import { generarPdfCartaSuspension } from '@/lib/suspensionesPdf'
import type { AlumnoDeudorSuspension } from '@/lib/suspensionesService'
import type { TipoReporteSuspension } from '@/lib/suspensionesAdeudos'

export const runtime = 'nodejs'
export const maxDuration = 300

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

    const asunto =
      tipo === 3 || tipo === 4
        ? 'Aviso de Suspensión Administrativa'
        : 'Aviso por Adeudo'

    let enviados = 0
    let errores = 0
    let sinCorreo = 0
    const detalle: { alumnoRef: string; ok: boolean; mensaje: string }[] = []

    for (const fila of filas) {
      const emails = (fila.emails ?? []).filter((e) => e.includes('@'))
      if (!emails.length) {
        sinCorreo++
        detalle.push({
          alumnoRef: fila.alumnoRef,
          ok: false,
          mensaje: 'Sin correo autorizado',
        })
        continue
      }

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
        emails,
      }

      const pdf = generarPdfCartaSuspension({ deudor, plantel, fechaCartas })
      const html = htmlCuerpoCorreoMasivo(
        `Por medio del presente hacemos llegar el aviso de suspensión administrativa correspondiente al alumno ${fila.nombre} (control ${fila.alumnoRef}).`,
        fila.nivel
      )

      const res = await enviarCorreoMasivo({
        to: emails,
        subject: asunto,
        html,
        nivel: fila.nivel,
        attachments: [
          {
            filename: `carta_suspension_${fila.alumnoRef}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      })

      if (res.ok) {
        enviados++
        detalle.push({ alumnoRef: fila.alumnoRef, ok: true, mensaje: 'Enviado' })
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
      resumen: { enviados, errores, sinCorreo, total: filas.length },
      detalle,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar correos'
    console.error('suspensiones/enviar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
