import React, { useState, useEffect } from 'react';
import { vehicleAPI, employeeAPI, dieselAPI } from '../services/api';
import { Calendar, Fuel, MessageSquare, Gauge, DollarSign, User } from 'lucide-react';
import Autocomplete from './Autocomplete';
import '../styles/forms.css';

const DieselForm = ({ onSubmit, onCancel, initialData }) => {
  const [vehicles, setVehicles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [previousLogs, setPreviousLogs] = useState([]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: '',
    vehicle: '',
    fuelType: 'Diesel',
    liters: '',
    pricePerLiter: '',
    odometer: '',
    note: '',
    status: 'Logged'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        employee: '',
        vehicle: '',
        fuelType: 'Diesel',
        liters: '',
        pricePerLiter: '',
        odometer: '',
        note: '',
        status: 'Logged'
      });
    }
  }, [initialData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vRes, eRes, dRes] = await Promise.all([
          vehicleAPI.get(), 
          employeeAPI.get(),
          dieselAPI.get()
        ]);
        setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
        setEmployees(Array.isArray(eRes.data) ? eRes.data.filter(e => e.status === 'Active' && e.role === 'Driver') : []);
        setPreviousLogs(Array.isArray(dRes.data) ? dRes.data : []);
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      if (name === 'vehicle' && value && !initialData) {
        // Auto-fill fuelType from vehicle's registered fuel type (always, default Diesel)
        const vehicleObj = vehicles.find(v => v.number === value);
        updated.fuelType = vehicleObj?.fuelType || 'Diesel';
        // Also auto-fill last known driver from previous logs
        const lastLog = previousLogs
          .filter(l => l.vehicle === value)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        if (lastLog) {
          updated.employee = lastLog.employee || '';
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Auto-create missing records
    try {
      if (formData.vehicle && !vehicles.find(v => v.number.toLowerCase() === formData.vehicle.toLowerCase())) {
        await vehicleAPI.create({ number: formData.vehicle, status: 'Active' });
      }
      if (formData.employee && !employees.find(emp => emp.name.toLowerCase() === formData.employee.toLowerCase())) {
        await employeeAPI.create({ name: formData.employee, role: 'Driver', status: 'Active' });
      }
    } catch (err) { console.error(err); }

    const total = parseFloat(formData.liters || 0) * parseFloat(formData.pricePerLiter || 0);
    onSubmit({ ...formData, total });
  };

  const total_val = parseFloat(formData.liters || 0) * parseFloat(formData.pricePerLiter || 0);

  return (
    <form className="hire-form" onSubmit={handleSubmit}>
      <div className="hire-form-scroll">
        
        <div className="form-section">
          <p className="form-section-title"><Calendar size={16} /> Fuel Log Details</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Assigned Vehicle *</label>
              <Autocomplete 
                name="vehicle" 
                value={formData.vehicle} 
                onChange={handleChange} 
                options={vehicles.map(v => v.number)}
                placeholder="Vehicle No"
                required
              />
            </div>
            <div className="form-group">
              <label>Driver / Staff</label>
              <Autocomplete 
                name="employee" 
                value={formData.employee || ''} 
                onChange={handleChange} 
                options={employees.map(emp => emp.name)}
                placeholder="Driver name"
              />
            </div>
          </div>
        </div>

        <div className="form-section" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}>
          <p className="form-section-title" style={{ color: 'var(--accent)' }}><Fuel size={16} /> Consumption Data</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Fuel Type *</label>
              <select name="fuelType" value={formData.fuelType} onChange={handleChange} required>
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
              </select>
              {formData.vehicle && (() => {
                const vObj = vehicles.find(v => v.number === formData.vehicle);
                return vObj ? (
                  <span style={{ fontSize: '11px', color: '#2563EB', marginTop: '4px', display: 'block' }}>
                    Auto-filled from vehicle record
                  </span>
                ) : null;
              })()}
            </div>
            <div className="form-group">
              <label>Fuel Liters *</label>
              <input type="number" step="0.01" name="liters" value={formData.liters} onChange={handleChange} required placeholder="e.g. 50.25" />
            </div>
            <div className="form-group">
              <label>Price per Liter *</label>
              <input type="number" step="0.01" name="pricePerLiter" value={formData.pricePerLiter} onChange={handleChange} required placeholder="LKR" />
            </div>
            <div className="form-group">
              <label>Odometer Reading</label>
              <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} placeholder="Current KM" />
            </div>
          </div>
          <div className="total-display" style={{ padding: '15px', background: 'var(--bg-side)', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '12px' }}>
             <span style={{ fontSize: '0.7rem' }}>Estimated Total Cost</span>
             <strong style={{ color: 'var(--accent)', fontSize: '1.4rem' }}>LKR {total_val.toLocaleString()}</strong>
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title"><MessageSquare size={16} /> Additional Remarks</p>
          <div className="form-group">
            <label>Notes</label>
            <textarea name="note" value={formData.note} onChange={handleChange} rows="3" placeholder="Pump details, fuel station, etc." />
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Status</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="Logged">Logged</option>
              <option value="Verified">Verified</option>
            </select>
          </div>
        </div>
      </div>

      <div className="hire-form-footer">
        <div className="total-display">
          <span>Fuel Cost</span>
          <strong>LKR {total_val.toLocaleString()}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn">{initialData ? 'Update Log' : 'Save Fuel Log'}</button>
        </div>
      </div>
    </form>
  );
};

export default DieselForm;
