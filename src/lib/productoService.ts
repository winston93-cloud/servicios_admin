import { desayunosDb } from './desayunosDb'

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

// Mapeo de códigos abreviados a nombres de productos (basado en datos reales de Supabase)
const CODIGOS_ABREVIADOS: Record<string, string> = {
  'dc': 'Desayuno CH',
  'dg': 'Desayuno GDE', 
  'cc': 'Comida',
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

  console.log('🔍 Searching productos with query:', query);
  const searchTerm = query.trim().toLowerCase()
  
  try {
    // Verificar si el término de búsqueda es un código abreviado
    const codigoAbreviado = CODIGOS_ABREVIADOS[searchTerm]
    console.log('Codigo abreviado encontrado:', codigoAbreviado);
    
    let searchQuery = desayunosDb
      .from('concepto_desayunos')
      .select('id, desayuno_nombre, desayuno_abreviatura, costo')
      .limit(10)

    if (codigoAbreviado) {
      // Si es un código abreviado, buscar por el nombre completo
      searchQuery = searchQuery.ilike('desayuno_nombre', `%${codigoAbreviado}%`)
    } else {
      // Búsqueda normal por nombre o abreviatura (insensible a mayúsculas)
      searchQuery = searchQuery.or(`desayuno_nombre.ilike.%${searchTerm}%,desayuno_abreviatura.ilike.%${searchTerm}%`)
    }

    const { data, error } = await searchQuery
    console.log('Search result:', { data, error });

    if (error) {
      console.error('Error searching productos:', error)
      return []
    }

    const results = data?.map(producto => ({
      ...producto,
      display_name: producto.desayuno_nombre
    })) || []
    
    console.log('✅ Search completed, results:', results.length);
    return results
  } catch (error) {
    console.error('Exception searching productos:', error)
    return []
  }
}

export async function getAllProductos(): Promise<ProductoSearchResult[]> {
  try {
    console.log('🛒 Getting all productos from concepto_desayunos...');
    
    const { data, error } = await desayunosDb
      .from('concepto_desayunos')
      .select('id, desayuno_nombre, desayuno_abreviatura, costo')
      .order('desayuno_nombre')

    console.log('Raw supabase response:', { data, error });

    if (error) {
      console.error('❌ Error getting productos:', error)
      console.error('Error details:', error.message, error.code, error.details);
      return []
    }

    const productos = data?.map(producto => ({
      id: producto.id,
      desayuno_nombre: producto.desayuno_nombre,
      desayuno_abreviatura: producto.desayuno_abreviatura,
      costo: producto.costo,
      display_name: producto.desayuno_nombre
    })) || []

    console.log('✅ All productos loaded:', productos.length);
    console.log('📋 Productos:', productos);
    return productos
  } catch (error) {
    console.error('💥 Exception getting all productos:', error)
    return []
  }
}



// Funciones CRUD para el modal de productos
export interface ProductoFormData {
  id?: number
  desayuno_nombre: string
  desayuno_abreviatura: string
  costo: number
}

export async function createProducto(producto: Omit<ProductoFormData, 'id'>): Promise<ProductoFormData | null> {
  try {
    console.log('Creating producto:', producto);
    
    const { data, error } = await desayunosDb
      .from('concepto_desayunos')
      .insert([{
        desayuno_nombre: producto.desayuno_nombre,
        desayuno_abreviatura: producto.desayuno_abreviatura,
        costo: producto.costo
      }])
      .select('*')
      .single()

    if (error) {
      console.error('Error creating producto:', error)
      throw error
    }

    console.log('Producto created successfully:', data)
    return data
  } catch (error) {
    console.error('Exception creating producto:', error)
    throw error
  }
}

export async function updateProducto(id: number, producto: Omit<ProductoFormData, 'id'>): Promise<ProductoFormData | null> {
  try {
    console.log('Updating producto:', { id, producto });
    
    // Primero verificamos que el producto existe
    const { data: existingProduct, error: checkError } = await desayunosDb
      .from('concepto_desayunos')
      .select('*')
      .eq('id', id)
      .single()

    if (checkError) {
      console.error('Error checking existing producto:', checkError)
      throw checkError
    }

    console.log('Existing producto found:', existingProduct);

    // Ahora actualizamos
    const { data, error } = await desayunosDb
      .from('concepto_desayunos')
      .update({
        desayuno_nombre: producto.desayuno_nombre,
        desayuno_abreviatura: producto.desayuno_abreviatura,
        costo: producto.costo
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating producto:', error)
      throw error
    }

    console.log('Producto updated successfully:', data)
    return data
  } catch (error) {
    console.error('Exception updating producto:', error)
    throw error
  }
}

export async function deleteProducto(id: number): Promise<boolean> {
  const { error } = await desayunosDb
    .from('concepto_desayunos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting producto:', error)
    return false
  }

  return true
}

export async function getProductoById(id: number): Promise<ProductoFormData | null> {
  const { data, error } = await desayunosDb
    .from('concepto_desayunos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error getting producto by id:', error)
    return null
  }

  return data
} 