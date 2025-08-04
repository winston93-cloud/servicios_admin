'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchProductos, ProductoSearchResult } from '@/lib/productoService';

interface ProductoSearchProps {
  onProductSelect: (product: ProductoSearchResult) => void;
}

export default function ProductoSearch({ onProductSelect }: ProductoSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducto, setSelectedProducto] = useState<ProductoSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<ProductoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Effect to handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, debouncedSearch]);

  // Effect to maintain focus on the input
  useEffect(() => {
    if (inputRef.current && searchTerm.length >= 1) {
      inputRef.current.focus();
    }
  }, [searchResults, isLoading]);

  // Effect to focus the input on component load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSelectProducto = (producto: ProductoSearchResult) => {
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
  };

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
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
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

  return (
    <div className="relative">
      {/* Search input field */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar producto..."
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
    </div>
  );
} 