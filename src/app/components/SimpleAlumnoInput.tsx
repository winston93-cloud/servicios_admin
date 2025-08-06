'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchAlumnos, AlumnoSearchResult } from '@/lib/alumnoService';

interface SimpleAlumnoInputProps {
  onAlumnoSelect: (alumno: AlumnoSearchResult) => void;
}

export default function SimpleAlumnoInput({ onAlumnoSelect }: SimpleAlumnoInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AlumnoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputPosition, setInputPosition] = useState({ top: 0, left: 0, width: 0 });

  // Focus automático
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Actualizar posición del input cuando cambie
  useEffect(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setInputPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [searchResults]);

  const handleInputClick = () => {
    setSearchTerm('');
  };

  // Búsqueda con debounce
  useEffect(() => {
    const searchAlumnosAsync = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchAlumnos(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error('Error buscando alumnos:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchAlumnosAsync, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectAlumno = (alumno: AlumnoSearchResult) => {
    setSearchTerm(alumno.display_name);
    onAlumnoSelect(alumno);
    setSearchResults([]);
  };

  return (
    <div className="relative" style={{ position: 'relative', zIndex: 999999 }}>
      {/* Input sencillo */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar alumno (nombre, apellido paterno, apellido materno)..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={handleInputClick}
        className="w-full px-6 py-10 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{
          paddingTop: '15px',
          paddingBottom: '15px',
          paddingLeft: '20px',
          paddingRight: '20px',
          fontSize: '16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />

      {/* Resultados de autocompletado usando Portal */}
      {searchResults.length > 0 && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: inputPosition.top + 5,
            left: inputPosition.left,
            width: inputPosition.width,
            backgroundColor: '#ffffff',
            border: '2px solid #ff0000',
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
            zIndex: 9999999,
            borderRadius: '6px',
            padding: '0',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {searchResults.map((alumno, index) => (
            <div
              key={alumno.alumno_id}
              onClick={() => handleSelectAlumno(alumno)}
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontSize: '14px',
                fontWeight: 'bold',
                borderBottom: index < searchResults.length - 1 ? '1px solid #ff0000' : 'none',
                padding: '10px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e3a8a';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#000000';
              }}
            >
              <div 
                style={{
                  color: 'inherit', 
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '4px'
                }}
              >
                {alumno.display_name}
              </div>
              <div 
                style={{
                  color: 'inherit', 
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                {alumno.alumno_ref} - {alumno.alumno_nivel}° - ALU{alumno.alumno_id.toString().padStart(3, '0')}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Indicador de carga */}
      {isLoading && (
        <div className="absolute right-3 top-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}
