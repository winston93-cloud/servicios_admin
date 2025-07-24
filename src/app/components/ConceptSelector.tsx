'use client';

import { useState } from 'react';

interface Concept {
  id: string;
  name: string;
  price: number;
  category: string;
}

// Mock data - conceptos basados en el sistema original
const mockConcepts: Concept[] = [
  { id: 'dch', name: 'DCH', price: 0, category: 'general' },
  { id: 'dg', name: 'DG', price: 0, category: 'general' },
  { id: 'comida', name: 'COMIDA', price: 0, category: 'alimentos' },
  { id: 'media', name: 'MEDIA', price: 0, category: 'alimentos' },
  { id: 'estancia5', name: 'ESTANCIA 5', price: 112.00, category: 'estancias' },
  { id: 'estancia7', name: 'ESTANCIA 7', price: 119.00, category: 'estancias' },
  { id: 'tarea5', name: 'TAREA 5', price: 0, category: 'tareas' },
  { id: 'tarea7', name: 'TAREA 7', price: 0, category: 'tareas' },
  { id: 'estmes5', name: 'EST. MES 5', price: 119.00, category: 'mensual' },
  { id: 'estmes7', name: 'EST. MES 7', price: 119.00, category: 'mensual' },
  { id: 'desayuno_ch', name: 'Desayuno CH', price: 51.00, category: 'alimentos' },
];

interface ConceptSelectorProps {
  onAddConcept?: (concept: Concept, quantity: number) => void;
}

export default function ConceptSelector({ onAddConcept }: ConceptSelectorProps) {
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAddConcept = () => {
    if (selectedConcept && onAddConcept) {
      onAddConcept(selectedConcept, quantity);
      setQuantity(1);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-600 mb-4">Concepto</h2>
      
      {/* Concept Selector */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full px-4 py-3 bg-yellow-400 border-2 border-yellow-500 rounded-lg focus:outline-none focus:border-yellow-600 text-left font-medium flex justify-between items-center"
        >
          {selectedConcept ? selectedConcept.name : 'Seleccionar concepto'}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {mockConcepts.map((concept) => (
              <button
                key={concept.id}
                onClick={() => {
                  setSelectedConcept(concept);
                  setShowDropdown(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-gray-900">{concept.name}</div>
                  <div className="text-sm text-gray-500 capitalize">{concept.category}</div>
                </div>
                {concept.price > 0 && (
                  <div className="text-green-600 font-medium">
                    ${concept.price.toFixed(2)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quantity and Add Section */}
      {selectedConcept && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={selectedConcept.name}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Costo
              </label>
              <input
                type="text"
                value={`$${selectedConcept.price.toFixed(2)}`}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
              />
            </div>
          </div>

          <button
            onClick={handleAddConcept}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            + Agregar al pedido
          </button>
        </div>
      )}
    </div>
  );
} 