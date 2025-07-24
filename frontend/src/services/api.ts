import axios from 'axios';
import { Employee, Product, Order, ApiResponse } from '../types';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Employee API functions
export const fetchEmployees = async (params?: {
  query?: string;
  department?: string;
  status?: 'active' | 'inactive';
}): Promise<ApiResponse<Employee[]>> => {
  const response = await api.get('/employees', { params });
  return response.data;
};

export const fetchEmployeeById = async (id: string): Promise<ApiResponse<Employee>> => {
  const response = await api.get(`/employees/${id}`);
  return response.data;
};

export const fetchDepartments = async (): Promise<ApiResponse<string[]>> => {
  const response = await api.get('/employees/meta/departments');
  return response.data;
};

// Product API functions
export const fetchProducts = async (params?: {
  query?: string;
  category?: string;
  available?: string;
}): Promise<ApiResponse<Product[]>> => {
  const response = await api.get('/products', { params });
  return response.data;
};

export const fetchProductById = async (id: string): Promise<ApiResponse<Product>> => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};

export const fetchCategories = async (): Promise<ApiResponse<string[]>> => {
  const response = await api.get('/products/meta/categories');
  return response.data;
};

// Order API functions
export const createOrder = async (orderData: {
  employeeId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: 'cash' | 'card' | 'transfer';
}): Promise<ApiResponse<Order>> => {
  const response = await api.post('/orders', orderData);
  return response.data;
};

export const fetchOrders = async (): Promise<ApiResponse<Order[]>> => {
  const response = await api.get('/orders');
  return response.data;
};

export const fetchOrderById = async (id: string): Promise<ApiResponse<Order>> => {
  const response = await api.get(`/orders/${id}`);
  return response.data;
};

export const updateOrderStatus = async (
  id: string,
  status: 'pending' | 'completed' | 'cancelled'
): Promise<ApiResponse<Order>> => {
  const response = await api.patch(`/orders/${id}`, { status });
  return response.data;
};

// Health check
export const healthCheck = async (): Promise<ApiResponse<any>> => {
  const response = await api.get('/health');
  return response.data;
};

export default api; 