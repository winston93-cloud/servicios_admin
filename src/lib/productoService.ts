import { supabase } from './supabase'

export interface Producto {
  id: number
  desayuno_nombre: string
  desayuno_abreviatura: string
  costo: number
}

export interface ProductoSearchResult {
  id: number
  desayuno_nombre: string
  desayuno_abreviatura: string
  costo: number
  display_name: string
  quantity?: number
}

// Mapeo de códigos abreviados a nombres de productos
const CODIGOS_ABREVIADOS: Record<string, string> = {
  'dc': 'Desayuno CH',
  'dg': 'Desayuno GDE',
  'c': 'Comida',
  'm': 'MEDIA',
  'e5': 'Estancia 5',
  'e7': 'Estancia 7',
  't5': 'Tareas 5',
  't7': 'Tareas 7',
  'em5': 'Est. Mes 5',
  'em7': 'Est. Mes 7'
}

export async function searchProductos(query: string): Promise<ProductoSearchResult[]> {
  if (!query || query.trim().length < 1) {
    return []
  }

  const searchTerm = query.trim().toLowerCase()
  
  // Verificar si el término de búsqueda es un código abreviado
  const codigoAbreviado = CODIGOS_ABREVIADOS[searchTerm]
  
  let searchQuery = supabase
    .from('concepto_desayunos')
    .select('id, desayuno_nombre, desayuno_abreviatura, costo')
    .limit(10)

  if (codigoAbreviado) {
    // Si es un código abreviado, buscar por el nombre completo
    searchQuery = searchQuery.ilike('desayuno_nombre', `%${codigoAbreviado}%`)
  } else {
    // Búsqueda normal por nombre o abreviatura
    searchQuery = searchQuery.or(`desayuno_nombre.ilike.%${searchTerm}%,desayuno_abreviatura.ilike.%${searchTerm}%`)
  }

  const { data, error } = await searchQuery

  if (error) {
    console.error('Error searching productos:', error)
    return []
  }

  return data?.map(producto => ({
    ...producto,
    display_name: producto.desayuno_nombre
  })) || []
} 