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

export async function searchProductos(query: string): Promise<ProductoSearchResult[]> {
  if (!query || query.trim().length < 1) {
    return []
  }

  const searchTerm = query.trim().toLowerCase()

  const { data, error } = await supabase
    .from('concepto_desayunos')
    .select('id, desayuno_nombre, desayuno_abreviatura, costo')
    .ilike('desayuno_nombre', `%${searchTerm}%`)
    .limit(10)

  if (error) {
    console.error('Error searching productos:', error)
    return []
  }

  return data?.map(producto => ({
    ...producto,
    display_name: producto.desayuno_nombre
  })) || []
} 