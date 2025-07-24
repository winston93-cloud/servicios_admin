'use client';

import { useState, useEffect } from 'react';

interface PaymentCalculatorProps {
  orderTotal?: number;
}

export default function PaymentCalculator({ orderTotal = 282.00 }: PaymentCalculatorProps) {
  const [cashAmount, setCashAmount] = useState<number>(500);
  const [change, setChange] = useState<number>(0);

  useEffect(() => {
    const calculatedChange = cashAmount - orderTotal;
    setChange(calculatedChange);
  }, [cashAmount, orderTotal]);

  const handleCashChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    setCashAmount(amount);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-600 mb-4">Pago</h2>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Efectivo */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-red-600 mb-3">Efectivo</h3>
          <input
            type="number"
            value={cashAmount}
            onChange={(e) => handleCashChange(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none"
            placeholder="0.00"
          />
        </div>

        {/* Total */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-red-600 mb-3">Total</h3>
          <div className="w-full px-4 py-3 text-2xl font-bold text-center bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-700">
            ${orderTotal.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Cambio */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-red-600 mb-3">Cambio</h3>
        <div 
          className={`w-full px-4 py-3 text-3xl font-bold text-center rounded-lg border-2 ${
            change >= 0 
              ? 'bg-green-100 border-green-300 text-green-800' 
              : 'bg-red-100 border-red-300 text-red-800'
          }`}
        >
          {change >= 0 ? '$' : '-$'}{Math.abs(change).toFixed(2)}
        </div>
        
        {change < 0 && (
          <p className="text-sm text-red-600 mt-2 text-center">
            Faltan ${Math.abs(change).toFixed(2)}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <button
          onClick={() => setCashAmount(orderTotal)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Pago Exacto
        </button>
        
        <button
          disabled={change < 0}
          className={`font-medium py-3 px-4 rounded-lg transition-colors ${
            change >= 0
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Procesar Pago
        </button>
      </div>

      {/* Quick Cash Amounts */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Montos rápidos:</h4>
        <div className="grid grid-cols-4 gap-2">
          {[100, 200, 300, 500, 1000].map((amount) => (
            <button
              key={amount}
              onClick={() => setCashAmount(amount)}
              className={`py-2 px-3 text-sm rounded transition-colors ${
                cashAmount === amount
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Resumen:</h4>
        <div className="text-sm space-y-1 text-gray-600">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${orderTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Efectivo recibido:</span>
            <span>${cashAmount.toFixed(2)}</span>
          </div>
          <hr className="my-2" />
          <div className="flex justify-between font-medium text-gray-800">
            <span>Cambio a entregar:</span>
            <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
              {change >= 0 ? '$' : '-$'}{Math.abs(change).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 