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

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Search types
export interface SearchEmployeeParams {
  query?: string;
  department?: string;
  status?: 'active' | 'inactive';
}

export interface SearchProductParams {
  query?: string;
  category?: string;
  available?: string;
} 