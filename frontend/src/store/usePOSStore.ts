import { create } from 'zustand';
import { POSStore } from '../types';

export const usePOSStore = create<POSStore>((set) => ({
  // Employee state
  selectedEmployee: null,
  employees: [],
  
  // Product state
  products: [],
  categories: [],
  
  // Cart state
  cart: [],
  
  // UI state
  isLoading: false,
  searchQuery: '',
  selectedCategory: '',
  
  // Actions
  setSelectedEmployee: (employee) => set({ selectedEmployee: employee }),
  
  setEmployees: (employees) => set({ employees }),
  
  setProducts: (products) => set({ products }),
  
  setCategories: (categories) => set({ categories }),
  
  addToCart: (product, quantity = 1) => set((state) => {
    const existingItem = state.cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      return {
        cart: state.cart.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      };
    } else {
      return {
        cart: [...state.cart, {
          productId: product.id,
          product,
          quantity
        }]
      };
    }
  }),
  
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter(item => item.productId !== productId)
  })),
  
  updateCartQuantity: (productId, quantity) => set((state) => {
    if (quantity <= 0) {
      return {
        cart: state.cart.filter(item => item.productId !== productId)
      };
    }
    
    return {
      cart: state.cart.map(item =>
        item.productId === productId
          ? { ...item, quantity }
          : item
      )
    };
  }),
  
  clearCart: () => set({ cart: [] }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setSelectedCategory: (category) => set({ selectedCategory: category }),
})); 