'use client';

import React, { useState, useEffect } from 'react';

interface PaymentCalculatorProps {
  orderTotal: number;
}

export default function PaymentCalculator({ orderTotal }: PaymentCalculatorProps) {
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [change, setChange] = useState<number>(0);

  // Calcular cambio cuando cambie el monto pagado o el total
  useEffect(() => {
    const calculatedChange = amountPaid - orderTotal;
    setChange(calculatedChange >= 0 ? calculatedChange : 0);
  }, [amountPaid, orderTotal]);

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmountPaid(numValue);
  };

  const handleQuickAmount = (amount: number) => {
    setAmountPaid(amount);
  };

  return (
    <div className="payment-calculator">
      {/* Calculadora de cambio */}
      <div className="change-calculator">
        <div className="total-section">
          <div className="total-label">Total:</div>
          <div className="total-amount">${orderTotal.toFixed(2)}</div>
        </div>

        <div className="payment-section">
          <div className="payment-input-group">
            <label htmlFor="amount-paid">Monto Pagado:</label>
            <div className="input-with-icon">
              <span className="currency-symbol">$</span>
              <input
                id="amount-paid"
                type="number"
                step="0.01"
                value={amountPaid || ''}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="payment-input"
              />
            </div>
          </div>

          {/* Botones de montos rápidos */}
          <div className="quick-amounts">
            <button 
              onClick={() => handleQuickAmount(orderTotal)}
              className="quick-amount-btn"
            >
              Total
            </button>
            <button 
              onClick={() => handleQuickAmount(orderTotal + 50)}
              className="quick-amount-btn"
            >
              +$50
            </button>
            <button 
              onClick={() => handleQuickAmount(orderTotal + 100)}
              className="quick-amount-btn"
            >
              +$100
            </button>
            <button 
              onClick={() => handleQuickAmount(orderTotal + 200)}
              className="quick-amount-btn"
            >
              +$200
            </button>
          </div>
        </div>

        {/* Cambio */}
        <div className="change-section">
          <div className="change-label">Cambio:</div>
          <div className={`change-amount ${change > 0 ? 'positive' : 'zero'}`}>
            ${change.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
} 