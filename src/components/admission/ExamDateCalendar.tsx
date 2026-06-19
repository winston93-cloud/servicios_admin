'use client'

import { useState, useMemo } from 'react'
import {
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isSameDay,
  isBefore,
  isWeekend,
  addMonths,
  subMonths,
  isAfter,
} from 'date-fns'
import { es, enUS } from 'date-fns/locale'

interface ExamDateCalendarProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  blockedDates?: string[] // YYYY-MM-DD, días bloqueados para este nivel
  isAdmin?: boolean
  locale?: string
}

const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMinBookableDate(): Date {
  let d = addDays(new Date(), 2)
  while (isWeekend(d)) {
    d = addDays(d, 1)
  }
  return d
}

export default function ExamDateCalendar({ value, onChange, blockedDates = [], isAdmin = false, locale = 'es' }: ExamDateCalendarProps) {
  const dateFnsLocale = locale === 'en' ? enUS : es
  const WEEKDAYS = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_ES
  const selectedDate = value ? new Date(value + 'T12:00:00') : null
  const minBookable = useMemo(() => getMinBookableDate(), [])
  const [isOpen, setIsOpen] = useState(!value)
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) return selectedDate
    return minBookable
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const isDayDisabled = (date: Date): boolean => {
    if (isWeekend(date)) return true
    const dayStr = format(date, 'yyyy-MM-dd')
    if (blockedDates.includes(dayStr)) return true
    
    // Si es admin, permitimos fechas cercanas pero NO pasadas ni HOY (mínimo 1 día de anticipación si se desea evitar "de un día para otro" estricto, o permitir mañana)
    // El usuario pidió "no puede reagendar de un día para otro", interpretamos como mínimo 24h o día siguiente.
    if (isAdmin) {
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      // Bloquear hoy y pasado. Permitir mañana en adelante.
      return isBefore(dayStart, addDays(todayStart, 1))
    }

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    // Validar que no sea fecha pasada
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (isBefore(dayStart, todayStart)) return true

    const minStart = new Date(minBookable.getFullYear(), minBookable.getMonth(), minBookable.getDate())
    return isBefore(dayStart, minStart)
  }

  const handleSelect = (date: Date) => {
    if (isDayDisabled(date)) return
    onChange(format(date, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const formattedSelectedDate = value && selectedDate
    ? locale === 'en'
      ? format(selectedDate, 'EEEE, MMMM d, yyyy', { locale: dateFnsLocale })
      : format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: dateFnsLocale })
    : ''

  const canPrevMonth = (): boolean => {
    const prev = subMonths(viewDate, 1)
    return prev.getFullYear() > minBookable.getFullYear() ||
      (prev.getFullYear() === minBookable.getFullYear() && prev.getMonth() >= minBookable.getMonth())
  }

  if (value && !isOpen) {
    return (
      <div className="exam-calendar-closed">
        <div className="exam-date-selected">
          <span className="exam-date-label">{locale === 'en' ? 'Exam date:' : 'Fecha del examen:'}</span>
          <span className="exam-date-value">{formattedSelectedDate}</span>
        </div>
        <button
          type="button"
          className="exam-date-change"
          onClick={() => setIsOpen(true)}
        >
          {locale === 'en' ? 'Change date' : 'Cambiar fecha'}
        </button>
      </div>
    )
  }

  return (
    <div className="exam-calendar">
      <div className="exam-calendar-header">
        <button
          type="button"
          className="exam-calendar-nav"
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          disabled={!canPrevMonth()}
          aria-label={locale === 'en' ? 'Previous month' : 'Mes anterior'}
        >
          ‹
        </button>
        <h3 className="exam-calendar-title">
          {format(viewDate, 'MMMM yyyy', { locale: dateFnsLocale })}
        </h3>
        <button
          type="button"
          className="exam-calendar-nav"
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          aria-label={locale === 'en' ? 'Next month' : 'Mes siguiente'}
        >
          ›
        </button>
      </div>

      <div className="exam-calendar-weekdays">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="exam-calendar-weekday">{wd}</span>
        ))}
      </div>

      <div className="exam-calendar-grid">
        {days.map((date) => {
          const disabled = isDayDisabled(date)
          const selected = selectedDate && isSameDay(date, selectedDate)
          const currentMonth = isSameMonth(date, viewDate)
          return (
            <button
              key={date.toISOString()}
              type="button"
              className={`exam-calendar-day ${!currentMonth ? 'other-month' : ''} ${disabled ? 'disabled' : ''} ${selected ? 'selected' : ''}`}
              onClick={() => handleSelect(date)}
              disabled={disabled}
            >
              {format(date, 'd')}
            </button>
          )
        })}
      </div>

      <p className="exam-calendar-note">
        {locale === 'en' ? 'Weekdays only. Minimum 2 days in advance.' : 'Solo días hábiles. Mínimo 2 días de anticipación.'}
      </p>
    </div>
  )
}
