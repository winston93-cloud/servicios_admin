import { rutasDireccionSecundaria } from '@/lib/boletasSecundariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const rutas = rutasDireccionSecundaria().alumnos
export const GET = rutas.GET
export const POST = rutas.POST
