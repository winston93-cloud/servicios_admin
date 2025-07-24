import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../../store/usePOSStore';
import { Employee } from '../../types';
import { fetchEmployees } from '../../services/api';
import { Search, User, ChevronDown } from 'lucide-react';

const EmployeeSearch: React.FC = () => {
  const { 
    employees, 
    selectedEmployee, 
    setSelectedEmployee, 
    searchQuery, 
    setSearchQuery 
  } = usePOSStore();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);

  // Filter employees based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.department.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchQuery, employees]);

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSearchQuery(employee.name);
    setIsDropdownOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsDropdownOpen(true);
    
    // Clear selection if input is cleared
    if (!value) {
      setSelectedEmployee(null);
    }
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleInputBlur = () => {
    // Delay closing to allow for clicks on dropdown items
    setTimeout(() => setIsDropdownOpen(false), 200);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Employee Search */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Búsqueda
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ESCRIBE UN NOMBRE..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="input-primary pl-10 pr-10 w-full uppercase placeholder-gray-400"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${
                isDropdownOpen ? 'transform rotate-180' : ''
              }`} />
            </div>
          </div>

          {/* Dropdown */}
          {isDropdownOpen && filteredEmployees.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeSelect(employee)}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900 uppercase">
                    {employee.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {employee.department} - {employee.position}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Concept/Department */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Concepto
          </label>
          <select 
            value={selectedEmployee?.department || ''}
            disabled
            className="input-primary w-full bg-gray-50 text-gray-600"
          >
            <option value="">{selectedEmployee ? selectedEmployee.department : 'DCH'}</option>
          </select>
        </div>
      </div>

      {/* Selected Employee Info */}
      {selectedEmployee && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-blue-900">
                {selectedEmployee.name}
              </h3>
              <p className="text-sm text-blue-700">
                {selectedEmployee.position} - {selectedEmployee.department}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSearch; 