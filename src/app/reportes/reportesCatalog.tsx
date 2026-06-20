import type { ReactNode } from 'react'
import { FileText, GraduationCap } from 'lucide-react'

export type ReporteAccent = 'violet' | 'amber' | 'emerald' | 'sky' | 'rose' | 'indigo'

export type ReporteCatalogItem = {
  id: string
  titulo: string
  meta: string
  descripcion: string
  accent: ReporteAccent
  icon: ReactNode
  keywords: string[]
}

export const REPORTES_CATALOGO: ReporteCatalogItem[] = [
  {
    id: 'alumnos-ciclo-23',
    titulo: 'Alumnos ciclo 23',
    meta: 'PDF · 79 alumnos',
    descripcion: 'Listado por nivel y grado con nombre, grupo y estatus.',
    accent: 'violet',
    icon: <FileText size={16} />,
    keywords: ['alumnos', 'ciclo', '23', 'nivel', 'grado'],
  },
  {
    id: 'becados',
    titulo: 'Alumnos becados',
    meta: 'PDF/HTML · por ciclo',
    descripcion: 'Becas activas en alumno_beca enlazadas con alumno por nivel y grado.',
    accent: 'amber',
    icon: <GraduationCap size={16} />,
    keywords: ['beca', 'becados', 'becas', 'ciclo', 'alumno_beca'],
  },
]
