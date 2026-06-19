// Tipos de base de datos

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'professional' | 'client'
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  user_id: string
  phone: string
  address?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Professional {
  id: string
  user_id: string
  specialty: string
  bio?: string
  phone: string
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  description?: string
  duration_minutes: number
  price: number
  professional_id: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  client_id: string
  professional_id: string
  service_id: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  created_at: string
  updated_at: string
}

export interface Availability {
  id: string
  professional_id: string
  day_of_week: number // 0 = Domingo, 6 = Sábado
  start_time: string // formato HH:MM
  end_time: string // formato HH:MM
  active: boolean
  created_at: string
  updated_at: string
}

export type AdmissionLevel = 'maternal_kinder' | 'primaria' | 'secundaria'

export interface AdmissionAppointment {
  id: string
  campus: string
  level: string
  grade_level: string
  student_name: string
  student_age: string
  student_last_name_p?: string
  student_last_name_m?: string
  student_birth_date?: string
  school_cycle?: string
  how_did_you_hear?: string
  parent_name: string
  parent_email: string
  parent_phone: string
  relationship: string
  appointment_date: string
  appointment_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  origin?: string
  legacy_id?: number
  google_event_id?: string
  google_event_id_control_escolar?: string
  google_event_id_ingles?: string
  alumno_ref?: number
  created_at: string
  updated_at: string
}

export interface BlockedDate {
  id: string
  block_date: string
  level: AdmissionLevel
  reason?: string
  block_time: string | null
  created_at: string
}

export interface AdmissionSchedule {
  id: string
  level: AdmissionLevel
  time_slot: string
  sort_order: number
  created_at: string
}

export type PermissionRequestType   = 'reagendar' | 'horario' | 'bloqueo'
export type PermissionRequestStatus = 'pendiente' | 'aprobada' | 'rechazada'

export interface PermissionRequest {
  id: string
  type:   PermissionRequestType
  level:  AdmissionLevel
  status: PermissionRequestStatus

  // reagendar
  appointment_id?: string
  student_name?:   string
  student_birth_date?: string
  appt_date?:      string
  appt_time?:      string
  proposed_date?:  string
  proposed_time?:  string
  proposed_grade?: string

  // horario
  horario_action?:   'agregar' | 'eliminar'
  horario_time_new?: string
  horario_time_old?: string

  // bloqueo
  bloqueo_date?:     string
  bloqueo_date_end?: string
  bloqueo_time?:     string
  bloqueo_reason?:   string

  psych_message?:  string
  requested_by?:   string
  director_notes?: string

  created_at:   string
  responded_at?: string
}

export type TourRecorridoLevel = 'maternal' | 'kinder' | 'primaria' | 'secundaria'

export interface TourRecorrido {
  id: string
  level: TourRecorridoLevel
  tour_date: string
  tour_time: string
  parent_name: string
  parent_phone: string
  parent_email: string
  notes?: string
  email_parent_sent?: boolean
  email_director_sent?: boolean
  created_at: string
  updated_at: string
}
