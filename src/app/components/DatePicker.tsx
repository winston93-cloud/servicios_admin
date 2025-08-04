'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function DatePicker({ selectedDate, onDateChange, onClose, isOpen }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [selectedDateState, setSelectedDateState] = useState(selectedDate);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    setSelectedDateState(selectedDate);
    setCurrentMonth(new Date(selectedDate));
  }, [selectedDate]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Agregar días del mes anterior para completar la primera semana
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    // Agregar días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      days.push({ date: currentDate, isCurrentMonth: true });
    }
    
    // Agregar días del siguiente mes para completar la última semana
    const remainingDays = 42 - days.length; // 6 semanas * 7 días
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false });
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDate(date) === formatDate(today);
  };

  const isSelected = (date: Date) => {
    return formatDate(date) === formatDate(selectedDateState);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDateState(date);
    onDateChange(date);
    onClose();
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDateState(today);
    onDateChange(today);
    onClose();
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const days = getDaysInMonth(currentMonth);

  if (!isOpen) return null;

  return (
    <div className="date-picker-overlay">
      <div ref={calendarRef} className="date-picker-calendar">
        {/* Header del calendario */}
        <div className="calendar-header">
          <div className="calendar-title">
            <Calendar className="calendar-icon" />
            <span>Seleccionar Fecha</span>
          </div>
          <button onClick={onClose} className="calendar-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* Navegación del mes */}
        <div className="calendar-navigation">
          <button onClick={goToPreviousMonth} className="nav-btn">
            <ChevronLeft size={20} />
          </button>
          <div className="current-month">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <button onClick={goToNextMonth} className="nav-btn">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="calendar-weekdays">
          {dayNames.map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="calendar-days">
          {days.map(({ date, isCurrentMonth }, index) => (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              className={`calendar-day ${
                !isCurrentMonth ? 'other-month' : ''
              } ${
                isToday(date) ? 'today' : ''
              } ${
                isSelected(date) ? 'selected' : ''
              }`}
              disabled={!isCurrentMonth}
            >
              {date.getDate()}
            </button>
          ))}
        </div>

        {/* Botón de hoy */}
        <div className="calendar-footer">
          <button onClick={goToToday} className="today-btn">
            Hoy
          </button>
        </div>
      </div>
    </div>
  );
} 