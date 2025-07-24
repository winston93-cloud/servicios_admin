import express from 'express';
import { mockEmployees } from '../data/mockData';
import { Employee, SearchEmployeeParams, ApiResponse } from '../types';

const router = express.Router();

// GET /api/employees - Get all employees with optional search
router.get('/', (req, res) => {
  try {
    const { query, department, status } = req.query as SearchEmployeeParams;
    
    let filteredEmployees = [...mockEmployees];

    // Filter by search query (name)
    if (query) {
      const searchTerm = query.toLowerCase();
      filteredEmployees = filteredEmployees.filter(employee =>
        employee.name.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by department
    if (department) {
      filteredEmployees = filteredEmployees.filter(employee =>
        employee.department === department
      );
    }

    // Filter by status
    if (status) {
      filteredEmployees = filteredEmployees.filter(employee =>
        employee.status === status
      );
    }

    const response: ApiResponse<Employee[]> = {
      success: true,
      data: filteredEmployees,
      message: `Found ${filteredEmployees.length} employees`
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Employee[]> = {
      success: false,
      error: 'Error fetching employees'
    };
    res.status(500).json(response);
  }
});

// GET /api/employees/:id - Get employee by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const employee = mockEmployees.find(emp => emp.id === id);

    if (!employee) {
      const response: ApiResponse<Employee> = {
        success: false,
        error: 'Employee not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Employee> = {
      success: true,
      data: employee
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Employee> = {
      success: false,
      error: 'Error fetching employee'
    };
    res.status(500).json(response);
  }
});

// GET /api/employees/departments - Get available departments
router.get('/meta/departments', (req, res) => {
  try {
    const departments = [...new Set(mockEmployees.map(emp => emp.department))];
    
    const response: ApiResponse<string[]> = {
      success: true,
      data: departments
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<string[]> = {
      success: false,
      error: 'Error fetching departments'
    };
    res.status(500).json(response);
  }
});

export default router; 