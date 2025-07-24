import React, { useState, useMemo } from 'react';
import { usePOSStore } from '../../store/usePOSStore';
import { createOrder } from '../../services/api';
import { Trash2, Plus, Minus, CreditCard, DollarSign, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

const ShoppingCart: React.FC = () => {
  const {
    cart,
    selectedEmployee,
    updateCartQuantity,
    removeFromCart,
    clearCart
  } = usePOSStore();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);

  const total = subtotal; // You can add taxes, discounts, etc. here

  const change = useMemo(() => {
    if (paymentMethod === 'cash' && cashAmount) {
      const cash = parseFloat(cashAmount);
      return Math.max(0, cash - total);
    }
    return 0;
  }, [paymentMethod, cashAmount, total]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
    } else {
      updateCartQuantity(productId, newQuantity);
    }
  };

  const handleProcessOrder = async () => {
    if (!selectedEmployee) {
      toast.error('Selecciona un empleado primero');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    if (paymentMethod === 'cash' && (!cashAmount || parseFloat(cashAmount) < total)) {
      toast.error('El monto en efectivo es insuficiente');
      return;
    }

    setIsProcessing(true);

    try {
      const orderData = {
        employeeId: selectedEmployee.id,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        paymentMethod
      };

      const response = await createOrder(orderData);

      if (response.success) {
        toast.success('Orden procesada exitosamente');
        clearCart();
        setCashAmount('');
        setPaymentMethod('cash');
      } else {
        toast.error(response.error || 'Error procesando la orden');
      }
    } catch (error) {
      toast.error('Error procesando la orden');
      console.error('Order processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md h-fit">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Carrito</h2>
      </div>

      <div className="p-6 space-y-4">
        {/* Cart Items */}
        {cart.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">El carrito está vacío</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 text-sm">
                    {item.product.name}
                  </h4>
                  <p className="text-gray-600 text-xs">
                    {formatPrice(item.product.price)} c/u
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}
                    className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  
                  <span className="w-8 text-center font-medium">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}
                    className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {formatPrice(item.product.price * item.quantity)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-red-500 hover:text-red-700 mt-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <>
            {/* Payment Method */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900">Método de Pago</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMethod === 'cash'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="h-4 w-4 mx-auto mb-1" />
                  Efectivo
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="h-4 w-4 mx-auto mb-1" />
                  Tarjeta
                </button>
                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMethod === 'transfer'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Smartphone className="h-4 w-4 mx-auto mb-1" />
                  Transfer
                </button>
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === 'cash' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Efectivo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="300"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="input-primary w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total
                  </label>
                  <div className="input-primary bg-red-50 text-red-800 font-bold">
                    {formatPrice(total)}
                  </div>
                </div>
              </div>
            )}

            {/* Change */}
            {paymentMethod === 'cash' && change > 0 && (
              <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">Cambio</p>
                <p className="text-lg font-bold text-green-800">
                  {formatPrice(change)}
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total:</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Process Order Button */}
            <button
              onClick={handleProcessOrder}
              disabled={isProcessing || !selectedEmployee}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                isProcessing || !selectedEmployee
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-success-500 hover:bg-success-600 text-white'
              }`}
            >
              {isProcessing ? 'Procesando...' : 'Procesar Orden'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ShoppingCart; 