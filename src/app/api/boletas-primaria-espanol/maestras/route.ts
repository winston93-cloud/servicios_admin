import { rutasDireccionPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'

const rutas = rutasDireccionPrimaria('es').docentes
export const GET = rutas.GET
export const POST = rutas.POST
export const DELETE = rutas.DELETE
