'use client';

import React from 'react';
import { ProductoSearchResult } from '@/lib/productoService';

interface ProductTableProps {
  selectedProducts: ProductoSearchResult[];
  onRemoveProduct: (id: number) => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
}

export default function ProductTable({ selectedProducts, onRemoveProduct, onUpdateQuantity }: ProductTableProps) {
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="product-table-container">
      <h3 className="product-table-title">Productos Seleccionados</h3>
      
      {selectedProducts.length === 0 ? (
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
            {selectedProducts.map((product) => (
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
                <div className="table-cell date">
                  {formatDate(new Date())}
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
      
      {selectedProducts.length > 0 && (
        <div className="table-summary">
          <div className="total-row">
            <span>Total:</span>
            <span className="total-amount">
              ${selectedProducts.reduce((sum, product) => sum + (product.costo * (product.quantity || 1)), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 