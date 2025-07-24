'use client';

import React, { useState } from 'react';
import { 
  Search,
  ShoppingCart,
  Package
} from 'lucide-react';
import StudentSearch from './components/EmployeeSearch';
import ConceptSelector from './components/ConceptSelector';
import OrderTable from './components/OrderTable';
import PaymentCalculator from './components/PaymentCalculator';

// Tipos para el sistema POS
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  totalCost: number;
  category?: 'desayuno' | 'alimentario' | 'estancia' | 'servicio';
}

export default function Home() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const addToOrder = (item: OrderItem) => {
    setOrderItems(prevItems => {
      const existingItem = prevItems.find(i => i.id === item.id);
      if (existingItem) {
        return prevItems.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + 1, totalCost: (i.quantity + 1) * i.price }
            : i
        );
      }
      return [...prevItems, { ...item, quantity: 1, totalCost: item.price }];
    });
  };

  const removeFromOrder = (id: string) => {
    setOrderItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const updateOrderItem = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromOrder(id);
      return;
    }
    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, quantity, totalCost: quantity * item.price }
          : item
      )
    );
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const getTotalItems = () => {
    return orderItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
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
            <a href="#" className="pos-nav-item">Órdenes</a>
          </nav>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="pos-main">
        {/* Columna izquierda */}
        <div className="pos-left">
          {/* Sección de alumno */}
          <div className="employee-section">
            <div className="employee-header">Alumno</div>
            <StudentSearch />
          </div>

          {/* Sección de productos */}
          <div className="pos-card products-section">
            <div className="pos-card-header">Productos</div>
            <ConceptSelector onAddConcept={addToOrder} />
          </div>
        </div>

        {/* Columna derecha - Carrito */}
        <div className="pos-right">
          <div className="cart-section">
            <div className="cart-header">
              <span>Carrito</span>
              {getTotalItems() > 0 && (
                <span style={{
                  background: '#10b981',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {getTotalItems()}
                </span>
              )}
            </div>

            {/* Items del carrito */}
            <div className="cart-items">
              {orderItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🛒</div>
                  <p>No hay productos en el carrito</p>
                </div>
              ) : (
                orderItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(item.id, parseInt(e.target.value) || 0)}
                        className="cart-item-quantity"
                        min="0"
                      />
                    </div>
                    <div className="cart-item-price">
                      ${item.totalCost.toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeFromOrder(item.id)}
                      className="cart-item-remove"
                      title="Eliminar producto"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Métodos de pago */}
            <div className="payment-methods">
              <div className="payment-methods-label">Método de Pago</div>
              <PaymentCalculator orderTotal={calculateTotal()} />
            </div>

            {/* Totales */}
            <div className="cart-totals">
              <div className="cart-total-row">
                <span>Subtotal:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
              <div className="cart-total-row main">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Botón de procesar orden */}
            <button 
              className="order-btn"
              disabled={orderItems.length === 0}
              onClick={() => {
                if (orderItems.length > 0) {
                  alert(`Orden procesada: $${calculateTotal().toFixed(2)}`);
                  setOrderItems([]);
                }
              }}
            >
              Procesar Orden
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
