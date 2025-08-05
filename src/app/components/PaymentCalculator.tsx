'use client';

import React, { useState } from 'react';

interface PaymentCalculatorProps {
  orderTotal: number;
}

const paymentMethods = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferir', label: 'Transferir' },
];

export default function PaymentCalculator({ orderTotal: _orderTotal }: PaymentCalculatorProps) {
  const [selectedMethod, setSelectedMethod] = useState('efectivo');

  return (
    <div className="payment-methods-grid">
      {paymentMethods.map(method => (
        <button
          key={method.id}
          onClick={() => setSelectedMethod(method.id)}
          className={`payment-method ${selectedMethod === method.id ? 'active' : ''}`}
        >
          {method.label}
        </button>
      ))}
    </div>
  );
} 