'use client';

import { useState } from 'react';

interface Employee {
  id: string;
  name: string;
  code: string;
}

// Mock data - reemplazaremos con Supabase más tarde
const mockEmployees: Employee[] = [
  { id: '1', name: 'DEL ANGEL GONZALEZ DANIEL', code: '11918' },
  { id: '2', name: 'GUZMAN CRUZ EVAN SANTIAGO', code: '11919' },
  { id: '3', name: 'NOREÑA RAMIREZ MATEO', code: '11920' },
  { id: '4', name: 'MARQUEZ PADRON EDUARDO EMANUEL', code: '11921' },
  { id: '5', name: 'MAR CESPEDES RAUL', code: '11922' },
  { id: '6', name: 'PEREZ RIVERA MARIA FERNANDA', code: '11923' },
];

export default function EmployeeSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredEmployees = mockEmployees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.code.includes(searchTerm)
  );

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSearchTerm(employee.name);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-600 mb-4">Búsqueda</h2>
      
      {/* Employee Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Buscar empleado..."
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
        />
        
        {/* Dropdown with filtered employees */}
        {showDropdown && searchTerm && filteredEmployees.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredEmployees.slice(0, 5).map((employee) => (
              <button
                key={employee.id}
                onClick={() => handleSelectEmployee(employee)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">{employee.name}</div>
                <div className="text-sm text-gray-500">Código: {employee.code}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Employee Code Input */}
      <div>
        <input
          type="text"
          value={selectedEmployee?.code || ''}
          onChange={(e) => {
            const code = e.target.value;
            const employee = mockEmployees.find(emp => emp.code === code);
            if (employee) {
              setSelectedEmployee(employee);
              setSearchTerm(employee.name);
            }
          }}
          placeholder="Código del empleado"
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
        />
      </div>

      {/* Selected Employee Display */}
      {selectedEmployee && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Empleado seleccionado:</p>
          <p className="font-bold text-green-800">{selectedEmployee.name}</p>
          <p className="text-sm text-green-600">Código: {selectedEmployee.code}</p>
        </div>
      )}
    </div>
  );
} 