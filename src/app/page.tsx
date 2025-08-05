'use client';

import React, { useState, useRef } from 'react';
import { 
  Package
} from 'lucide-react';
import AlumnoSearch from './components/AlumnoSearch';
import ProductoSearch, { ProductoSearchRef } from './components/ProductoSearch';
import ProductTable from './components/ProductTable';
import ProductoModal from './components/ProductoModal';
import { ProductoSearchResult } from '@/lib/productoService';

export default function Home() {
  const [selectedProducts, setSelectedProducts] = useState<ProductoSearchResult[]>([]);
  const [isProductoModalOpen, setIsProductoModalOpen] = useState(false);
  const productoInputRef = useRef<ProductoSearchRef>(null);

  const handleProductSelect = (product: ProductoSearchResult) => {
    // Check if product already exists in the table
    const existingProduct = selectedProducts.find(p => p.id === product.id);
    if (existingProduct) {
      // Update quantity if product already exists
      setSelectedProducts(prev => 
        prev.map(p => 
          p.id === product.id 
            ? { ...p, quantity: (p.quantity || 1) + 1 }
            : p
        )
      );
    } else {
      // Add new product
      setSelectedProducts(prev => [...prev, product]);
    }
  };

  const handleRemoveProduct = (id: number) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveProduct(id);
      return;
    }
    setSelectedProducts(prev => 
      prev.map(p => p.id === id ? { ...p, quantity } : p)
    );
  };

  const handleAlumnoSelect = (_alumno: unknown) => {
    // Enfocar el input de productos después de seleccionar un alumno
    setTimeout(() => {
      if (productoInputRef.current) {
        productoInputRef.current.focusInput();
      }
    }, 100);
  };

  return (
    <div>
      {/* Header POS */}
      <header className="pos-header">
        <div className="pos-header-content">
          <div className="pos-logo">
            <Package />
            Desayunos POS
          </div>
          <nav className="pos-nav">
            <a href="#" className="pos-nav-item active">Punto de venta</a>
            <button 
              onClick={() => setIsProductoModalOpen(true)}
              className="pos-nav-item"
            >
              Productos
            </button>
          </nav>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="pos-main">
        {/* Contenido centrado */}
        <div className="pos-content">
          {/* Sección de búsquedas */}
          <div className="search-section">
            <div className="search-header">Búsquedas</div>
            <div className="search-inputs-container">
              <div className="search-input-group">
                <label className="search-label">Alumno</label>
                <AlumnoSearch onAlumnoSelect={handleAlumnoSelect} />
              </div>
              <div className="search-input-group">
                <label className="search-label">Producto</label>
                <ProductoSearch 
                  ref={productoInputRef}
                  onProductSelect={handleProductSelect} 
                />
              </div>
            </div>
          </div>

          {/* Tabla de productos seleccionados */}
          <ProductTable 
            selectedProducts={selectedProducts}
            onRemoveProduct={handleRemoveProduct}
            onUpdateQuantity={handleUpdateQuantity}
          />
        </div>
      </main>

      {/* Modal de Productos */}
      <ProductoModal 
        isOpen={isProductoModalOpen}
        onClose={() => setIsProductoModalOpen(false)}
      />
    </div>
  );
}
