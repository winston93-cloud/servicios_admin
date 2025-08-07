import { supabase } from './supabase';

export interface PersonalFormData {
  id?: number;
  personal_nombre: string;
  personal_app: string;
  personal_apm: string;
  personal_nombre_completo?: string; // Solo para lectura, se genera automáticamente
}

export interface PersonalSearchResult {
  id: number;
  personal_nombre: string;
  personal_app: string;
  personal_apm: string;
  personal_nombre_completo: string;
}

// Función para crear un nuevo registro de personal
export async function createPersonal(data: PersonalFormData): Promise<PersonalFormData> {
  // Concatenar los campos para crear el nombre completo
  const nombreCompleto = `${data.personal_nombre} ${data.personal_app} ${data.personal_apm}`.trim();
  
  const { data: result, error } = await supabase
    .from('personal')
    .insert([{
      personal_nombre: data.personal_nombre,
      personal_app: data.personal_app,
      personal_apm: data.personal_apm,
      personal_nombre_completo: nombreCompleto
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating personal:', error);
    throw error;
  }

  return result;
}

// Función para actualizar un registro de personal
export async function updatePersonal(id: number, data: PersonalFormData): Promise<PersonalFormData> {
  // Concatenar los campos para crear el nombre completo
  const nombreCompleto = `${data.personal_nombre} ${data.personal_app} ${data.personal_apm}`.trim();

  const { data: result, error } = await supabase
    .from('personal')
    .update({
      personal_nombre: data.personal_nombre,
      personal_app: data.personal_app,
      personal_apm: data.personal_apm,
      personal_nombre_completo: nombreCompleto
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating personal:', error);
    throw error;
  }

  return result;
}

// Función para eliminar un registro de personal
export async function deletePersonal(id: number): Promise<void> {
  const { error } = await supabase
    .from('personal')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting personal:', error);
    throw error;
  }
}

// Función para obtener todos los registros de personal
export async function getAllPersonal(): Promise<PersonalFormData[]> {
  const { data, error } = await supabase
    .from('personal')
    .select('*')
    .order('personal_nombre_completo');

  if (error) {
    console.error('Error fetching personal:', error);
    throw error;
  }

  return data || [];
}

// Función para buscar personal por nombre completo (autocompletado)
export async function searchPersonal(searchTerm: string): Promise<PersonalSearchResult[]> {
  if (searchTerm.trim().length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from('personal')
    .select('*')
    .ilike('personal_nombre_completo', `%${searchTerm}%`)
    .order('personal_nombre_completo')
    .limit(10);

  if (error) {
    console.error('Error searching personal:', error);
    throw error;
  }

  return data || [];
}
