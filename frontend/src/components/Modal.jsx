import React from 'react';
import { X } from 'lucide-react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, wide }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={wide ? { maxWidth: '780px' } : {}}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {/* No modal-body wrapper — child forms control their own scroll */}
        {children}
      </div>
    </div>
  );
};

export default Modal;
