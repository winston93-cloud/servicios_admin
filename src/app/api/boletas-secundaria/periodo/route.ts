import { rutasDireccionSecundaria } from '@/lib/boletasSecundariaRutas'

export const dynamic = 'force-dynamic'

const rutas = rutasDireccionSecundaria().periodo
export const GET = rutas.GET
export const POST = rutas.POST
