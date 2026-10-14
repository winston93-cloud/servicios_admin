import { rutasDireccionSecundaria } from '@/lib/boletasSecundariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rutas = rutasDireccionSecundaria().promedios
export const GET = rutas.GET
