'use client';

import React, { useState, useEffect } from 'react';
import { ProductoSearchResult } from '@/lib/productoService';
import DatePicker from './DatePicker';

interface ProductTableProps {
  selectedProducts: ProductoSearchResult[];
  onRemoveProduct: (id: number) => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
}

interface ProductWithDate extends ProductoSearchResult {
  date?: Date;
}

export default function ProductTable({ selectedProducts, onRemoveProduct, onUpdateQuantity }: ProductTableProps) {
  const [productsWithDates, setProductsWithDates] = useState<ProductWithDate[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedProductForDate, setSelectedProductForDate] = useState<number | null>(null);

  // Sincronizar productos cuando cambian
  useEffect(() => {
    setProductsWithDates(prevProducts => {
      const newProducts = selectedProducts.map(selectedProduct => {
        // Buscar si el producto ya existe con una fecha personalizada
        const existingProduct = prevProducts.find(p => p.id === selectedProduct.id);
        
        return {
          ...selectedProduct,
          date: existingProduct?.date || new Date()
        };
      });
      
      return newProducts;
    });
  }, [selectedProducts]);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateClick = (productId: number) => {
    setSelectedProductForDate(productId);
    setDatePickerOpen(true);
  };

  const handleDateChange = (date: Date) => {
    if (selectedProductForDate !== null) {
      setProductsWithDates(prev => 
        prev.map(product => 
          product.id === selectedProductForDate 
            ? { ...product, date } 
            : product
        )
      );
    }
  };

  const handleCloseDatePicker = () => {
    setDatePickerOpen(false);
    setSelectedProductForDate(null);
  };

  return (
    <div className="product-table-container">
      <h3 className="product-table-title">Productos Seleccionados</h3>
      
      {productsWithDates.length === 0 ? (
        <div className="empty-table">
          <p>No hay productos seleccionados</p>
        </div>
      ) : (
        <div className="product-table">
          <div className="table-header">
            <div className="header-cell">Cantidad</div>
            <div className="header-cell">Descripción</div>
            <div className="header-cell">Costo</div>
            <div className="header-cell">Fecha</div>
            <div className="header-cell">Eliminar</div>
          </div>
          
          <div className="table-body">
            {productsWithDates.map((product) => (
              <div key={product.id} className="table-row">
                <div className="table-cell">
                  <input
                    type="number"
                    min="1"
                    value={product.quantity || 1}
                    onChange={(e) => onUpdateQuantity(product.id, parseInt(e.target.value) || 1)}
                    className="quantity-input"
                  />
                </div>
                <div className="table-cell description">
                  {product.desayuno_nombre}
                </div>
                <div className="table-cell cost">
                  ${product.costo.toFixed(2)}
                </div>
                <div className="table-cell date clickable-date" onClick={() => handleDateClick(product.id)}>
                  {formatDate(product.date || new Date())}
                </div>
                <div className="table-cell">
                  <button
                    onClick={() => onRemoveProduct(product.id)}
                    className="remove-btn"
                    title="Eliminar producto"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DatePicker */}
      {datePickerOpen && selectedProductForDate !== null && (
        <DatePicker
          selectedDate={productsWithDates.find(p => p.id === selectedProductForDate)?.date || new Date()}
          onDateChange={handleDateChange}
          onClose={handleCloseDatePicker}
          isOpen={datePickerOpen}
        />
      )}
      
      {productsWithDates.length > 0 && (
        <div className="table-summary">
          <div className="total-row">
            <span>Total:</span>
            <span className="total-amount">
              ${productsWithDates.reduce((sum, product) => sum + (product.costo * (product.quantity || 1)), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 