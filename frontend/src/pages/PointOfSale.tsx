import React, { useEffect } from 'react';
import { usePOSStore } from '../store/usePOSStore';
import EmployeeSearch from '../components/pos/EmployeeSearch';
import ProductGrid from '../components/pos/ProductGrid';
import ShoppingCart from '../components/pos/ShoppingCart';
import { fetchEmployees, fetchProducts, fetchCategories } from '../services/api';
import toast from 'react-hot-toast';

const PointOfSale: React.FC = () => {
  const {
    selectedEmployee,
    setEmployees,
    setProducts,
    setCategories,
    setLoading
  } = usePOSStore();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [employeesRes, productsRes, categoriesRes] = await Promise.all([
          fetchEmployees(),
          fetchProducts(),
          fetchCategories()
        ]);

        if (employeesRes.success && employeesRes.data) {
          setEmployees(employeesRes.data);
        }

        if (productsRes.success && productsRes.data) {
          setProducts(productsRes.data);
        }

        if (categoriesRes.success && categoriesRes.data) {
          setCategories(categoriesRes.data);
        }
      } catch (error) {
        toast.error('Error cargando datos del sistema');
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setEmployees, setProducts, setCategories, setLoading]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Sistema de Punto de Venta
        </h1>
        
        {/* Employee Selection */}
        <EmployeeSearch />
        
        {!selectedEmployee && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">
              Selecciona un empleado para comenzar a procesar órdenes.
            </p>
          </div>
        )}
      </div>

      {selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Section */}
          <div className="lg:col-span-2">
            <ProductGrid />
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <ShoppingCart />
          </div>
        </div>
      )}
    </div>
  );
};

export default PointOfSale; 