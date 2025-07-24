'use client';

import { useState } from 'react';

interface OrderItem {
  id: string;
  quantity: number;
  description: string;
  price: number;
  total: number;
  date: string;
}

interface OrderTableProps {
  items?: OrderItem[];
  onRemoveItem?: (id: string) => void;
}

export default function OrderTable({ items = [], onRemoveItem }: OrderTableProps) {
  // Mock data para mostrar el sistema funcionando
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      id: '1',
      quantity: 1,
      description: 'Desayuno CH',
      price: 51.00,
      total: 51.00,
      date: '2025-07-24'
    },
    {
      id: '2',
      quantity: 1,
      description: 'Estancia 5',
      price: 112.00,
      total: 112.00,
      date: '2025-07-24'
    },
    {
      id: '3',
      quantity: 1,
      description: 'EST. MES 7',
      price: 119.00,
      total: 119.00,
      date: '2025-07-24'
    }
  ]);

  const handleRemoveItem = (id: string) => {
    setOrderItems(items => items.filter(item => item.id !== id));
    if (onRemoveItem) {
      onRemoveItem(id);
    }
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-600 mb-4">Pedido</h2>
      
      {/* Order Table */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-left font-medium">Costo</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-center font-medium">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item, index) => (
              <tr 
                key={item.id} 
                className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}
              >
                <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 font-medium">${item.price.toFixed(2)}</td>
                <td className="px-4 py-3">{item.date}</td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    onChange={() => handleRemoveItem(item.id)}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                  />
                </td>
              </tr>
            ))}
            
            {/* Total Row */}
            <tr className="bg-blue-600 text-white font-bold">
              <td className="px-4 py-3" colSpan={2}>Total</td>
              <td className="px-4 py-3">${calculateTotal().toFixed(2)}</td>
              <td className="px-4 py-3" colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {orderItems.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No hay productos en el pedido</p>
          <p className="text-sm">Selecciona conceptos para agregar</p>
        </div>
      )}
    </div>
  );
} 