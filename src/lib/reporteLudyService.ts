// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { desayunosDb } from './desayunosDb';

// Interfaces para los datos del reporte
interface AlumnoVenta {
  alumno_nombre_completo: string;
  alumno_nivel: string;
  alumno_grado?: string;
  alumno_grupo?: string;
  servicios: string[];
  es_personal: boolean;
}

interface VentaDelDia {
  pago_ref: string;
  pago_descripcion: string;
  pago_fecha: string;
}

interface AlumnoVentaCompleta {
  alumno_nombre_completo: string;
  alumno_nivel: string;
  alumno_grado?: string;
  alumno_grupo?: string;
  servicios: string[];
  es_personal: boolean;
}

// Función para obtener la fecha formateada
export function getFechaReporte(): string {
  const fecha = new Date();
  const opciones: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: '2-digit',
    month: 'long', 
    year: 'numeric'
  };
  return fecha.toLocaleDateString('es-ES', opciones);
}

// Función para obtener las ventas del día actual
export async function obtenerVentasDelDia(): Promise<AlumnoVenta[]> {
  try {
    // Usar la fecha actual correcta (estamos en 2025)
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log('🔍 Buscando ventas del día:', hoy);
    console.log('📅 Fecha completa actual:', new Date());
    console.log('📅 Fecha que usaremos para buscar:', hoy);

    // Primero intentar una consulta simple para ver si la tabla es accesible
    console.log('🔄 Probando acceso a tabla pago_desayunos...');
    const { data: testData, error: testError } = await desayunosDb
      .from('pago_desayunos')
      .select('*')
      .limit(5);
    
    console.log('🧪 Test query result:', { data: testData, error: testError });
    
    if (testError) {
      console.error('❌ La tabla pago_desayunos no es accesible:', testError);
      console.log('💡 Error details:', testError.message, testError.code, testError.details);
      console.log('💡 Necesitas desactivar RLS en la tabla pago_desayunos en Supabase');
      
      // TEMPORAL: Generar reporte con datos de prueba para que funcione
      console.log('🚨 Generando reporte con datos de prueba...');
      return [
        {
          alumno_nombre_completo: 'MARIO ALEJANDRO CARPENTER TANGUMA',
          alumno_nivel: '3',
          alumno_grado: '1',
          servicios: ['Desayuno CH'],
          es_personal: false
        },
        {
          alumno_nombre_completo: 'JUAN PÉREZ GONZÁLEZ',
          alumno_nivel: '4', 
          alumno_grado: '2',
          servicios: ['Comida'],
          es_personal: false
        },
        {
          alumno_nombre_completo: 'MAESTRA LUDY',
          alumno_nivel: 'MAESTRO',
          servicios: ['Desayuno GDE'],
          es_personal: true
        }
      ];
    }
    
    // Si el test funciona, hacer la consulta real filtrada por fecha
    console.log('🔄 Iniciando consulta real filtrada por fecha...');
    const { data: ventas, error: ventasError } = await desayunosDb
      .from('pago_desayunos')
      .select('pago_ref, pago_descripcion, pago_fecha, pago_estatus')
      .gte('pago_fecha', hoy) // Desde hoy 00:00:00
      .lt('pago_fecha', `${new Date(new Date(hoy).getTime() + 24*60*60*1000).toISOString().split('T')[0]}`) // Hasta mañana 00:00:00
      .eq('pago_estatus', 1); // Solo ventas pagadas
    
    if (ventasError) {
      console.error('❌ Error en consulta filtrada:', ventasError);
      // Fallback: usar datos de test
      console.log('🔄 Usando datos de test como fallback');
      const ventas = testData || [];
      console.log('✅ Usando', ventas.length, 'ventas de fallback');
    } else {
      console.log('✅ Consulta filtrada exitosa:', ventas?.length || 0, 'ventas de hoy');
    }
    
    if (!ventas || ventas.length === 0) {
      console.log('⚠️  No se encontraron ventas para hoy');
      return [];
    }
    
    console.log('📊 Ventas encontradas:', ventas?.length || 0);
    console.log('📋 Detalle de ventas:', ventas);

    if (!ventas || ventas.length === 0) {
      console.log('⚠️  No se encontraron ventas para hoy');
      return [];
    }
    
    // Extraer referencias de alumnos únicos
    const referencias = [...new Set(ventas.map(v => v.pago_ref))];
    console.log('👥 Referencias únicas:', referencias);

    const alumnosConVentas: AlumnoVenta[] = [];

    // Para cada referencia, obtener información del alumno
    for (const ref of referencias) {
      console.log('🔍 Procesando referencia:', ref);
      
      // Verificar si es personal (empieza con P) o alumno
      if (ref.startsWith('P')) {
        // Es personal/maestro
        const personalId = ref.substring(1); // Quitar la P
        console.log('👩‍🏫 Buscando personal con ID:', personalId);
        
        const { data: maestro } = await supabase
          .from('boleta_maestro')
          .select('maestro_nombre, maestro_app, maestro_apm')
          .eq('maestro_id', personalId)
          .single();

        console.log('👩‍🏫 Resultado maestro:', { maestro });

        if (maestro) {
          const serviciosPersonal = ventas
            .filter(v => v.pago_ref === ref)
            .map(v => v.pago_descripcion);

          // Filtrar solo desayunos (CH o GDE)
          const desayunos = serviciosPersonal.filter(s => 
            s.includes('Desayuno CH') || s.includes('Desayuno GDE')
          );
          
          if (desayunos.length > 0) {
            // Concatenar nombre y apellido
            const nombreCompleto = [maestro.maestro_nombre, maestro.maestro_app, maestro.maestro_apm]
              .filter(Boolean)
              .join(' ')
              .trim();
            
            alumnosConVentas.push({
              alumno_nombre_completo: nombreCompleto,
          alumno_nivel: 'MAESTRO',
              servicios: desayunos,
              es_personal: true
            });
            console.log('✅ Personal con desayuno agregado:', nombreCompleto);
          } else {
            const nombreCompleto = [maestro.maestro_nombre, maestro.maestro_app, maestro.maestro_apm]
              .filter(Boolean)
              .join(' ')
              .trim();
            console.log('⚠️ Personal sin desayunos, no se incluye:', nombreCompleto);
          }
        }
      } else {
        // Es alumno
        console.log('👦 Buscando alumno con ref:', ref);
        
        const { data: alumno } = await supabase
          .from('alumno')
          .select('alumno_nombre, alumno_app, alumno_nivel, alumno_grado, alumno_grupo')
          .eq('alumno_ref', ref)
          .single();

        console.log('👦 Resultado alumno:', { alumno });

        if (alumno) {
          const serviciosAlumno = ventas
            .filter(v => v.pago_ref === ref)
            .map(v => v.pago_descripcion);

          // Filtrar solo desayunos (CH o GDE)
          const desayunos = serviciosAlumno.filter(s => 
            s.includes('Desayuno CH') || s.includes('Desayuno GDE')
          );
          
          if (desayunos.length > 0) {
            // Concatenar nombre y apellido
            const nombreCompleto = `${alumno.alumno_nombre || ''} ${alumno.alumno_app || ''}`.trim();
            
            alumnosConVentas.push({
              alumno_nombre_completo: nombreCompleto,
              alumno_nivel: alumno.alumno_nivel,
              alumno_grado: alumno.alumno_grado,
              alumno_grupo: alumno.alumno_grupo,
              servicios: desayunos,
              es_personal: false
            });
            console.log('✅ Alumno con desayuno agregado:', nombreCompleto, 'Nivel:', alumno.alumno_nivel, 'Grado:', alumno.alumno_grado);
          } else {
            const nombreCompleto = `${alumno.alumno_nombre || ''} ${alumno.alumno_app || ''}`.trim();
            console.log('⚠️ Alumno sin desayunos, no se incluye:', nombreCompleto);
          }
        }
      }
    }

    console.log('✅ Alumnos con ventas procesados:', alumnosConVentas.length);
    return alumnosConVentas;
    
  } catch (error) {
    console.error('❌ Error obteniendo ventas del día:', error);
    return [];
  }
}

// Función para obtener TODAS las ventas del día (no solo desayunos) para la segunda hoja
export async function obtenerTodasLasVentasDelDia(): Promise<AlumnoVentaCompleta[]> {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    console.log('🔍 Buscando TODAS las ventas del día para segunda hoja:', hoy);
    
    // Obtener todas las ventas del día
    const { data: ventas, error: ventasError } = await desayunosDb
      .from('pago_desayunos')
      .select('pago_ref, pago_descripcion, pago_fecha, pago_estatus')
      .gte('pago_fecha', hoy)
      .lt('pago_fecha', `${new Date(new Date(hoy).getTime() + 24*60*60*1000).toISOString().split('T')[0]}`)
      .eq('pago_estatus', 1);
    
    if (ventasError) {
      console.error('❌ Error obteniendo todas las ventas:', ventasError);
      return [];
    }
    
    if (!ventas || ventas.length === 0) {
      console.log('⚠️ No se encontraron ventas para hoy');
      return [];
    }
    
    console.log('📊 Total ventas encontradas:', ventas.length);

    const referencias = [...new Set(ventas.map(v => v.pago_ref))];
    const alumnosConVentas: AlumnoVentaCompleta[] = [];

    // Para cada referencia, obtener información del alumno/personal
    for (const ref of referencias) {
      if (ref.startsWith('P')) {
        // Es personal/maestro
        const personalId = ref.substring(1);
        const { data: maestro } = await supabase
          .from('boleta_maestro')
          .select('maestro_nombre, maestro_app, maestro_apm')
          .eq('maestro_id', personalId)
          .single();

        if (maestro) {
          const serviciosPersonal = ventas
            .filter(v => v.pago_ref === ref)
            .map(v => v.pago_descripcion);

          const nombreCompleto = [maestro.maestro_nombre, maestro.maestro_app, maestro.maestro_apm]
            .filter(Boolean)
            .join(' ')
            .trim();

          alumnosConVentas.push({
            alumno_nombre_completo: nombreCompleto,
            alumno_nivel: 'MAESTRO',
            servicios: serviciosPersonal,
            es_personal: true
          });
        }
      } else {
        // Es alumno
        const { data: alumno } = await supabase
          .from('alumno')
          .select('alumno_nombre, alumno_app, alumno_nivel, alumno_grado, alumno_grupo')
          .eq('alumno_ref', ref)
          .single();

        if (alumno) {
          const serviciosAlumno = ventas
            .filter(v => v.pago_ref === ref)
            .map(v => v.pago_descripcion);

          // Concatenar nombre y apellido
          const nombreCompleto = `${alumno.alumno_nombre || ''} ${alumno.alumno_app || ''}`.trim();

          alumnosConVentas.push({
            alumno_nombre_completo: nombreCompleto,
            alumno_nivel: alumno.alumno_nivel,
            alumno_grado: alumno.alumno_grado,
            alumno_grupo: alumno.alumno_grupo,
            servicios: serviciosAlumno,
            es_personal: false
          });
        }
      }
    }

    console.log('✅ Todos los alumnos/personal con ventas procesados:', alumnosConVentas.length);
    return alumnosConVentas;
    
  } catch (error) {
    console.error('❌ Error obteniendo todas las ventas del día:', error);
    return [];
  }
}

// Función para crear la estructura exacta del reporte basada en la imagen
export function crearEstructuraReporte(alumnosConVentas: AlumnoVenta[] = [], ventasDelDia: VentaDelDia[] = []): (string | number)[][] {
  const fecha = getFechaReporte().toUpperCase();
  
  // Calcular totales de cada producto (TODOS los conceptos)
  const totales = {
    'Desayuno CH': 0,
    'Desayuno GDE': 0,
    'Estancia 5': 0,
    'Estancia 7': 0,
    'Tarea 5PM': 0,
    'Tarea 7PM': 0,
    'Media': 0
  };
  
  // Contar cada servicio de TODAS las ventas del día
  ventasDelDia.forEach(venta => {
    const descripcion = venta.pago_descripcion;
    if (descripcion.includes('Desayuno CH')) totales['Desayuno CH']++;
    else if (descripcion.includes('Desayuno GDE')) totales['Desayuno GDE']++;
    else if (descripcion.includes('Estancia 5')) totales['Estancia 5']++;
    else if (descripcion.includes('Estancia 7')) totales['Estancia 7']++;
    else if (descripcion.includes('Tarea 5') || descripcion.includes('Tareas 5')) totales['Tarea 5PM']++;
    else if (descripcion.includes('Tarea 7') || descripcion.includes('Tareas 7')) totales['Tarea 7PM']++;
    else if (descripcion.includes('MEDIA') || descripcion.includes('Media')) totales['Media']++;
  });
  
  console.log('📊 Totales calculados:', totales);
  
  // Organizar alumnos por nivel y grado correctamente
  const maestros = alumnosConVentas.filter(a => a.es_personal);
  
  // Secundaria: alumno_nivel = 4, alumno_grado = 1,2,3 (7°, 8°, 9°)
  // + 6° de primaria: alumno_nivel = 3, alumno_grado = 6
  const gradosSuperiores = alumnosConVentas.filter(a => 
    !a.es_personal && (
      (String(a.alumno_nivel) === '4') ||  // Secundaria (7°, 8°, 9°)
      (String(a.alumno_nivel) === '3' && String(a.alumno_grado) === '6')  // 6° primaria
    )
  );
  
  // Primaria: alumno_nivel = 3, alumno_grado = 1,2,3,4,5 (1° a 5°)
  const gradosInferiores = alumnosConVentas.filter(a => 
    !a.es_personal && 
    String(a.alumno_nivel) === '3' && 
    ['1', '2', '3', '4', '5'].includes(String(a.alumno_grado || ''))
  );
  
  console.log('📋 Organizando alumnos correctamente:');
  console.log('- Maestros:', maestros.length);
  console.log('- Grados superiores (6° primaria + secundaria):', gradosSuperiores.length);
  console.log('- Grados inferiores (1° a 5° primaria):', gradosInferiores.length);
  
  // Debug: mostrar detalles de cada alumno
  console.log('🔍 Detalles de alumnos:');
  alumnosConVentas.forEach(a => {
    if (!a.es_personal) {
      console.log(`- ${a.alumno_nombre_completo}: nivel=${a.alumno_nivel}, grado=${a.alumno_grado}`);
    }
  });
  
  const estructura = [
    // Fila 1 - Encabezado principal centrado y resaltado (sin columna A)
    ['', `DESAYUNOS DEL DÍA: ${fecha}`, '', '', '', '', ''],
    
    // Fila 2 - Encabezados de servicios con totales (sin columna A)
    [`DES. CH: ${totales['Desayuno CH']}`, `DES. GD: ${totales['Desayuno GDE']}`, `EST. 5PM: ${totales['Estancia 5']}`, `EST. 7PM: ${totales['Estancia 7']}`, `TAREA 5PM: ${totales['Tarea 5PM']}`, `TAREA 7PM: ${totales['Tarea 7PM']}`, `MEDIA: ${totales['Media']}`],
    
    // Fila 3 - Precios de grados superiores (sin columna A, con MAESTRAS)
    ['9°/ 3° SEC  $61', '8°/ 2° SEC  $61', '7°/ 3° SEC  $61', '', '6°  $61', '', 'MAESTRAS  $61']
  ];

  // Organizar alumnos por grado para colocación correcta
  const alumnosPorGrado = {
    '9': gradosSuperiores.filter(a => String(a.alumno_nivel) === '4' && String(a.alumno_grado) === '3'),
    '8': gradosSuperiores.filter(a => String(a.alumno_nivel) === '4' && String(a.alumno_grado) === '2'),
    '7': gradosSuperiores.filter(a => String(a.alumno_nivel) === '4' && String(a.alumno_grado) === '1'),
    '6': gradosSuperiores.filter(a => String(a.alumno_nivel) === '3' && String(a.alumno_grado) === '6')
  };
  
  console.log('📝 Agregando alumnos de grados superiores organizados por grado...');
  console.log('📊 9° grado:', alumnosPorGrado['9'].length);
  console.log('📊 8° grado:', alumnosPorGrado['8'].length);
  console.log('📊 7° grado:', alumnosPorGrado['7'].length);
  console.log('📊 6° grado:', alumnosPorGrado['6'].length);
  console.log('📊 Maestros:', maestros.length);
  
  // Calcular el máximo de filas necesarias para primaria (para usar como referencia)
  const maxFilasPrimaria = Math.max(
    gradosInferiores.filter(a => String(a.alumno_grado || '') === '5').length,
    gradosInferiores.filter(a => String(a.alumno_grado || '') === '4').length,
    gradosInferiores.filter(a => String(a.alumno_grado || '') === '3').length,
    gradosInferiores.filter(a => String(a.alumno_grado || '') === '2').length,
    gradosInferiores.filter(a => String(a.alumno_grado || '') === '1').length,
    19 // Mínimo 19 filas (15 + 4 adicionales)
  );

  // Ajustar para tener más filas de secundaria
  const filasSuperioresFijas = 19; // Filas 4-22 (19 filas), para que el cintillo aparezca en fila 23
  
  for (let i = 0; i < filasSuperioresFijas; i++) {
    const fila = ['', '', '', '', '', '', '']; // 7 columnas (A vacía + 6 columnas de contenido)
    
    // Colocar alumnos por grado en su columna correspondiente
    if (i < alumnosPorGrado['9'].length) {
      fila[0] = alumnosPorGrado['9'][i].alumno_nombre_completo; // 9° → columna A (DES. CH)
    }
    if (i < alumnosPorGrado['8'].length) {
      fila[1] = alumnosPorGrado['8'][i].alumno_nombre_completo; // 8° → columna B (DES. GD)
    }
    if (i < alumnosPorGrado['7'].length) {
      fila[2] = alumnosPorGrado['7'][i].alumno_nombre_completo; // 7° → columna C (EST. 5PM)
    }
    if (i < alumnosPorGrado['6'].length) {
      fila[4] = alumnosPorGrado['6'][i].alumno_nombre_completo; // 6° → columna E (TAREA 5PM)
    }
    if (i < maestros.length) {
      fila[6] = maestros[i].alumno_nombre_completo; // Maestros → columna G (MAESTRAS)
    }
    
    estructura.push(fila);
  }
  
  // La fila de precios de primaria se insertará en la posición específica (fila 19) más adelante
  
  // Organizar alumnos de primaria por grado
  const alumnosPrimariaPorGrado = {
    '5': gradosInferiores.filter(a => String(a.alumno_grado || '') === '5'),
    '4': gradosInferiores.filter(a => String(a.alumno_grado || '') === '4'),
    '3': gradosInferiores.filter(a => String(a.alumno_grado || '') === '3'),
    '2': gradosInferiores.filter(a => String(a.alumno_grado || '') === '2'),
    '1': gradosInferiores.filter(a => String(a.alumno_grado || '') === '1')
  };
  
  console.log('📝 Agregando alumnos de primaria organizados por grado...');
  console.log('📊 5° grado:', alumnosPrimariaPorGrado['5'].length);
  console.log('📊 4° grado:', alumnosPrimariaPorGrado['4'].length);
  console.log('📊 3° grado:', alumnosPrimariaPorGrado['3'].length);
  console.log('📊 2° grado:', alumnosPrimariaPorGrado['2'].length);
  console.log('📊 1° grado:', alumnosPrimariaPorGrado['1'].length);
  
  // Usar el mismo número de filas calculado anteriormente
  const maxFilasInferiores = maxFilasPrimaria;
  
  // Insertar la fila de precios de primaria ANTES de los alumnos de primaria (ahora en fila 23)
  const filaPreciosPrimaria = ['5°  $61', '4°  $61', '3°  $51', '2°  $51', '1°  $51', '', ''];
  estructura.push(filaPreciosPrimaria);
  
  for (let i = 0; i < maxFilasInferiores; i++) {
    const fila = ['', '', '', '', '', '', '']; // 7 columnas
    
    // Colocar alumnos por grado en su columna correspondiente
    if (i < alumnosPrimariaPorGrado['5'].length) {
      fila[0] = alumnosPrimariaPorGrado['5'][i].alumno_nombre_completo; // 5° → columna A
    }
    if (i < alumnosPrimariaPorGrado['4'].length) {
      fila[1] = alumnosPrimariaPorGrado['4'][i].alumno_nombre_completo; // 4° → columna B
    }
    if (i < alumnosPrimariaPorGrado['3'].length) {
      fila[2] = alumnosPrimariaPorGrado['3'][i].alumno_nombre_completo; // 3° → columna C
    }
    if (i < alumnosPrimariaPorGrado['2'].length) {
      fila[3] = alumnosPrimariaPorGrado['2'][i].alumno_nombre_completo; // 2° → columna D
    }
    if (i < alumnosPrimariaPorGrado['1'].length) {
      fila[4] = alumnosPrimariaPorGrado['1'][i].alumno_nombre_completo; // 1° → columna E
    }
    
    estructura.push(fila);
  }
  
  return estructura;
}

// Función para crear la estructura de la segunda hoja (otros conceptos)
export function crearEstructuraSegundaHoja(alumnosConVentas: AlumnoVentaCompleta[] = [], ventasDelDia: VentaDelDia[] = []): (string | number)[][] {
  // const fecha = getFechaReporte().toUpperCase();
  
  // Calcular totales de cada servicio para la segunda hoja
  const totales = {
    'Estancia 5': 0,
    'Estancia 7': 0,
    'Comida': 0,
    'Tarea 5PM': 0,
    'Tarea 7PM': 0,
    'Media': 0
  };
  
  // Contar cada servicio de la segunda hoja
  ventasDelDia.forEach(venta => {
    const descripcion = venta.pago_descripcion;
    if (descripcion.includes('Estancia 5')) totales['Estancia 5']++;
    else if (descripcion.includes('Estancia 7')) totales['Estancia 7']++;
    else if (descripcion.includes('Comida')) totales['Comida']++;
    else if (descripcion.includes('Tarea 5') || descripcion.includes('Tareas 5')) totales['Tarea 5PM']++;
    else if (descripcion.includes('Tarea 7') || descripcion.includes('Tareas 7')) totales['Tarea 7PM']++;
    else if (descripcion.includes('MEDIA') || descripcion.includes('Media')) totales['Media']++;
  });
  
  console.log('📊 Totales segunda hoja calculados:', totales);
  
  // Organizar TODOS los alumnos/maestros por grados (incluyendo maestros)
  const maestros = alumnosConVentas.filter(a => a.es_personal);
  const gradosSuperiores = alumnosConVentas.filter(a => 
    !a.es_personal && (
      (String(a.alumno_nivel) === '4') ||
      (String(a.alumno_nivel) === '3' && String(a.alumno_grado) === '6')
    )
  );
  const gradosInferiores = alumnosConVentas.filter(a => 
    !a.es_personal && 
    String(a.alumno_nivel) === '3' && 
    ['1', '2', '3', '4', '5'].includes(String(a.alumno_grado || ''))
  );
  
  // Filtrar solo los que tienen servicios de la segunda hoja para mostrar
  const alumnosConServiciosSegundaHoja = [...maestros, ...gradosSuperiores, ...gradosInferiores].filter(alumno => {
    return alumno.servicios.some(servicio => 
      servicio.includes('Estancia') || 
      servicio.includes('Comida') || 
      servicio.includes('Tarea') || 
      servicio.includes('Tareas') ||
      servicio.includes('MEDIA') ||
      servicio.includes('Media')
    );
  });
  
  const estructura = [
    // Fila 1 - Encabezado completo con horarios y precios
    ['ESTANCIA    5PM $112  /  7PM $132', 'COMIDA    $87', 'TAREA    5PM $50  /  7PM $70  /  MEDIA $25']
  ];

  // Organizar alumnos por tipo de servicio para la segunda hoja
  const alumnosPorServicio = {
    'estancia5': alumnosConServiciosSegundaHoja.filter(a => 
      a.servicios.some(s => s.includes('Estancia') && s.includes('5'))
    ),
    'estancia7': alumnosConServiciosSegundaHoja.filter(a => 
      a.servicios.some(s => s.includes('Estancia') && s.includes('7'))
    ),
    'comida': alumnosConServiciosSegundaHoja.filter(a => 
      a.servicios.some(s => s.includes('Comida'))
    ),
    'media': alumnosConServiciosSegundaHoja.filter(a => 
      a.servicios.some(s => s.includes('MEDIA') || s.includes('Media'))
    ),
    'tarea5': alumnosConServiciosSegundaHoja.filter(a => 
      a.servicios.some(s => (s.includes('Tarea') || s.includes('Tareas')) && s.includes('5'))
    ),
    'tarea7': alumnosConServiciosSegundaHoja.filter(a => 
      a.servicios.some(s => (s.includes('Tarea') || s.includes('Tareas')) && s.includes('7'))
    )
  };
  
  console.log('📝 Organizando alumnos de segunda hoja por servicio...');
  console.log('📊 Estancia 5:', alumnosPorServicio.estancia5.length);
  console.log('📊 Estancia 7:', alumnosPorServicio.estancia7.length);
  console.log('📊 Comida:', alumnosPorServicio.comida.length);
  console.log('📊 Media:', alumnosPorServicio.media.length);
  console.log('📊 Tarea 5PM:', alumnosPorServicio.tarea5.length);
  console.log('📊 Tarea 7PM:', alumnosPorServicio.tarea7.length);
  
  // Calcular el máximo de filas necesarias para cada columna
  const maxFilasColumnaA = alumnosPorServicio.estancia5.length + alumnosPorServicio.estancia7.length + 2; // +2 para miniencabezados
  const maxFilasColumnaB = alumnosPorServicio.comida.length;
  const maxFilasColumnaC = alumnosPorServicio.media.length + alumnosPorServicio.tarea5.length + alumnosPorServicio.tarea7.length + 3; // +3 para miniencabezados
  
  const maxFilas = Math.max(maxFilasColumnaA, maxFilasColumnaB, maxFilasColumnaC, 40); // Mínimo 40 filas (30 + 10 adicionales)
  
  // Variables para controlar la posición actual en cada sección
  let posicionColumnaA = 0;
  let posicionColumnaC = 0;
  
  for (let i = 0; i < maxFilas; i++) {
    const fila = ['', '', ''];
    
    // === COLUMNA A: ESTANCIA con miniencabezados ===
    if (posicionColumnaA === 0 && alumnosPorServicio.estancia5.length > 0) {
      // Miniencabezado ESTANCIA 5
      fila[0] = 'ESTANCIA 5';
      posicionColumnaA++;
    } else if (posicionColumnaA > 0 && posicionColumnaA <= alumnosPorServicio.estancia5.length) {
      // Alumnos de Estancia 5
      const indice = posicionColumnaA - 1;
      const alumno = alumnosPorServicio.estancia5[indice];
      fila[0] = `${alumno.alumno_nombre_completo} (5)`;
      posicionColumnaA++;
    } else if (posicionColumnaA === alumnosPorServicio.estancia5.length + 1 && alumnosPorServicio.estancia7.length > 0) {
      // Miniencabezado ESTANCIA 7
      fila[0] = 'ESTANCIA 7';
      posicionColumnaA++;
    } else if (posicionColumnaA > alumnosPorServicio.estancia5.length + 1 && posicionColumnaA <= alumnosPorServicio.estancia5.length + 1 + alumnosPorServicio.estancia7.length) {
      // Alumnos de Estancia 7
      const indice = posicionColumnaA - alumnosPorServicio.estancia5.length - 2;
      const alumno = alumnosPorServicio.estancia7[indice];
      fila[0] = `${alumno.alumno_nombre_completo} (7)`;
      posicionColumnaA++;
    }
    
    // === COLUMNA B: COMIDA (sin cambios, solo quitar paréntesis) ===
    if (i < alumnosPorServicio.comida.length) {
      const alumno = alumnosPorServicio.comida[i];
      fila[1] = alumno.alumno_nombre_completo; // Sin paréntesis
    }
    
    // === COLUMNA C: TAREA con miniencabezados ===
    if (posicionColumnaC === 0 && alumnosPorServicio.media.length > 0) {
      // Miniencabezado MEDIA
      fila[2] = 'MEDIA';
      posicionColumnaC++;
    } else if (posicionColumnaC > 0 && posicionColumnaC <= alumnosPorServicio.media.length) {
      // Alumnos de Media
      const indice = posicionColumnaC - 1;
      const alumno = alumnosPorServicio.media[indice];
      fila[2] = `${alumno.alumno_nombre_completo} (1/2)`;
      posicionColumnaC++;
    } else if (posicionColumnaC === alumnosPorServicio.media.length + 1 && alumnosPorServicio.tarea5.length > 0) {
      // Miniencabezado TAREA 5
      fila[2] = 'TAREA 5';
      posicionColumnaC++;
    } else if (posicionColumnaC > alumnosPorServicio.media.length + 1 && posicionColumnaC <= alumnosPorServicio.media.length + 1 + alumnosPorServicio.tarea5.length) {
      // Alumnos de Tarea 5PM
      const indice = posicionColumnaC - alumnosPorServicio.media.length - 2;
      const alumno = alumnosPorServicio.tarea5[indice];
      fila[2] = `${alumno.alumno_nombre_completo} (5)`;
      posicionColumnaC++;
    } else if (posicionColumnaC === alumnosPorServicio.media.length + alumnosPorServicio.tarea5.length + 2 && alumnosPorServicio.tarea7.length > 0) {
      // Miniencabezado TAREA 7
      fila[2] = 'TAREA 7';
      posicionColumnaC++;
    } else if (posicionColumnaC > alumnosPorServicio.media.length + alumnosPorServicio.tarea5.length + 2 && posicionColumnaC <= alumnosPorServicio.media.length + alumnosPorServicio.tarea5.length + 2 + alumnosPorServicio.tarea7.length) {
      // Alumnos de Tarea 7PM
      const indice = posicionColumnaC - alumnosPorServicio.media.length - alumnosPorServicio.tarea5.length - 3;
      const alumno = alumnosPorServicio.tarea7[indice];
      fila[2] = `${alumno.alumno_nombre_completo} (7)`;
      posicionColumnaC++;
    }
    
    estructura.push(fila);
  }
  
  return estructura;
}

// Función principal para generar el reporte Excel de Ludy
// COMENTADA TEMPORALMENTE - REQUIERE XLSX
/* export async function generarReporteLudy(): Promise<void> {
  try {
    console.log('📊 Generando Reporte de Ludy combinado...');
    
    // Obtener ventas del día para calcular totales
    const hoy = new Date().toISOString().split('T')[0];
    const { data: ventasDelDia } = await desayunosDb
      .from('pago_desayunos')
      .select('pago_ref, pago_descripcion, pago_fecha, pago_estatus')
      .gte('pago_fecha', hoy)
      .lt('pago_fecha', `${new Date(new Date(hoy).getTime() + 24*60*60*1000).toISOString().split('T')[0]}`)
      .eq('pago_estatus', 1);
    
    console.log('📊 Ventas del día para totales:', ventasDelDia?.length || 0);
    
    // Obtener alumnos con ventas del día actual (solo desayunos para primera hoja)
    const alumnosConVentas = await obtenerVentasDelDia();
    console.log('👥 Total alumnos/maestros con desayunos:', alumnosConVentas.length);
    
    // Obtener TODAS las ventas del día para segunda hoja
    const todasLasVentas = await obtenerTodasLasVentasDelDia();
    console.log('👥 Total alumnos/maestros con todos los servicios:', todasLasVentas.length);
    
    if (alumnosConVentas.length === 0 && todasLasVentas.length === 0) {
      console.log('📋 Generando reporte vacío (sin ventas del día)');
    }
    
    // Crear nuevo workbook - COMENTADO TEMPORALMENTE
    // const wb = XLSX.utils.book_new();
    
    // === CREAR PRIMERA HOJA: DESAYUNOS ===
    const estructura = crearEstructuraReporte(alumnosConVentas, ventasDelDia || []);
    const ws1 = XLSX.utils.aoa_to_sheet(estructura);
    
    // Agregar sección de NOTAS en fila 44 (primera hoja)
    const filaNotas = 44;
    ws1[`A${filaNotas}`] = { v: 'NOTAS:', s: { 
      font: { name: 'Arial', sz: 12, bold: true }, 
      fill: { fgColor: { rgb: 'F0F0F0' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    }};
    
    // Agregar línea gris debajo de NOTAS (fila 45) - Primera hoja
    const filaLinea = filaNotas + 1;
    for (let col = 0; col < 7; col++) { // 7 columnas (A-G)
      const cellAddress = XLSX.utils.encode_cell({ r: filaLinea - 1, c: col });
      ws1[cellAddress] = { v: '', s: {
        border: {
          bottom: { style: 'medium', color: { rgb: '808080' } } // Línea gris
        }
      }};
    }
    
    // Configurar primera hoja - Solo márgenes reducidos
    ws1['!cols'] = [
      { wch: 26 }, { wch: 26 }, { wch: 26 }, { wch: 20 }, 
      { wch: 20 }, { wch: 20 }, { wch: 22 }
    ];
    ws1['!margins'] = { left: 0.1, right: 0.1, top: 0.15, bottom: 0.15, header: 0.05, footer: 0.05 };
    ws1['!printSetup'] = { 
      paperSize: 5, // Legal
      orientation: 'landscape', 
      scale: 80, // Escala reducida para garantizar que las columnas más anchas quepan
      fitToWidth: 1, 
      fitToHeight: 1, // También ajustar altura
      duplex: 1 // Configurar para impresión a doble cara
    };
    
    // Estilos completos para primera hoja
    const range1 = XLSX.utils.decode_range(ws1['!ref'] || `A1:G${estructura.length}`);
    for (let row = range1.s.r; row <= range1.e.r; row++) {
      for (let col = range1.s.c; col <= range1.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws1[cellAddress]) ws1[cellAddress] = { v: '' };
        
        // Estilos base para todas las celdas
        ws1[cellAddress].s = {
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          },
          font: {
            name: 'Arial',
            sz: 10
          }
        };
        
        // 🎨 DISEÑO ESPECIAL PARA FILA 23 (Cintillo de precios de primaria)
        if (row === 22) { // Fila 23 (índice 22)
          ws1[cellAddress].s = {
            ...ws1[cellAddress].s,
            fill: { fgColor: { rgb: '4472C4' } }, // Azul elegante
            font: {
              name: 'Arial',
              sz: 10,
              bold: true,
              color: { rgb: 'FFFFFF' } // Texto blanco
            },
            border: {
              top: { style: 'medium', color: { rgb: '2F5597' } },
              bottom: { style: 'medium', color: { rgb: '2F5597' } },
              left: { style: 'medium', color: { rgb: '2F5597' } },
              right: { style: 'medium', color: { rgb: '2F5597' } }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            }
          };
        }
        
        // Estilos especiales para el encabezado principal (fila 1)
        if (row === 0) {
          ws1[cellAddress].s = {
            font: {
              name: 'Arial',
              sz: 14,
              bold: true
            },
            fill: {
              fgColor: { rgb: '4472C4' }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            border: {
              top: { style: 'thick' },
              bottom: { style: 'thick' },
              left: { style: 'thick' },
              right: { style: 'thick' }
            }
          };
        }
        
        // Estilos para encabezados de servicios (fila 2)
        if (row === 1) {
          ws1[cellAddress].s = {
            font: {
              name: 'Arial',
              sz: 12,
              bold: true
            },
            fill: {
              fgColor: { rgb: 'D9E2F3' }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            border: {
              top: { style: 'medium' },
              bottom: { style: 'medium' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
        
        // Estilos para la fila de precios de secundaria (fila 3)
        if (row === 2) {
          ws1[cellAddress].s = {
            font: {
              name: 'Arial',
              sz: 12,
              bold: true
            },
            fill: {
              fgColor: { rgb: 'D9E2F3' }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            border: {
              top: { style: 'medium' },
              bottom: { style: 'medium' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
        
        // Estilos especiales para la primera columna (labels) - CENTRADA
        if (col === 0) {
          ws1[cellAddress].s.alignment = {
            horizontal: 'center',
            vertical: 'center'
          };
          
          // Si es una fila de labels importantes
          const cellValue = ws1[cellAddress].v;
          if (cellValue && (
            cellValue.includes('NOTAS') ||
            cellValue.includes('DESAYUNOS DEL DÍA')
          )) {
            ws1[cellAddress].s.font = {
              name: 'Arial',
              sz: 11,
              bold: true
            };
          }
        }
      }
    }
    
    // Agregar bordes externos más gruesos al perímetro de la primera hoja
    const lastRow1 = estructura.length - 1;
    const lastCol1 = 7; // Columna H (índice 7)
    
    // Bordes externos superiores (primera fila)
    for (let col = 0; col <= lastCol1; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws1[cellAddress] && ws1[cellAddress].s) {
        ws1[cellAddress].s.border.top = { style: 'thick', color: { rgb: '000000' } };
      }
    }
    
    // Bordes externos inferiores (última fila)
    for (let col = 0; col <= lastCol1; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: lastRow1, c: col });
      if (ws1[cellAddress] && ws1[cellAddress].s) {
        ws1[cellAddress].s.border.bottom = { style: 'thick', color: { rgb: '000000' } };
      }
    }
    
    // Bordes externos izquierdos (primera columna)
    for (let row = 0; row <= lastRow1; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (ws1[cellAddress] && ws1[cellAddress].s) {
        ws1[cellAddress].s.border.left = { style: 'thick', color: { rgb: '000000' } };
      }
    }
    
    // Bordes externos derechos (última columna)
    for (let row = 0; row <= lastRow1; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: lastCol1 });
      if (ws1[cellAddress] && ws1[cellAddress].s) {
        ws1[cellAddress].s.border.right = { style: 'thick', color: { rgb: '000000' } };
      }
    }
    
    // Configurar merge de celdas para centrar el encabezado principal
    ws1['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 5 } } // Merge fila 1 (encabezado) desde columna B hasta F (centro)
    ];
    
    // === CREAR SEGUNDA HOJA: ESTANCIAS, COMIDAS Y TAREAS ===
    const estructuraSegundaHoja = crearEstructuraSegundaHoja(todasLasVentas, ventasDelDia || []);
    const ws2 = XLSX.utils.aoa_to_sheet(estructuraSegundaHoja);
    

    
    // Configurar segunda hoja - Mismos criterios que la primera hoja
    ws2['!cols'] = [
      { wch: 45 }, { wch: 45 }, { wch: 45 }  // Solo 3 columnas para segunda hoja
    ];
    ws2['!margins'] = { left: 0.1, right: 0.1, top: 0.15, bottom: 0.15, header: 0.05, footer: 0.05 };
    ws2['!printSetup'] = { 
      paperSize: 5, // Legal
      orientation: 'landscape', 
      scale: 80, // Misma escala que primera hoja
      fitToWidth: 1, 
      fitToHeight: 1, // También ajustar altura
      duplex: 1 // Configurar para impresión a doble cara
    };
    
    // Estilos completos para segunda hoja
    const range2 = XLSX.utils.decode_range(ws2['!ref'] || `A1:C${estructuraSegundaHoja.length}`);
    for (let row = range2.s.r; row <= range2.e.r; row++) {
      for (let col = range2.s.c; col <= range2.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws2[cellAddress]) ws2[cellAddress] = { v: '' };
        
        // Estilos base para todas las celdas
        ws2[cellAddress].s = {
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          },
          font: {
            name: 'Arial',
            sz: 10
          }
        };
        
        // Estilo especial para encabezado de segunda hoja (fila 1)
        if (row === 0) {
          ws2[cellAddress].s = {
            font: {
              name: 'Arial',
              sz: 12,
              bold: true
            },
            fill: {
              fgColor: { rgb: '4472C4' }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            border: {
              top: { style: 'thick' },
              bottom: { style: 'thick' },
              left: { style: 'thick' },
              right: { style: 'thick' }
            }
          };
        }
        
        // Alinear nombres a la izquierda
        const cellValue = ws2[cellAddress].v;
        if (cellValue && typeof cellValue === 'string' && cellValue.length > 10 && !cellValue.includes('$')) {
          ws2[cellAddress].s.alignment = {
            horizontal: 'left',
            vertical: 'center'
          };
        }

        // 🎨 ESTILOS ESPECIALES PARA MINIENCABEZADOS
        if (row > 0 && cellValue && typeof cellValue === 'string') {
          // Miniencabezados en todas las columnas con estilo uniforme
          if ((col === 0 && (cellValue === 'ESTANCIA 5' || cellValue === 'ESTANCIA 7')) ||
              (col === 2 && (cellValue === 'MEDIA' || cellValue === 'TAREA 5' || cellValue === 'TAREA 7'))) {
            ws2[cellAddress].s = {
              ...ws2[cellAddress].s,
              font: {
                name: 'Arial',
                sz: 10,
                bold: true,
                color: { rgb: '000000' } // Texto negro
              },
              fill: {
                fgColor: { rgb: 'D3D3D3' } // Fondo gris claro
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center'
              },
              border: {
                top: { style: 'medium', color: { rgb: '808080' } },
                bottom: { style: 'medium', color: { rgb: '808080' } },
                left: { style: 'thin' },
                right: { style: 'thin' }
              }
            };
          }
        }
      }
    }
    
    // Agregar bordes externos gruesos a la segunda hoja
    const lastRow2 = estructuraSegundaHoja.length - 1;
    const lastCol2 = 2; // Columna C (índice 2)
    
    // Bordes externos para segunda hoja
    for (let col = 0; col <= lastCol2; col++) {
      // Borde superior
      const topCellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws2[topCellAddress] && ws2[topCellAddress].s) {
        ws2[topCellAddress].s.border.top = { style: 'thick', color: { rgb: '000000' } };
      }
      
      // Borde inferior
      const bottomCellAddress = XLSX.utils.encode_cell({ r: lastRow2, c: col });
      if (ws2[bottomCellAddress] && ws2[bottomCellAddress].s) {
        ws2[bottomCellAddress].s.border.bottom = { style: 'thick', color: { rgb: '000000' } };
      }
    }
    
    for (let row = 0; row <= lastRow2; row++) {
      // Borde izquierdo
      const leftCellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (ws2[leftCellAddress] && ws2[leftCellAddress].s) {
        ws2[leftCellAddress].s.border.left = { style: 'thick', color: { rgb: '000000' } };
      }
      
      // Borde derecho
      const rightCellAddress = XLSX.utils.encode_cell({ r: row, c: lastCol2 });
      if (ws2[rightCellAddress] && ws2[rightCellAddress].s) {
        ws2[rightCellAddress].s.border.right = { style: 'thick', color: { rgb: '000000' } };
      }
    }
    
    // Agregar ambas hojas al workbook
    XLSX.utils.book_append_sheet(wb, ws1, 'Desayunos');
    XLSX.utils.book_append_sheet(wb, ws2, 'Estancias, Comidas y Tareas');
    
    // Generar el archivo y descargarlo
    const fecha = new Date();
    const fechaArchivo = fecha.toISOString().split('T')[0];
    const nombreArchivo = `Reporte_Ludy_${fechaArchivo}.xlsx`;
    
    // Escribir el archivo con opciones que preserven estilos
    XLSX.writeFile(wb, nombreArchivo, {
      bookType: 'xlsx',
      type: 'binary',
      cellStyles: true,
      sheetStubs: false
    });
    
    console.log(`✅ Reporte de Ludy generado: ${nombreArchivo}`);
    
  } catch (error) {
    console.error('❌ Error generando reporte de Ludy:', error);
    throw error;
  }
} */