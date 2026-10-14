import { rutasDireccionPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'

const rutas = rutasDireccionPrimaria('es').alumnos
export const GET = rutas.GET
