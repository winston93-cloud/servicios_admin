'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit, Trash2, Search, Save, RotateCcw } from 'lucide-react';
import { 
  PersonalFormData, 
  createPersonal, 
  updatePersonal, 
  deletePersonal, 
  getAllPersonal,
  searchPersonal,
  PersonalSearchResult
} from '@/lib/personalService';

interface PersonalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = 'list' | 'create' | 'edit' | 'delete';

export default function PersonalModal({ isOpen, onClose }: PersonalModalProps) {
  const [mode, setMode] = useState<ModalMode>('list');
  const [personal, setPersonal] = useState<PersonalFormData[]>([]);
  const [filteredPersonal, setFilteredPersonal] = useState<PersonalFormData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PersonalSearchResult[]>([]);
  const [selectedPersonal, setSelectedPersonal] = useState<PersonalFormData | null>(null);
  const [formData, setFormData] = useState<PersonalFormData>({
    personal_nombre: '',
    personal_app: '',
    personal_apm: ''
  });
  const [loading, setLoading] = useState(false);
  // const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar personal al abrir el modal y enfocar el input de búsqueda
  useEffect(() => {
    if (isOpen) {
      loadPersonal();
      // Limpiar búsqueda y enfocar el input
      setSearchTerm('');
      setSearchResults([]);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Filtrar personal por búsqueda (búsqueda local en la lista)
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPersonal(personal);
    } else {
      const filtered = personal.filter(p =>
        p.personal_nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPersonal(filtered);
    }
  }, [searchTerm, personal]);

  // Búsqueda autocompletada con debounce
  useEffect(() => {
    const searchPersonalAsync = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      // setIsSearching(true);
      try {
        const results = await searchPersonal(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching personal:', error);
        setSearchResults([]);
      } finally {
        // setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchPersonalAsync, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadPersonal = async () => {
    setLoading(true);
    try {
      const data = await getAllPersonal();
      setPersonal(data);
      setFilteredPersonal(data);
    } catch (error) {
      console.error('Error loading personal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setMode('create');
    setFormData({
      personal_nombre: '',
      personal_app: '',
      personal_apm: ''
    });
  };

  const handleEdit = (personalItem: PersonalFormData) => {
    setSelectedPersonal(personalItem);
    setFormData({
      personal_nombre: personalItem.personal_nombre,
      personal_app: personalItem.personal_app,
      personal_apm: personalItem.personal_apm
    });
    setMode('edit');
  };

  const handleDelete = (personalItem: PersonalFormData) => {
    setSelectedPersonal(personalItem);
    setMode('delete');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (mode === 'create') {
        await createPersonal(formData);
      } else if (mode === 'edit' && selectedPersonal?.id) {
        await updatePersonal(selectedPersonal.id, formData);
      } else if (mode === 'delete' && selectedPersonal?.id) {
        await deletePersonal(selectedPersonal.id);
      }
      
      await loadPersonal();
      setMode('list');
      setSelectedPersonal(null);
    } catch (error) {
      console.error('Error saving personal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setMode('list');
    setSelectedPersonal(null);
    setFormData({
      personal_nombre: '',
      personal_app: '',
      personal_apm: ''
    });
  };

  const handleSearchSelect = (personalItem: PersonalSearchResult) => {
    setSearchTerm(personalItem.personal_nombre_completo);
    setSearchResults([]);
    // Filtrar la lista para mostrar solo el personal seleccionado
    const filtered = personal.filter(p => p.id === personalItem.id);
    setFilteredPersonal(filtered);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'list' && 'Gestión de Personal'}
            {mode === 'create' && 'Crear Personal'}
            {mode === 'edit' && 'Editar Personal'}
            {mode === 'delete' && 'Eliminar Personal'}
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {mode === 'list' && (
            <div className="producto-list-container">
              {/* Barra de búsqueda con autocompletado */}
              <div className="search-container">
                <div className="search-input-wrapper" style={{ position: 'relative' }}>
                  <Search className="search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar personal por nombre completo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  
                  {/* Resultados de autocompletado */}
                  {searchResults.length > 0 && (
                    <div className="search-results-dropdown">
                      {searchResults.map((personalItem) => (
                        <div
                          key={personalItem.id}
                          onClick={() => handleSearchSelect(personalItem)}
                          className="search-result-item"
                        >
                          <div className="search-result-name">
                            {personalItem.personal_nombre_completo}
                          </div>
                          <div className="search-result-details">
                            ID: {personalItem.id}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button onClick={handleCreate} className="btn btn-primary">
                  <Plus size={16} />
                  Nuevo Personal
                </button>
              </div>

              {/* Lista de personal */}
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Cargando personal...</p>
                </div>
              ) : (
                <div className="producto-grid">
                  {filteredPersonal.length === 0 ? (
                    <div className="empty-state">
                      <p>No se encontró personal</p>
                    </div>
                  ) : (
                    filteredPersonal.map((personalItem) => (
                      <div key={personalItem.id} className="producto-card">
                        <div className="producto-info">
                          <h3 className="producto-name">{personalItem.personal_nombre_completo}</h3>
                          <div className="producto-details">
                            <p><strong>Nombre:</strong> {personalItem.personal_nombre}</p>
                            <p><strong>Apellido Paterno:</strong> {personalItem.personal_app}</p>
                            <p><strong>Apellido Materno:</strong> {personalItem.personal_apm}</p>
                            <p><strong>ID:</strong> {personalItem.id}</p>
                          </div>
                        </div>
                        <div className="producto-actions">
                          <button
                            onClick={() => handleEdit(personalItem)}
                            className="btn btn-secondary btn-sm"
                            title="Editar personal"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(personalItem)}
                            className="btn btn-danger btn-sm"
                            title="Eliminar personal"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <div className="form-container">
              <div className="form-group">
                <label htmlFor="personal_nombre" className="form-label">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="personal_nombre"
                  value={formData.personal_nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, personal_nombre: e.target.value }))}
                  className="form-input"
                  placeholder="Ingresa el nombre"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="personal_app" className="form-label">
                  Apellido Paterno *
                </label>
                <input
                  type="text"
                  id="personal_app"
                  value={formData.personal_app}
                  onChange={(e) => setFormData(prev => ({ ...prev, personal_app: e.target.value }))}
                  className="form-input"
                  placeholder="Ingresa el apellido paterno"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="personal_apm" className="form-label">
                  Apellido Materno *
                </label>
                <input
                  type="text"
                  id="personal_apm"
                  value={formData.personal_apm}
                  onChange={(e) => setFormData(prev => ({ ...prev, personal_apm: e.target.value }))}
                  className="form-input"
                  placeholder="Ingresa el apellido materno"
                  required
                />
              </div>

              {/* Vista previa del nombre completo */}
              <div className="form-group">
                <label className="form-label">Vista previa del nombre completo:</label>
                <div className="preview-text">
                  {`${formData.personal_nombre} ${formData.personal_app} ${formData.personal_apm}`.trim() || 'Ingresa los datos para ver la vista previa'}
                </div>
              </div>

              <div className="form-actions">
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  <RotateCcw size={16} />
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="btn btn-primary"
                  disabled={loading || !formData.personal_nombre.trim() || !formData.personal_app.trim() || !formData.personal_apm.trim()}
                >
                  <Save size={16} />
                  {loading ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Actualizar'}
                </button>
              </div>
            </div>
          )}

          {mode === 'delete' && selectedPersonal && (
            <div className="delete-confirmation">
              <div className="delete-warning">
                <h3>¿Estás seguro de que quieres eliminar este personal?</h3>
                <div className="delete-details">
                  <p><strong>Nombre:</strong> {selectedPersonal.personal_nombre_completo}</p>
                  <p><strong>ID:</strong> {selectedPersonal.id}</p>
                </div>
                <p className="delete-note">Esta acción no se puede deshacer.</p>
              </div>
              <div className="form-actions">
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="btn btn-danger"
                  disabled={loading}
                >
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
