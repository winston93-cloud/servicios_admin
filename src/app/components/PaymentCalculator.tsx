'use client';

import React, { useState, useEffect } from 'react';
import { saveVenta, VentaData } from '@/lib/ventaService';
import { ProductoSearchResult } from '@/lib/productoService';
import SuccessModal from './SuccessModal';

interface ProductWithDate extends ProductoSearchResult {
  date?: Date;
  quantity?: number;
}

interface PaymentCalculatorProps {
  orderTotal: number;
  selectedProducts?: ProductWithDate[];
  selectedStudent?: {
    alumno_ref?: string | number;
    id?: string | number;
  } | null;
}

export default function PaymentCalculator({ orderTotal, selectedProducts = [], selectedStudent }: PaymentCalculatorProps) {
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [change, setChange] = useState<number>(0);
  const [amountInputValue, setAmountInputValue] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');



  // Calcular cambio cuando cambie el monto pagado o el total
  useEffect(() => {
    const calculatedChange = amountPaid - orderTotal;
    setChange(calculatedChange >= 0 ? calculatedChange : 0);
  }, [amountPaid, orderTotal]);

  const handleAmountChange = (value: string) => {
    // Verificar si contiene "P" o "p" y hay productos seleccionados
    if ((value.toLowerCase().includes('p') || value.toUpperCase().includes('P')) && 
        selectedProducts && selectedProducts.length > 0 && 
        selectedStudent && amountPaid > 0) {
      // Remover la "P" del valor antes de procesar
      const cleanValue = value.replace(/[Pp]/g, '');
      setAmountInputValue(cleanValue);
      setAmountPaid(parseFloat(cleanValue) || 0);
      saveSale();
      return;
    }
    
    setAmountInputValue(value);
    const numValue = parseFloat(value) || 0;
    setAmountPaid(numValue);
  };



  const saveSale = async () => {
    if (!selectedProducts || selectedProducts.length === 0 || !selectedStudent) {
      setSuccessMessage('Debe seleccionar productos y un estudiante antes de guardar la venta.');
      setShowSuccessModal(true);
      return;
    }

    try {
      // Obtener el ID del estudiante
      const studentId = selectedStudent.alumno_ref || selectedStudent.id || '0';
      
      // Guardar cada producto como un registro separado
      for (const product of selectedProducts) {
        const saleData: VentaData = {
          pago_ref: studentId.toString(),
          pago_descripcion: product.desayuno_nombre || 'Producto',
          pago_costo: product.costo * (product.quantity || 1),
          pago_fecha: product.date ? new Date(product.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          pago_cantidad: product.quantity || 1
        };

        // Guardar en Supabase
        await saveVenta(saleData);
      }
      
      setSuccessMessage(`Venta guardada exitosamente para el estudiante: ${studentId}. Se guardaron ${selectedProducts.length} partidas.`);
      setShowSuccessModal(true);
      
      // Reiniciar la página después de 3 segundos (cuando se cierre el modal)
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Error al guardar la venta:', error);
      setSuccessMessage('Error al guardar la venta. Por favor, intente de nuevo.');
      setShowSuccessModal(true);
    }
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
                type="text"
                value={amountInputValue}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00 (escriba P para guardar)"
                className="payment-input"
              />
            </div>
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
      
      {/* Modal de éxito */}
      <SuccessModal 
        isOpen={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
} 