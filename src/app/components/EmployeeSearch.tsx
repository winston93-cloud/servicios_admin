'use client';

import React, { useState, useMemo } from 'react';

interface Student {
  id: string;
  name: string;
  group: string;
  grade: string;
}

// Datos de alumnos simulados
const mockStudents: Student[] = [
  {
    id: 'ALU001',
    name: 'HERNANDEZ OSTOS LEONARDO',
    group: 'DG',
    grade: '3°A'
  },
  {
    id: 'ALU002',
    name: 'GARCIA MARTINEZ SOFIA',
    group: 'ADMIN',
    grade: '2°B'
  },
  {
    id: 'ALU003',
    name: 'RODRIGUEZ LOPEZ CARLOS',
    group: 'IT',
    grade: '1°C'
  },
  {
    id: 'ALU004',
    name: 'MARTINEZ GONZALEZ ANA',
    group: 'RRHH',
    grade: '3°B'
  },
];

export default function StudentSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Filtrar alumnos basado en el término de búsqueda
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    return mockStudents.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.group.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchTerm(student.name);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (!value.trim()) {
      setSelectedStudent(null);
    }
  };

  return (
    <div>
      {/* Campo de búsqueda */}
      <input
        type="text"
        placeholder="Buscar alumno..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="employee-search-input"
      />

      {/* Lista de alumnos filtrados */}
      {searchTerm && !selectedStudent && filteredStudents.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          {filteredStudents.map(student => (
            <div
              key={student.id}
              className="employee-card"
              onClick={() => handleSelectStudent(student)}
            >
              <div className="employee-avatar">
                {student.name.split(' ')[0][0]}{student.name.split(' ')[1]?.[0]}
              </div>
              <div className="employee-info">
                <div className="employee-name">{student.name}</div>
                <div className="employee-id">{student.group} - {student.grade} - {student.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alumno seleccionado */}
      {selectedStudent && (
        <div className="employee-card selected" style={{ marginTop: '12px' }}>
          <div className="employee-avatar">
            {selectedStudent.name.split(' ')[0][0]}{selectedStudent.name.split(' ')[1]?.[0]}
          </div>
          <div className="employee-info">
            <div className="employee-name">{selectedStudent.name}</div>
            <div className="employee-id">{selectedStudent.group} - {selectedStudent.grade} - {selectedStudent.id}</div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {searchTerm && !selectedStudent && filteredStudents.length === 0 && (
        <div className="empty-state">
          <p>No se encontró el alumno</p>
        </div>
      )}
    </div>
  );
} 