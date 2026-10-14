import { rutasDireccionPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'

const rutas = rutasDireccionPrimaria('en').captura
export const GET = rutas.GET
export const PUT = rutas.PUT
