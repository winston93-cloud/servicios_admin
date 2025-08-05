'use client';

import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { searchProductos, ProductoSearchResult, getAllProductos } from '@/lib/productoService';

interface ProductoSearchProps {
  onProductSelect: (product: ProductoSearchResult) => void;
}

export interface ProductoSearchRef {
  focusInput: () => void;
}

const ProductoSearch = forwardRef<ProductoSearchRef, ProductoSearchProps>(({ onProductSelect }, ref) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducto, setSelectedProducto] = useState<ProductoSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<ProductoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [allProductos, setAllProductos] = useState<ProductoSearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Exponer métodos al componente padre
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }));

  // Function to search products with debounce
  const debouncedSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 1) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await searchProductos(query);
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching productos:', err);
        setError('Error al buscar productos');
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
      // Maintain focus on the input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    []
  );

  const handleSelectProducto = useCallback((producto: ProductoSearchResult) => {
    // Add quantity to the product
    const productWithQuantity = { ...producto, quantity: 1 };
    
    // Call the parent function to add to table
    onProductSelect(productWithQuantity);
    
    // Clear the search
    setSelectedProducto(null);
    setSearchTerm('');
    setSearchResults([]);
    setHighlightedIndex(-1);
    
    // Maintain focus on the input after selecting
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, [onProductSelect]);

  // Effect to handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, debouncedSearch]);

  // Effect to auto-select product when exact match is found
  useEffect(() => {
    if (searchResults.length === 1 && searchTerm.length >= 2) {
      const result = searchResults[0];
      const searchUpper = searchTerm.toUpperCase();
      
      // Check if it's an exact match for a code (DC, DG, C, M, E5, E7, T5, T7, EM5, EM7)
      const isExactCodeMatch = result.desayuno_abreviatura && 
        result.desayuno_abreviatura.toUpperCase() === searchUpper;
      
      if (isExactCodeMatch) {
        // Auto-select the product
        handleSelectProducto(result);
      }
    }
  }, [searchResults, searchTerm, handleSelectProducto]);

  // Effect to load all products for tooltips
  useEffect(() => {
    const loadProductos = async () => {
      try {
        const productos = await getAllProductos();
        setAllProductos(productos);
      } catch (err) {
        console.error('Error loading productos for tooltips:', err);
      }
    };
    
    loadProductos();
  }, []);

  // Effect to maintain focus on the input
  useEffect(() => {
    if (inputRef.current && searchTerm.length >= 1) {
      inputRef.current.focus();
    }
  }, [searchResults, isLoading, searchTerm.length]);

  // Effect to focus the input on component load
  // Removed to let AlumnoSearch have priority
  // useEffect(() => {
  //   if (inputRef.current) {
  //     inputRef.current.focus();
  //   }
  // }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setHighlightedIndex(-1); // Reset highlighted index when typing
    if (!value.trim()) {
      setSelectedProducto(null);
      setSearchResults([]);
    }
    // Maintain focus on the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputClick = () => {
    // Clear the input when clicked
    setSearchTerm('');
    setSelectedProducto(null);
    setSearchResults([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        // If there's exactly one result, select it automatically
        if (searchResults.length === 1) {
          handleSelectProducto(searchResults[0]);
        } else if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleSelectProducto(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchResults([]);
        setHighlightedIndex(-1);
        break;
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0]?.substring(0, 2).toUpperCase() || '';
  };

  const getTooltipForCode = (code: string): string => {
    const producto = allProductos.find(p => 
      p.desayuno_abreviatura && p.desayuno_abreviatura.toUpperCase() === code.toUpperCase()
    );
    return producto ? producto.desayuno_nombre : code;
  };

  return (
    <div className="relative">
      {/* Search input field */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar producto... (DC, DG, C, M, E5, E7, T5, T7, EM5, EM7)"
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        onClick={handleInputClick}
        onKeyDown={handleKeyDown}
        className="producto-search-input"
        disabled={isLoading}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-indicator">
          <p>Buscando...</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Search results list */}
      {searchTerm && !selectedProducto && searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((producto, index) => (
            <div
              key={producto.id}
              className={`producto-card ${index === highlightedIndex ? 'highlighted' : ''}`}
              onClick={() => handleSelectProducto(producto)}
            >
              <div className="producto-avatar">
                {getInitials(producto.display_name)}
              </div>
              <div className="producto-info">
                <div className="producto-name">{producto.display_name}</div>
                <div className="producto-details">
                  {producto.desayuno_abreviatura} - ${producto.costo.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}



      {/* No results message */}
      {searchTerm && !selectedProducto && !isLoading && searchResults.length === 0 && !error && (
        <div className="empty-state">
          <p>No se encontró el producto</p>
        </div>
      )}

      {/* Códigos de ayuda cuando no hay búsqueda */}
      {!searchTerm && !selectedProducto && (
        <div className="search-help">
          <div className="help-title">Códigos rápidos:</div>
          <div className="help-codes">
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('DC')}
              title={getTooltipForCode('DC')}
            >DC</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('DG')}
              title={getTooltipForCode('DG')}
            >DG</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('C')}
              title={getTooltipForCode('C')}
            >C</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('M')}
              title={getTooltipForCode('M')}
            >M</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('E5')}
              title={getTooltipForCode('E5')}
            >E5</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('E7')}
              title={getTooltipForCode('E7')}
            >E7</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('T5')}
              title={getTooltipForCode('T5')}
            >T5</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('T7')}
              title={getTooltipForCode('T7')}
            >T7</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('EM5')}
              title={getTooltipForCode('EM5')}
            >EM5</span>
            <span 
              className="help-code" 
              onClick={() => handleSearchChange('EM7')}
              title={getTooltipForCode('EM7')}
            >EM7</span>
          </div>
        </div>
      )}
    </div>
  );
});

ProductoSearch.displayName = 'ProductoSearch';

export default ProductoSearch;