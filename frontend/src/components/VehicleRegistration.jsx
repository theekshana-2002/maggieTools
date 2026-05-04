import React from 'react';
import VehicleForm from './VehicleForm';
import { Truck } from 'lucide-react';
import '../styles/books.css';

const VehicleRegistration = ({ onComplete }) => {
  return (
    <div className="book-container">
      <div className="dashboard-header">
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Admin Operations</p>
          <h1>Register New Vehicle</h1>
        </div>
      </div>

      <div className="compliance-card" style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '10px', borderRadius: '12px' }}>
                <Truck size={24} />
            </div>
            <div>
                <h3 style={{ margin: 0 }}>Vehicle Details</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Fill in the information below to add a new unit to the fleet.</p>
            </div>
        </div>
        
        <VehicleForm 
          onCancel={() => {}} 
          onSubmit={() => {
              alert('Vehicle registered successfully!');
              setTimeout(() => {
                if (onComplete) onComplete();
              }, 100);
          }} 
        />
      </div>
    </div>
  );
};

export default VehicleRegistration;
