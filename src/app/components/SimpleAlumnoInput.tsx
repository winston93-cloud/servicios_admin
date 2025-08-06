'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchAlumnos, AlumnoSearchResult } from '@/lib/alumnoService';

interface SimpleAlumnoInputProps {
  onAlumnoSelect?: (alumno: AlumnoSearchResult) => void;
}

export default function SimpleAlumnoInput({ onAlumnoSelect }: SimpleAlumnoInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AlumnoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Búsqueda simple
  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchAlumnos(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce simple
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Focus automático
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSelectAlumno = (alumno: AlumnoSearchResult) => {
    setSearchTerm(alumno.display_name);
    setSearchResults([]);
    if (onAlumnoSelect) {
      onAlumnoSelect(alumno);
    }
  };

  return (
    <div className="relative">
      {/* Input sencillo */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar alumno (nombre, apellido paterno, apellido materno)..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Resultados de autocompletado */}
      {searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {searchResults.map((alumno) => (
            <div
              key={alumno.alumno_id}
              onClick={() => handleSelectAlumno(alumno)}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
            >
              <div className="font-medium">{alumno.display_name}</div>
              <div className="text-sm text-gray-600">
                {alumno.alumno_ref} - {alumno.alumno_nivel}° - ALU{alumno.alumno_id.toString().padStart(3, '0')}
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
