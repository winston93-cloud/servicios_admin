'use client';

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

interface Concept {
  id: string;
  name: string;
  price: number;
  category: 'desayuno' | 'bebida' | 'alimento' | 'restaurante';
  available: boolean;
}

interface ConceptSelectorProps {
  onAddConcept: (concept: any) => void;
}

// Datos de ejemplo de productos
const mockConcepts: Concept[] = [
  { id: '1', name: 'Desayuno QSF', price: 41.00, category: 'desayuno', available: true },
  { id: '2', name: 'Desayuno Mediavno', price: 41.00, category: 'desayuno', available: true },
  { id: '3', name: 'Desayuno Básico', price: 18.00, category: 'desayuno', available: true },
  { id: '4', name: 'Café Americano', price: 18.00, category: 'bebida', available: true },
  { id: '5', name: 'Jugo Natural', price: 25.00, category: 'bebida', available: true },
  { id: '6', name: 'Sandwich', price: 35.00, category: 'alimento', available: true },
  { id: '7', name: 'Ensalada', price: 28.00, category: 'alimento', available: true },
  { id: '8', name: 'Comida Completa', price: 65.00, category: 'restaurante', available: true },
];

const categories = [
  { id: 'todos', label: 'Todos' },
  { id: 'desayuno', label: 'Desayunos' },
  { id: 'bebida', label: 'Bebidas' },
  { id: 'alimento', label: 'Alimentos' },
  { id: 'restaurante', label: 'Restaurante' },
];

const categoryStyles: Record<string, {bg: string, icon: JSX.Element}> = {
  desayuno: { bg: '#fef9c3', icon: <span role="img" aria-label="Desayuno">🍳</span> },
  bebida: { bg: '#bae6fd', icon: <span role="img" aria-label="Bebida">🥤</span> },
  alimento: { bg: '#bbf7d0', icon: <span role="img" aria-label="Alimento">🥪</span> },
  restaurante: { bg: '#fbcfe8', icon: <span role="img" aria-label="Restaurante">🍽️</span> },
};

export default function ConceptSelector({ onAddConcept }: ConceptSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Filtrar conceptos
  const filteredConcepts = useMemo(() => {
    return mockConcepts.filter(concept => {
      const matchesSearch = concept.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'todos' || concept.category === selectedCategory;
      return matchesSearch && matchesCategory && concept.available;
    });
  }, [searchTerm, selectedCategory]);

  const handleAddConcept = (concept: Concept) => {
    setSelectedItems(prev => new Set(prev.add(concept.id)));
    onAddConcept({
      id: concept.id,
      name: concept.name,
      price: concept.price,
      quantity: 1,
      totalCost: concept.price,
      category: concept.category
    });
    
    // Remover selección después de un breve momento
    setTimeout(() => {
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(concept.id);
        return newSet;
      });
    }, 500);
  };

  return (
    <div>
      {/* Búsqueda */}
      <div className="products-search">
        <Search className="products-search-icon" size={16} />
        <input
          type="text"
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="products-search-input"
        />
      </div>

      {/* Categorías */}
      <div className="products-categories">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      <div className="products-grid">
        {filteredConcepts.map(concept => {
          const style = categoryStyles[concept.category] || { bg: '#f1f5f9', icon: <span>🍽️</span> };
          return (
            <div
              key={concept.id}
              className={`product-card ${selectedItems.has(concept.id) ? 'selected' : ''}`}
              onClick={() => handleAddConcept(concept)}
              style={{ background: style.bg }}
            >
              <div className="product-icon" style={{ background: style.bg, fontSize: 32 }}>
                {style.icon}
              </div>
              <div className="product-name">{concept.name}</div>
              <div className="product-price">${concept.price.toFixed(2)}</div>
              <button className="product-add-btn">+</button>
            </div>
          );
        })}
      </div>

      {/* Estado vacío */}
      {filteredConcepts.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No se encontraron productos</p>
        </div>
      )}
    </div>
  );
} 