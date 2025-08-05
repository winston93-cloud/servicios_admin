'use client';

import React, { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export default function SuccessModal({ isOpen, message, onClose }: SuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  // Si no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className="success-modal-overlay" onClick={onClose}>
      <div className="success-modal" onClick={(e) => e.stopPropagation()}>
        <div className="success-modal-content">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <div className="success-message">
            {message}
          </div>
          <button 
            className="success-close-btn"
            onClick={onClose}
            title="Cerrar"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
} 