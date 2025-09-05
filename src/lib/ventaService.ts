import { supabase } from './supabase';

export interface VentaData {
  pago_ref: string;
  pago_descripcion: string;
  pago_costo: number;
  pago_fecha: string;
  pago_cantidad: number;
  pago_orden?: number;
  pago_estatus?: number;
}

export const saveVenta = async (ventaData: VentaData) => {
  try {
    console.log('💰 Intentando guardar venta:', ventaData);
    
    // Generar número de orden único basado en timestamp
    const numeroOrden = Date.now();
    
    // Preparar datos completos para insertar
    const ventaCompleta = {
      ...ventaData,
      pago_orden: numeroOrden,
      pago_estatus: 1 // 1 = pagado
    };
    
    console.log('📝 Datos completos a insertar:', ventaCompleta);
    
    const { data, error } = await supabase
      .from('pago_desayunos')
      .insert([ventaCompleta])
      .select();

    console.log('Respuesta de Supabase:', { data, error });

    if (error) {
      console.error('❌ Error al guardar la venta:', error);
      console.error('Error details:', error.message, error.code, error.details);
      throw new Error(`Error al guardar la venta: ${error.message}`);
    }

    console.log('✅ Venta guardada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('💥 Exception en saveVenta:', error);
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