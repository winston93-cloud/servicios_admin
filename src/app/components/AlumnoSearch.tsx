'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchAlumnos, AlumnoSearchResult } from '@/lib/alumnoService';

export default function AlumnoSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlumno, setSelectedAlumno] = useState<AlumnoSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<AlumnoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Función para buscar alumnos con debounce
  const debouncedSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await searchAlumnos(query);
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching alumnos:', err);
        setError('Error al buscar alumnos');
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Efecto para manejar la búsqueda con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, debouncedSearch]);

  // Efecto para mantener el foco en el input
  useEffect(() => {
    if (inputRef.current && searchTerm.length >= 2) {
      inputRef.current.focus();
    }
  }, [searchResults, isLoading]);

  // Efecto para enfocar el input al cargar el componente
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSelectAlumno = (alumno: AlumnoSearchResult) => {
    setSelectedAlumno(alumno);
    setSearchTerm(alumno.display_name);
    setSearchResults([]);
    // Mantener el foco en el input después de seleccionar
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setHighlightedIndex(-1); // Reset highlighted index when typing
    if (!value.trim()) {
      setSelectedAlumno(null);
      setSearchResults([]);
    }
    // Mantener el foco en el input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputClick = () => {
    // Limpiar el input cuando se hace clic
    setSearchTerm('');
    setSelectedAlumno(null);
    setSearchResults([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleSelectAlumno(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchResults([]);
        setHighlightedIndex(-1);
        break;
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0]?.substring(0, 2).toUpperCase() || '';
  };

  return (
    <div className="relative">
      {/* Campo de búsqueda */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar alumno..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        onClick={handleInputClick}
        onKeyDown={handleKeyDown}
        className="employee-search-input"
        disabled={isLoading}
      />

      {/* Indicador de carga */}
      {isLoading && (
        <div className="loading-indicator">
          <p>Buscando...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Lista de resultados de búsqueda */}
      {searchTerm && !selectedAlumno && searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((alumno, index) => (
            <div
              key={alumno.alumno_id}
              className={`employee-card ${index === highlightedIndex ? 'highlighted' : ''}`}
              onClick={() => handleSelectAlumno(alumno)}
            >
              <div className="employee-avatar">
                {getInitials(alumno.display_name)}
              </div>
              <div className="employee-info">
                <div className="employee-name">{alumno.display_name}</div>
                <div className="employee-id">
                  {alumno.alumno_ref} - {alumno.alumno_nivel}° - ALU{alumno.alumno_id.toString().padStart(3, '0')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alumno seleccionado */}
      {selectedAlumno && (
        <div className="employee-card selected" style={{ marginTop: '12px' }}>
          <div className="employee-avatar">
            {getInitials(selectedAlumno.display_name)}
          </div>
          <div className="employee-info">
            <div className="employee-name">{selectedAlumno.display_name}</div>
            <div className="employee-id">
              {selectedAlumno.alumno_ref} - {selectedAlumno.alumno_nivel}° - ALU{selectedAlumno.alumno_id.toString().padStart(3, '0')}
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {searchTerm && !selectedAlumno && !isLoading && searchResults.length === 0 && !error && (
        <div className="empty-state">
          <p>No se encontró el alumno</p>
        </div>
      )}
    </div>
  );
} 