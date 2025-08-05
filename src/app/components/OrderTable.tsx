'use client';

import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Edit3, 
  Package, 
  ShoppingBag, 
  Calculator,
  Minus,
  Plus,
  Check,
  X,
  TrendingUp,
  Clock
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  totalCost: number;
}

interface OrderTableProps {
  items: OrderItem[];
  onRemoveItem: (id: string) => void;
}

// Hook para estadísticas del pedido
const useOrderStats = (items: OrderItem[]) => {
  return useMemo(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
    const averagePrice = totalItems > 0 ? totalCost / totalItems : 0;
    const mostExpensive = items.reduce((max, item) => 
      item.price > max.price ? item : max, items[0] || { price: 0 }
    );
    
    return {
      totalItems,
      totalCost,
      averagePrice,
      mostExpensive: mostExpensive?.name || 'N/A',
      uniqueItems: items.length
    };
  }, [items]);
};

export default function OrderTable({ items, onRemoveItem }: OrderTableProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  const stats = useOrderStats(items);

  const handleEditStart = (item: OrderItem) => {
    setEditingItem(item.id);
    setTempQuantity(item.quantity);
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setTempQuantity(1);
  };

  const handleEditSave = () => {
    // Nota: Aquí actualizaríamos la cantidad si tuviéramos la función
    // Por ahora solo cancelamos la edición
    setEditingItem(null);
    setTempQuantity(1);
  };

  const getCategoryIcon = (itemName: string) => {
    const name = itemName.toLowerCase();
    if (name.includes('desayuno') || name.includes('café')) return '☕';
    if (name.includes('almuerzo') || name.includes('comida')) return '🍽️';
    if (name.includes('estancia')) return '🏠';
    if (name.includes('snack')) return '🥗';
    return '📦';
  };

  const getCategoryColor = (itemName: string) => {
    const name = itemName.toLowerCase();
    if (name.includes('desayuno') || name.includes('café')) return 'text-orange-400';
    if (name.includes('almuerzo') || name.includes('comida')) return 'text-green-400';
    if (name.includes('estancia')) return 'text-blue-400';
    if (name.includes('snack')) return 'text-emerald-400';
    return 'text-gray-400';
  };

  if (items.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-6xl mb-6 animate-float">
          <ShoppingBag className="w-16 h-16 mx-auto text-white/30" />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-4">Pedido Vacío</h3>
        <p className="text-white/70 text-lg mb-6 max-w-md mx-auto">
          Agrega productos desde el selector de conceptos para comenzar tu pedido
        </p>
        
        {/* Tarjetas de estadísticas cuando está vacío */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="glass-card p-4">
            <Package className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-xs text-white/60 uppercase tracking-wider">Productos</div>
          </div>
          <div className="glass-card p-4">
            <Calculator className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">$0.00</div>
            <div className="text-xs text-white/60 uppercase tracking-wider">Total</div>
          </div>
          <div className="glass-card p-4">
            <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-xs text-white/60 uppercase tracking-wider">Items</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas del pedido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
          <Package className="w-6 h-6 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xl font-bold text-white">{stats.uniqueItems}</div>
          <div className="text-xs text-white/60 uppercase tracking-wider">Productos</div>
        </div>
        <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
          <ShoppingBag className="w-6 h-6 text-green-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xl font-bold text-white">{stats.totalItems}</div>
          <div className="text-xs text-white/60 uppercase tracking-wider">Cantidad</div>
        </div>
        <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
          <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xl font-bold text-white">${stats.averagePrice.toFixed(2)}</div>
          <div className="text-xs text-white/60 uppercase tracking-wider">Promedio</div>
        </div>
        <div className="glass-card p-4 text-center group hover:scale-105 transition-transform">
          <Calculator className="w-6 h-6 text-orange-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xl font-bold text-white">${stats.totalCost.toFixed(2)}</div>
          <div className="text-xs text-white/60 uppercase tracking-wider">Total</div>
        </div>
      </div>

      {/* Tabla moderna */}
      <div className="glass-card overflow-hidden">
        {/* Header de la tabla */}
        <div className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Detalles del Pedido</span>
            </h3>
            <span className="text-sm text-white/70">
              {stats.totalItems} {stats.totalItems === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <table className="table-modern w-full">
            <thead>
              <tr>
                <th className="text-left">Producto</th>
                <th className="text-center">Cantidad</th>
                <th className="text-center">Precio Unit.</th>
                <th className="text-center">Total</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr 
                  key={item.id} 
                  className="animate-slide-in group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`text-2xl ${getCategoryColor(item.name)}`}>
                        {getCategoryIcon(item.name)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{item.name}</div>
                        <div className="text-sm text-white/60">
                          ID: {item.id.slice(-8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-center">
                    {editingItem === item.id ? (
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => setTempQuantity(Math.max(1, tempQuantity - 1))}
                          className="btn-modern btn-secondary p-1 text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={tempQuantity}
                          onChange={(e) => setTempQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="input-modern w-16 text-center py-1 text-sm"
                          min="1"
                        />
                        <button
                          onClick={() => setTempQuantity(tempQuantity + 1)}
                          className="btn-modern btn-secondary p-1 text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="px-3 py-1 bg-white/10 rounded-full text-white font-medium">
                        {item.quantity}
                      </span>
                    )}
                  </td>
                  <td className="text-center text-white font-medium">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="text-center">
                    <span className="text-lg font-bold text-green-300">
                      ${item.totalCost.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {editingItem === item.id ? (
                        <>
                          <button
                            onClick={() => handleEditSave(item)}
                            className="btn-modern btn-success p-2 text-xs"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="btn-modern btn-secondary p-2 text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditStart(item)}
                            className="btn-modern btn-secondary p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="btn-modern bg-red-500/20 hover:bg-red-500/30 text-red-300 p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4 p-4">
          {items.map((item, index) => (
            <div 
              key={item.id} 
              className="glass-card p-4 animate-slide-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`text-2xl ${getCategoryColor(item.name)}`}>
                    {getCategoryIcon(item.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white text-sm truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-white/60">ID: {item.id.slice(-8)}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="btn-modern bg-red-500/20 hover:bg-red-500/30 text-red-300 p-2 text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-white/60 mb-1">Cantidad</div>
                  <div className="px-2 py-1 bg-white/10 rounded text-white text-sm font-medium">
                    {item.quantity}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">Precio Unit.</div>
                  <div className="text-white text-sm font-medium">
                    ${item.price.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">Total</div>
                  <div className="text-green-300 text-sm font-bold">
                    ${item.totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer con totales */}
        <div className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 p-4 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="text-white/70 text-sm">
              <span className="font-medium">{stats.uniqueItems}</span> productos únicos • 
              <span className="font-medium"> {stats.totalItems}</span> items totales
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                ${stats.totalCost.toFixed(2)}
              </div>
              <div className="text-xs text-white/60 uppercase tracking-wider">
                Total del Pedido
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      {stats.mostExpensive !== 'N/A' && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">
              Producto más caro: <span className="text-white font-medium">{stats.mostExpensive}</span>
            </span>
            <span className="text-white/70">
              Precio promedio por item: <span className="text-green-300 font-medium">${stats.averagePrice.toFixed(2)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 