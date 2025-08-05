import { supabase } from './supabase';

export interface VentaData {
  pago_ref: string;
  pago_descripcion: string;
  pago_costo: number;
  pago_fecha: string;
  pago_cantidad: number;
}

export const saveVenta = async (ventaData: VentaData) => {
  try {
    const { data, error } = await supabase
      .from('pago_desayunos')
      .insert([ventaData])
      .select();

    if (error) {
      console.error('Error al guardar la venta:', error);
      throw error;
    }

    console.log('Venta guardada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('Error en saveVenta:', error);
    throw error;
  }
};

export const getVentas = async () => {
  try {
    const { data, error } = await supabase
      .from('pago_desayunos')
      .select('*')
      .order('pago_fecha', { ascending: false });

    if (error) {
      console.error('Error al obtener ventas:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error en getVentas:', error);
    throw error;
  }
}; 