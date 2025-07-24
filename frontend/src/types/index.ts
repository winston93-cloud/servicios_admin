// Employee types
export interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// Product types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order types
export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  employeeId: string;
  employee: Employee;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// Cart types (for frontend state)
export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Store types (for Zustand)
export interface POSStore {
  // Employee state
  selectedEmployee: Employee | null;
  employees: Employee[];
  
  // Product state
  products: Product[];
  categories: string[];
  
  // Cart state
  cart: CartItem[];
  
  // UI state
  isLoading: boolean;
  searchQuery: string;
  selectedCategory: string;
  
  // Actions
  setSelectedEmployee: (employee: Employee | null) => void;
  setEmployees: (employees: Employee[]) => void;
  setProducts: (products: Product[]) => void;
  setCategories: (categories: string[]) => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
} 