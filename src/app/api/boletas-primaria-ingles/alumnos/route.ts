import { rutasDireccionPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'

const rutas = rutasDireccionPrimaria('en').alumnos
export const GET = rutas.GET
