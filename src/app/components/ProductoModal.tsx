'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit, Trash2, Search, Save, RotateCcw } from 'lucide-react';
import { 
  ProductoFormData, 
  createProducto, 
  updateProducto, 
  deleteProducto, 
  getAllProductos 
} from '@/lib/productoService';

interface ProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = 'list' | 'create' | 'edit' | 'delete';

export default function ProductoModal({ isOpen, onClose }: ProductoModalProps) {
  const [mode, setMode] = useState<ModalMode>('list');
  const [productos, setProductos] = useState<ProductoFormData[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<ProductoFormData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducto, setSelectedProducto] = useState<ProductoFormData | null>(null);
  const [formData, setFormData] = useState<ProductoFormData>({
    desayuno_nombre: '',
    desayuno_abreviatura: '',
    costo: 0
  });
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar productos al abrir el modal y enfocar el input de búsqueda
  useEffect(() => {
    if (isOpen) {
      loadProductos();
      // Limpiar búsqueda y enfocar el input
      setSearchTerm('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100); // Pequeño delay para asegurar que el modal esté renderizado
    }
  }, [isOpen]);

  // Filtrar productos por búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProductos(productos);
    } else {
      const filtered = productos.filter(producto =>
        producto.desayuno_nombre.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProductos(filtered);
    }
  }, [searchTerm, productos]);

  const loadProductos = async () => {
    setLoading(true);
    try {
      const data = await getAllProductos();
      setProductos(data);
      setFilteredProductos(data);
    } catch (error) {
      console.error('Error loading productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setMode('create');
    setFormData({
      desayuno_nombre: '',
      desayuno_abreviatura: '',
      costo: 0
    });
  };

  const handleEdit = (producto: ProductoFormData) => {
    setSelectedProducto(producto);
    setFormData(producto);
    setMode('edit');
  };

  const handleDelete = (producto: ProductoFormData) => {
    setSelectedProducto(producto);
    setMode('delete');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      console.log('handleSave called with mode:', mode);
      console.log('formData:', formData);
      console.log('selectedProducto:', selectedProducto);
      
      if (mode === 'create') {
        console.log('Creating new producto...');
        const result = await createProducto(formData);
        console.log('Create result:', result);
        if (result) {
          await loadProductos();
          setMode('list');
        } else {
          console.error('Failed to create producto');
          alert('Error al crear el producto. Por favor, intenta de nuevo.');
        }
      } else if (mode === 'edit' && selectedProducto?.id) {
        console.log('Updating producto with id:', selectedProducto.id);
        const result = await updateProducto(selectedProducto.id, formData);
        console.log('Update result:', result);
        if (result) {
          await loadProductos();
          setMode('list');
        } else {
          console.error('Failed to update producto');
          alert('Error al actualizar el producto. Por favor, intenta de nuevo.');
        }
      }
    } catch (error) {
      console.error('Error saving producto:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      alert('Error al guardar el producto. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedProducto?.id) return;
    
    setLoading(true);
    try {
      const success = await deleteProducto(selectedProducto.id);
      if (success) {
        await loadProductos();
        setMode('list');
      }
    } catch (error) {
      console.error('Error deleting producto:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setMode('list');
    setSelectedProducto(null);
    setFormData({
      desayuno_nombre: '',
      desayuno_abreviatura: '',
      costo: 0
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'list' && 'Gestión de Productos'}
            {mode === 'create' && 'Nuevo Producto'}
            {mode === 'edit' && 'Editar Producto'}
            {mode === 'delete' && 'Eliminar Producto'}
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="modal-body">
          {mode === 'list' && (
            <div className="producto-list-container">
              {/* Barra de búsqueda */}
              <div className="search-container">
                <div className="search-input-wrapper">
                  <Search size={16} className="search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nombre de producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={() => setSearchTerm('')}
                    className="search-input"
                  />
                </div>
                <button onClick={handleCreate} className="btn-primary">
                  <Plus size={16} />
                  Nuevo Producto
                </button>
              </div>

              {/* Lista de productos */}
              <div className="producto-list">
                {loading ? (
                  <div className="loading">Cargando productos...</div>
                ) : filteredProductos.length === 0 ? (
                  <div className="empty-state">No se encontraron productos</div>
                ) : (
                  filteredProductos.map((producto) => (
                    <div key={producto.id} className="producto-item">
                      <div className="producto-info">
                        <div className="producto-name">{producto.desayuno_nombre}</div>
                        <div className="producto-details">
                          <span className="producto-code">{producto.desayuno_abreviatura}</span>
                          <span className="producto-price">${producto.costo}</span>
                        </div>
                      </div>
                      <div className="producto-actions">
                        <button
                          onClick={() => handleEdit(producto)}
                          className="btn-edit"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(producto)}
                          className="btn-delete"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <div className="form-container">
              <div className="form-group">
                <label htmlFor="desayuno_nombre">Nombre del Producto</label>
                <input
                  id="desayuno_nombre"
                  type="text"
                  value={formData.desayuno_nombre}
                  onChange={(e) => setFormData({ ...formData, desayuno_nombre: e.target.value })}
                  className="form-input"
                  placeholder="Ej: Desayuno Completo"
                />
              </div>

              <div className="form-group">
                <label htmlFor="desayuno_abreviatura">Abreviatura</label>
                <input
                  id="desayuno_abreviatura"
                  type="text"
                  value={formData.desayuno_abreviatura}
                  onChange={(e) => setFormData({ ...formData, desayuno_abreviatura: e.target.value })}
                  className="form-input"
                  placeholder="Ej: DC"
                />
              </div>

              <div className="form-group">
                <label htmlFor="costo">Costo</label>
                <input
                  id="costo"
                  type="number"
                  step="0.01"
                  value={formData.costo}
                  onChange={(e) => setFormData({ ...formData, costo: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                  placeholder="0.00"
                />
              </div>

              <div className="form-actions">
                <button onClick={handleCancel} className="btn-secondary">
                  <RotateCcw size={16} />
                  Cancelar
                </button>
                <button 
                  onClick={handleSave} 
                  className="btn-primary"
                  disabled={loading || !formData.desayuno_nombre || !formData.desayuno_abreviatura}
                >
                  <Save size={16} />
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {mode === 'delete' && selectedProducto && (
            <div className="delete-confirmation">
              <div className="delete-message">
                ¿Estás seguro de que quieres eliminar el producto:
                <strong>&quot;{selectedProducto.desayuno_nombre}&quot;</strong>?
              </div>
              <div className="delete-details">
                <p>Abreviatura: {selectedProducto.desayuno_abreviatura}</p>
                <p>Costo: ${selectedProducto.costo}</p>
              </div>
              <div className="form-actions">
                <button onClick={handleCancel} className="btn-secondary">
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDelete} 
                  className="btn-danger"
                  disabled={loading}
                >
                  <Trash2 size={16} />
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 