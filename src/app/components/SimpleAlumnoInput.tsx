'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchAlumnos, AlumnoSearchResult } from '@/lib/alumnoService';

interface SimpleAlumnoInputProps {
  onAlumnoSelect: (alumno: AlumnoSearchResult) => void;
}

export default function SimpleAlumnoInput({ onAlumnoSelect }: SimpleAlumnoInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AlumnoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1); // Índice del elemento seleccionado con teclado
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus automático
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Resetear índice seleccionado cuando cambien los resultados
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchResults]);

  const handleInputClick = () => {
    // No limpiamos el searchTerm para mantener el alumno seleccionado visible
  };

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleSelectAlumno(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchResults([]);
        setSelectedIndex(-1);
        setSearchTerm(''); // Limpiar también el searchTerm
        break;
    }
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

    const timeoutId = setTimeout(searchAlumnosAsync, 100);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Función para convertir nivel numérico a texto
  const getNivelText = (nivel: number): string => {
    switch (nivel) {
      case 1: return 'Maternal';
      case 2: return 'Kinder';
      case 3: return 'Primaria';
      case 4: return 'Secundaria';
      default: return `Nivel ${nivel}`;
    }
  };

  // Función para convertir grupo numérico a letra
  const getGrupoText = (grupo: string | number): string => {
    if (!grupo || grupo === '') return 'N/A';
    const grupoNum = typeof grupo === 'string' ? parseInt(grupo) : grupo;
    if (isNaN(grupoNum)) return 'N/A';
    switch (grupoNum) {
      case 1: return 'A';
      case 2: return 'B';
      case 3: return 'C';
      default: return grupoNum.toString();
    }
  };

  // Función para convertir grado numérico a texto
  const getGradoText = (grado: string | number, nivel: number): string => {
    if (!grado || grado === '') return 'N/A';
    const gradoNum = typeof grado === 'string' ? parseInt(grado) : grado;
    if (isNaN(gradoNum)) return 'N/A';
    
    if (nivel === 4) { // Secundaria
      switch (gradoNum) {
        case 1: return '7mo';
        case 2: return '8vo';
        case 3: return '9no';
        default: return `${gradoNum}°`;
      }
    } else { // Otros niveles
      return `${gradoNum}°`;
    }
  };

  const handleSelectAlumno = (alumno: AlumnoSearchResult) => {
    setSearchTerm(alumno.display_name);
    onAlumnoSelect(alumno);
    // No ocultamos los resultados para que el usuario pueda ver que se seleccionó correctamente
    setSelectedIndex(-1);
  };

  return (
    <div className="relative" style={{ position: 'relative', zIndex: 999999 }}>
      {/* Input sencillo */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar alumno (nombre, apellido paterno, apellido materno)..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          // Si el usuario empieza a escribir, mostrar resultados de búsqueda
          if (e.target.value.trim().length >= 2) {
            // Los resultados se cargarán automáticamente por el useEffect
          }
        }}
        onClick={handleInputClick}
        onKeyDown={handleKeyDown}
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

      {/* Resultados de autocompletado - Posicionamiento relativo */}
      {searchResults.length > 0 && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#0066CC',
            border: '2px solid #004499',
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
            zIndex: 9999999,
            borderRadius: '6px',
            padding: '0',
            maxHeight: '300px',
            overflowY: 'auto',
            marginTop: '5px'
          }}
        >
          {searchResults.map((alumno, index) => (
            <div
              key={alumno.alumno_id}
              onClick={() => handleSelectAlumno(alumno)}
              style={{
                backgroundColor: index === selectedIndex ? '#1e3a8a' : '#0066CC',
                color: index === selectedIndex ? '#ffffff' : '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold',
                borderBottom: index < searchResults.length - 1 ? '1px solid #004499' : 'none',
                padding: '10px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = '#1e3a8a';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = '#0066CC';
                  e.currentTarget.style.color = '#ffffff';
                }
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
                  opacity: 0.8
                }}
              >
                ID: {alumno.alumno_ref} | {getNivelText(alumno.alumno_nivel)} | {getGradoText(alumno.alumno_grado || '', alumno.alumno_nivel)} | {getGrupoText(alumno.alumno_grupo || '')}
              </div>
            </div>
          ))}
        </div>
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
