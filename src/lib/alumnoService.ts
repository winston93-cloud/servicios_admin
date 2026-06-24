import { supabase } from './supabase';
import {
  buscarAlumnosServicios,
  construirNombreCompleto,
  escaparIlike as escaparIlikeBusqueda,
} from './alumnoBusquedaServicios';
import { numeroCicloEscolarAdmin } from './cicloEscolarAdmin';

export interface AlumnoSearchResult {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_grado?: string
  alumno_grupo?: string
  alumno_nombre_completo: string
  full_name: string
  display_name: string
  type?: 'alumno' | 'maestro'
}

export interface MaestroAsAlumnoResult {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_grado?: string
  alumno_grupo?: string
  alumno_nombre_completo: string
  full_name: string
  display_name: string
  type: 'maestro'
}

export type CombinedSearchResult = AlumnoSearchResult | MaestroAsAlumnoResult;

function cicloPosActual(): number {
  return numeroCicloEscolarAdmin();
}

function mapAlumnoResult(
  alumno: Awaited<ReturnType<typeof buscarAlumnosServicios>>[number]
): AlumnoSearchResult {
  const nombreCompleto =
    alumno.nombre_completo ||
    construirNombreCompleto(alumno.alumno_nombre, alumno.alumno_app, alumno.alumno_apm);
  return {
    alumno_id: alumno.alumno_id,
    alumno_ref: String(alumno.alumno_ref ?? ''),
    alumno_app: alumno.alumno_app ?? '',
    alumno_apm: alumno.alumno_apm ?? '',
    alumno_nombre: alumno.alumno_nombre ?? '',
    alumno_nivel: Number(alumno.alumno_nivel ?? 0),
    alumno_grado: alumno.alumno_grado != null ? String(alumno.alumno_grado) : undefined,
    alumno_grupo: alumno.alumno_grupo != null ? String(alumno.alumno_grupo) : undefined,
    alumno_nombre_completo: nombreCompleto,
    full_name: nombreCompleto,
    display_name: nombreCompleto,
    type: 'alumno',
  };
}

async function searchMaestrosBoleta(query: string): Promise<MaestroAsAlumnoResult[]> {
  const searchTerm = query.replace(/\s+/g, ' ').trim();
  if (!searchTerm) return [];

  const esc = escaparIlikeBusqueda(searchTerm);
  const patron = `%${esc}%`;
  const tokens = searchTerm.split(' ').filter((t) => t.length >= 2);
  const orParts = new Set<string>([
    `maestro_nombre.ilike.${patron}`,
    `maestro_app.ilike.${patron}`,
    `maestro_apm.ilike.${patron}`,
  ]);
  for (const token of tokens) {
    const p = `%${escaparIlikeBusqueda(token)}%`;
    orParts.add(`maestro_nombre.ilike.${p}`);
    orParts.add(`maestro_app.ilike.${p}`);
    orParts.add(`maestro_apm.ilike.${p}`);
  }

  const { data, error } = await supabase
    .from('boleta_maestro')
    .select('maestro_id, maestro_nombre, maestro_app, maestro_apm')
    .or([...orParts].join(','))
    .order('maestro_app', { ascending: true })
    .limit(5);

  if (error) {
    console.error('Error buscando maestros (boleta_maestro):', error);
    return [];
  }

  const vistos = new Set<number>();
  const results: MaestroAsAlumnoResult[] = [];

  for (const maestro of data ?? []) {
    const id = Number(maestro.maestro_id);
    if (vistos.has(id)) continue;
    vistos.add(id);

    const nombre = String(maestro.maestro_nombre ?? '').trim();
    const app = String(maestro.maestro_app ?? '').trim();
    const apm = String(maestro.maestro_apm ?? '').trim();
    const nombreCompleto = construirNombreCompleto(nombre, app, apm);

    results.push({
      alumno_id: id,
      alumno_ref: `P${id}`,
      alumno_app: app,
      alumno_apm: apm,
      alumno_nombre: nombre,
      alumno_nivel: 0,
      alumno_grado: 'MAESTRO',
      alumno_grupo: 'N/A',
      alumno_nombre_completo: nombreCompleto,
      full_name: nombreCompleto,
      display_name: nombreCompleto,
      type: 'maestro',
    });
  }

  return results.slice(0, 3);
}

export async function searchAlumnos(
  query: string,
  ciclo: string | number = cicloPosActual()
): Promise<AlumnoSearchResult[]> {
  const cicloNum = typeof ciclo === 'number' ? ciclo : parseInt(String(ciclo), 10);
  const rows = await buscarAlumnosServicios(query, Number.isNaN(cicloNum) ? cicloPosActual() : cicloNum);
  return rows.map(mapAlumnoResult).slice(0, 5);
}

/** Alumnos (Winston Servicios) + maestros (`boleta_maestro`). */
export async function searchAlumnosAndPersonal(query: string): Promise<CombinedSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.replace(/\s+/g, ' ').trim();
  const startTime = Date.now();

  try {
    const [alumnos, maestros] = await Promise.all([
      buscarAlumnosServicios(searchTerm, cicloPosActual()),
      searchMaestrosBoleta(searchTerm),
    ]);

    const results: CombinedSearchResult[] = [
      ...alumnos.map(mapAlumnoResult),
      ...maestros,
    ];

    results.sort((a, b) =>
      a.alumno_nombre_completo.localeCompare(b.alumno_nombre_completo, 'es')
    );

    console.log(
      `⚡ Búsqueda POS en ${Date.now() - startTime}ms — ${results.length} resultados (alumnos: ${alumnos.length}, maestros: ${maestros.length})`
    );

    return results.slice(0, 8);
  } catch (error) {
    console.error('Error en búsqueda combinada:', error);
    return [];
  }
}
