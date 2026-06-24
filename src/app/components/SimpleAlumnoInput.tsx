'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchAlumnosAndPersonal, CombinedSearchResult } from '@/lib/alumnoService';

interface SimpleAlumnoInputProps {
  onAlumnoSelect: (alumno: CombinedSearchResult) => void;
}

export default function SimpleAlumnoInput({ onAlumnoSelect }: SimpleAlumnoInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CombinedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedAlumno, setSelectedAlumno] = useState<CombinedSearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchResults]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleSelectAlumno(searchResults[selectedIndex]);
        } else if (searchResults.length === 1) {
          handleSelectAlumno(searchResults[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchResults([]);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const searchAlumnosAsync = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchAlumnosAndPersonal(searchTerm);
        setSearchResults(results);
        setIsOpen(results.length > 0);
      } catch (error) {
        console.error('Error buscando alumnos:', error);
        setSearchResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchAlumnosAsync, 150);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const getNivelText = (nivel: number): string => {
    switch (nivel) {
      case 1:
        return 'Maternal';
      case 2:
        return 'Kinder';
      case 3:
        return 'Primaria';
      case 4:
        return 'Secundaria';
      default:
        return nivel === 0 ? 'Maestro' : `Nivel ${nivel}`;
    }
  };

  const getGrupoText = (grupo: string | number): string => {
    if (!grupo || grupo === '') return 'N/A';
    const grupoNum = typeof grupo === 'string' ? parseInt(grupo, 10) : grupo;
    if (Number.isNaN(grupoNum)) return String(grupo);
    switch (grupoNum) {
      case 1:
        return 'A';
      case 2:
        return 'B';
      case 3:
        return 'C';
      default:
        return grupoNum.toString();
    }
  };

  const getGradoText = (grado: string | number, nivel: number): string => {
    if (!grado || grado === '') return 'N/A';
    const gradoNum = typeof grado === 'string' ? parseInt(grado, 10) : grado;
    if (Number.isNaN(gradoNum)) return String(grado);

    if (nivel === 4) {
      switch (gradoNum) {
        case 1:
          return '7mo';
        case 2:
          return '8vo';
        case 3:
          return '9no';
        default:
          return `${gradoNum}°`;
      }
    }
    return `${gradoNum}°`;
  };

  const handleSelectAlumno = (alumno: CombinedSearchResult) => {
    setSearchTerm(alumno.display_name);
    setSelectedAlumno(alumno);
    setSearchResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    onAlumnoSelect(alumno);
    inputRef.current?.blur();
  };

  return (
    <div ref={rootRef} className="alumno-search-root">
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar alumno (nombre, apellido o número de control)..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (selectedAlumno && e.target.value !== selectedAlumno.display_name) {
            setSelectedAlumno(null);
          }
        }}
        onFocus={() => {
          if (searchResults.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`alumno-search-input${selectedAlumno ? ' alumno-search-input--selected' : ''}`}
        autoComplete="off"
      />

      {selectedAlumno && !isOpen && (
        <div className="alumno-search-selected">
          Seleccionado: <strong>{selectedAlumno.display_name}</strong> (ref: {selectedAlumno.alumno_ref})
        </div>
      )}

      {isOpen && searchResults.length > 0 && (
        <div className="alumno-search-dropdown" role="listbox">
          {searchResults.map((alumno, index) => (
            <div
              key={`${alumno.type ?? 'alumno'}-${alumno.alumno_ref}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`alumno-search-option${index === selectedIndex ? ' is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectAlumno(alumno);
              }}
            >
              <div className="alumno-search-option-name">{alumno.display_name}</div>
              <div className="alumno-search-option-meta">
                {alumno.type === 'maestro' ? (
                  <>ID: {alumno.alumno_ref} | Maestro</>
                ) : (
                  <>
                    ID: {alumno.alumno_ref} | {getNivelText(alumno.alumno_nivel)} |{' '}
                    {getGradoText(alumno.alumno_grado || '', alumno.alumno_nivel)} |{' '}
                    {getGrupoText(alumno.alumno_grupo || '')}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="alumno-search-spinner" aria-hidden>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
        </div>
      )}
    </div>
  );
}
