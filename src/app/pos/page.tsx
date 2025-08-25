'use client';

import React, { useState, useRef } from 'react';
import { 
  Package,
  LogOut,
  User
} from 'lucide-react';
import SimpleAlumnoInput from '../components/SimpleAlumnoInput';
import ProductoSearch, { ProductoSearchRef } from '../components/ProductoSearch';
import ProductTable from '../components/ProductTable';
import AgendaPostIt from '../components/AgendaPostIt';
import PaymentCalculator from '../components/PaymentCalculator';
import ProductoModal from '../components/ProductoModal';
import PersonalModal from '../components/PersonalModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ProductoSearchResult } from '@/lib/productoService';
import { CombinedSearchResult } from '@/lib/alumnoService';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ProductWithDate extends ProductoSearchResult {
  date?: Date;
  quantity?: number;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedProducts, setSelectedProducts] = useState<ProductoSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{
    alumno_ref?: string | number;
    id?: string | number;
  } | null>(null);
  const [isProductoModalOpen, setIsProductoModalOpen] = useState(false);
  const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const productoInputRef = useRef<ProductoSearchRef>(null);

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

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

  const handleAlumnoSelect = (alumno: CombinedSearchResult) => {
    setSelectedStudent({
      alumno_ref: alumno.alumno_ref,
      id: alumno.alumno_id
    });
    // Enfocar el input de productos después de seleccionar un alumno
    setTimeout(() => {
      if (productoInputRef.current) {
        productoInputRef.current.focusInput();
      }
    }, 100);
  };

  // Calcular el total de la orden (esto será actualizado por ProductTable)
  const [orderTotal, setOrderTotal] = useState(0);
  const [allProductsInTable, setAllProductsInTable] = useState<ProductWithDate[]>([]);

  return (
    <ProtectedRoute>
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
              <button 
                onClick={() => setIsPersonalModalOpen(true)}
                className="pos-nav-item"
              >
                Externos
              </button>
              <button className="pos-nav-item">
                Reportes
              </button>
            </nav>
            {/* Usuario logueado y logout */}
            <div className="pos-user-section">
              <div className="pos-user-info">
                <User className="w-4 h-4" />
                <span className="pos-user-name">{user?.usuario_nombre_completo}</span>
              </div>
              <button 
                onClick={handleBackToDashboard}
                className="pos-logout-btn"
                title="Volver al Dashboard"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

      {/* Contenido principal */}
      <main className="pos-main">
        {/* Contenido centrado */}
        <div className="pos-content">
          {/* Contenedor de búsquedas y calculadora */}
          <div className="search-and-calculator-container">
            {/* Sección de búsquedas */}
            <div className="search-section">
              <div className="search-header">Búsquedas</div>
              <div className="search-inputs-container">
                <div className="search-input-group">
                  <label className="search-label">Alumno</label>
                  <SimpleAlumnoInput onAlumnoSelect={handleAlumnoSelect} />
                </div>
                <div className="search-input-group">
                  <label className="search-label">Producto</label>
                  <ProductoSearch 
                    ref={productoInputRef}
                    onProductSelect={handleProductSelect}
                    refreshTrigger={refreshTrigger}
                  />
                </div>
              </div>
            </div>

            {/* Calculadora de pago */}
            <PaymentCalculator 
              orderTotal={orderTotal} 
              selectedProducts={allProductsInTable}
              selectedStudent={selectedStudent}
            />
            <AgendaPostIt products={allProductsInTable} topOffsetPx={280} />
          </div>

          {/* Tabla de productos seleccionados */}
          <ProductTable 
            selectedProducts={selectedProducts}
            onRemoveProduct={handleRemoveProduct}
            onUpdateQuantity={handleUpdateQuantity}
            onAddProduct={handleProductSelect}
            onTotalChange={setOrderTotal}
            onProductsChange={setAllProductsInTable}
            onFocusProductInput={() => {
              if (productoInputRef.current) {
                productoInputRef.current.focusInput();
              }
            }}
          />
        </div>
      </main>

      {/* Modal de Productos */}
      <ProductoModal 
        isOpen={isProductoModalOpen}
        onClose={() => {
          setIsProductoModalOpen(false);
          // Incrementar el trigger para recargar productos
          setRefreshTrigger(prev => prev + 1);
        }}
      />

        {/* Modal de Personal */}
        <PersonalModal 
          isOpen={isPersonalModalOpen}
          onClose={() => setIsPersonalModalOpen(false)}
        />
      </div>
    </ProtectedRoute>
  );
}
