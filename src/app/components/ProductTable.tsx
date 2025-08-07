'use client';

import React, { useState, useEffect } from 'react';
import { ProductoSearchResult } from '@/lib/productoService';
import DatePicker from './DatePicker';


interface ProductTableProps {
  selectedProducts: ProductoSearchResult[];
  onRemoveProduct: (id: number) => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onAddProduct?: (product: ProductoSearchResult) => void;
  onTotalChange?: (total: number) => void;
  onProductsChange?: (products: ProductWithDate[]) => void;
  onFocusProductInput?: () => void;
}

interface ProductWithDate extends ProductoSearchResult {
  date?: Date;
  uniqueId?: string; // Para identificar partidas duplicadas
}

export default function ProductTable({ selectedProducts, onRemoveProduct, onUpdateQuantity, onTotalChange, onProductsChange, onFocusProductInput }: ProductTableProps) {
  const [productsWithDates, setProductsWithDates] = useState<ProductWithDate[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedProductForDate, setSelectedProductForDate] = useState<number | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [currentProductForMultiSelect, setCurrentProductForMultiSelect] = useState<ProductWithDate | null>(null);
  const [hasFirstSelection, setHasFirstSelection] = useState(false);

  // Sincronizar productos cuando cambian
  useEffect(() => {
    setProductsWithDates(prevProducts => {
      // Mantener productos duplicados existentes (con uniqueId)
      const existingDuplicates = prevProducts.filter(p => p.uniqueId);
      
      // Agregar productos nuevos del padre
      const newProducts = selectedProducts.map(selectedProduct => {
        // Buscar si el producto ya existe con una fecha personalizada
        const existingProduct = prevProducts.find(p => p.id === selectedProduct.id && !p.uniqueId);
        
        return {
          ...selectedProduct,
          date: existingProduct?.date || new Date(),
          uniqueId: existingProduct?.uniqueId
        };
      });
      
      // Combinar productos nuevos con duplicados existentes y ordenar por fecha
      const allProducts = [...newProducts, ...existingDuplicates];
      return allProducts.sort((a, b) => {
        const dateA = a.date || new Date();
        const dateB = b.date || new Date();
        return dateA.getTime() - dateB.getTime();
      });
    });
  }, [selectedProducts]);

  // Calcular y notificar el total cuando cambien los productos
  useEffect(() => {
    const total = productsWithDates.reduce((sum, product) => {
      return sum + (product.costo * (product.quantity || 1));
    }, 0);
    
    if (onTotalChange) {
      onTotalChange(total);
    }
    
    // Notificar sobre todos los productos en la tabla
    if (onProductsChange) {
      onProductsChange(productsWithDates);
    }
  }, [productsWithDates, onTotalChange, onProductsChange]);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateClick = (productId: number) => {
    setSelectedProductForDate(productId);
    setMultiSelectMode(true);
    setCurrentProductForMultiSelect(productsWithDates.find(p => p.id === productId) || null);
    setHasFirstSelection(false); // Reset para nueva partida
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

  const handleMultiDateChange = (dates: Date[]) => {
    if (currentProductForMultiSelect && dates.length > 0) {
      const newDate = dates[0]; // Solo procesar la primera fecha
      
      if (!hasFirstSelection) {
        // Primera selección: solo actualizar la partida actual
        setProductsWithDates(prev => 
          prev.map(product => 
            (product.id === currentProductForMultiSelect.id && product.uniqueId === currentProductForMultiSelect.uniqueId) ||
            (product.id === currentProductForMultiSelect.id && !product.uniqueId && !currentProductForMultiSelect.uniqueId)
              ? { ...product, date: newDate }
              : product
          )
        );
        setHasFirstSelection(true);
      } else {
        // Segunda selección en adelante: crear nueva partida
        const newProduct: ProductWithDate = {
          ...currentProductForMultiSelect,
          quantity: currentProductForMultiSelect.quantity || 1,
          date: newDate,
          uniqueId: `${currentProductForMultiSelect.id}-${Date.now()}-${Math.random()}`
        };
        
        setProductsWithDates(prev => {
          const updatedProducts = [...prev, newProduct];
          // Ordenar por fecha después de agregar el nuevo producto
          return updatedProducts.sort((a, b) => {
            const dateA = a.date || new Date();
            const dateB = b.date || new Date();
            return dateA.getTime() - dateB.getTime();
          });
        });
      }
    }
  };

  const handleCloseDatePicker = () => {
    setDatePickerOpen(false);
    setSelectedProductForDate(null);
    setMultiSelectMode(false);
    setCurrentProductForMultiSelect(null);
    setHasFirstSelection(false);
    
    // Enfocar el input de productos después de cerrar el calendario
    if (onFocusProductInput) {
      setTimeout(() => {
        onFocusProductInput();
      }, 100);
    }
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
            {productsWithDates
              .sort((a, b) => {
                const dateA = a.date || new Date();
                const dateB = b.date || new Date();
                return dateA.getTime() - dateB.getTime();
              })
              .map((product) => (
              <div key={product.uniqueId || product.id} className="table-row">
                <div className="table-cell">
                  <input
                    type="number"
                    min="1"
                    value={product.quantity || 1}
                    onChange={(e) => {
                      const newQuantity = parseInt(e.target.value) || 1;
                      if (product.uniqueId) {
                        // Si es un producto duplicado, actualizar en la tabla local
                        setProductsWithDates(prev => 
                          prev.map(p => 
                            p.uniqueId === product.uniqueId 
                              ? { ...p, quantity: newQuantity }
                              : p
                          )
                        );
                      } else {
                        // Si es un producto original, usar la función del padre
                        onUpdateQuantity(product.id, newQuantity);
                      }
                    }}
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
                    onClick={() => {
                      if (product.uniqueId) {
                        // Si es un producto duplicado, eliminarlo de la tabla local
                        setProductsWithDates(prev => prev.filter(p => p.uniqueId !== product.uniqueId));
                      } else {
                        // Si es un producto original, usar la función del padre
                        onRemoveProduct(product.id);
                      }
                    }}
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

      {/* DatePicker para selección múltiple de fechas */}
      {datePickerOpen && selectedProductForDate !== null && multiSelectMode && currentProductForMultiSelect && (
        <DatePicker
          selectedDate={new Date()}
          onDateChange={() => {}} // No usado en modo multiSelect
          onClose={handleCloseDatePicker}
          isOpen={datePickerOpen}
          multiSelect={true}
          onMultiDateChange={handleMultiDateChange}
          title="Seleccionar fechas para múltiples partidas"
        />
      )}
      

    </div>
  );
} 