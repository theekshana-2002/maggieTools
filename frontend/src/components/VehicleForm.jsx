import React, { useState, useEffect } from 'react';
import { vehicleAPI } from '../services/api';
import { Truck, Hash, Gauge, Calendar, Shield, CreditCard, Droplet } from 'lucide-react';
import '../styles/forms.css';

const VehicleForm = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState({
    number: '',
    model: '',
    category: 'Economy',
    fuelType: 'Petrol',
    status: 'Available',
    dailyRate: 0,
    kmLimitPerDay: 100,
    extraKmRate: 50,
    insuranceExpirationDate: '',
    licenseExpirationDate: '',
    safetyExpirationDate: '',
    hasLeasing: false,
    leasingCompany: '',
    monthlyPremium: 0,
    leaseDueDate: '',
    leaseFinalDate: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        insuranceExpirationDate: initialData.insuranceExpirationDate ? new Date(initialData.insuranceExpirationDate).toISOString().split('T')[0] : '',
        licenseExpirationDate: initialData.licenseExpirationDate ? new Date(initialData.licenseExpirationDate).toISOString().split('T')[0] : '',
        safetyExpirationDate: initialData.safetyExpirationDate ? new Date(initialData.safetyExpirationDate).toISOString().split('T')[0] : '',
        leaseFinalDate: initialData.leaseFinalDate ? new Date(initialData.leaseFinalDate).toISOString().split('T')[0] : ''
      });
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initialData) {
        await vehicleAPI.update(initialData._id, formData);
      } else {
        await vehicleAPI.create(formData);
      }
      onSubmit();
    } catch (err) {
      console.error(err);
      alert('Failed to save vehicle. Check if plate number is unique.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="hire-form" onSubmit={handleSubmit}>
      <div className="hire-form-scroll">
        
        <div className="form-section">
          <p className="form-section-title"><Truck size={16} /> Basic Information</p>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Plate Number *</label>
              <div className="select-wrapper">
                <Hash className="input-icon-left" size={16} />
                <input 
                  style={{ paddingLeft: '40px' }}
                  type="text" required placeholder="e.g. WP CAA-1234"
                  value={formData.number}
                  onChange={e => setFormData({...formData, number: e.target.value.toUpperCase()})}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Vehicle Model</label>
              <input 
                type="text" placeholder="e.g. Toyota Prius"
                value={formData.model}
                onChange={e => setFormData({...formData, model: e.target.value})}
              />
            </div>
          </div>
          
          <div className="form-grid-3" style={{ marginTop: '16px' }}>
             <div className="form-group">
               <label>Category</label>
               <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="Economy">Economy</option>
                  <option value="Premium">Premium</option>
                  <option value="Luxury">Luxury</option>
                  <option value="SUV">SUV</option>
                  <option value="Van">Van</option>
                  <option value="Wedding Car">Wedding Car</option>
               </select>
             </div>
             <div className="form-group">
               <label>Fuel Type</label>
               <div className="select-wrapper">
                 <Droplet className="input-icon-left" size={16} />
                 <select style={{ paddingLeft: '40px' }} value={formData.fuelType} onChange={e => setFormData({...formData, fuelType: e.target.value})}>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                 </select>
               </div>
             </div>
             <div className="form-group">
               <label>Status</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Available">Available</option>
                  <option value="Booked">Booked</option>
                  <option value="Maintenance">Maintenance</option>
               </select>
             </div>
          </div>
        </div>

        <div className="form-section" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}>
          <p className="form-section-title" style={{ color: 'var(--accent)' }}><CreditCard size={16} /> Rates & Limitations</p>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Daily Rate (LKR)</label>
              <input type="number" value={formData.dailyRate} onChange={e => setFormData({...formData, dailyRate: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>KM Limit / Day</label>
              <input type="number" value={formData.kmLimitPerDay} onChange={e => setFormData({...formData, kmLimitPerDay: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Extra KM Rate</label>
              <input type="number" value={formData.extraKmRate} onChange={e => setFormData({...formData, extraKmRate: Number(e.target.value)})} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title"><CreditCard size={16} /> Leasing & Finance</p>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.hasLeasing} 
                onChange={e => setFormData({...formData, hasLeasing: e.target.checked})} 
              />
              This vehicle is on lease
            </label>
          </div>

          {formData.hasLeasing && (
            <>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Leasing Company</label>
                  <input type="text" value={formData.leasingCompany} onChange={e => setFormData({...formData, leasingCompany: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Monthly Premium (LKR)</label>
                  <input type="number" value={formData.monthlyPremium} onChange={e => setFormData({...formData, monthlyPremium: Number(e.target.value)})} />
                </div>
              </div>
              <div className="form-grid-2" style={{ marginTop: '16px' }}>
                <div className="form-group">
                  <label>Payment Due Day (1-31)</label>
                  <input type="number" min="1" max="31" value={formData.leaseDueDate} onChange={e => setFormData({...formData, leaseDueDate: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>Lease Final Date</label>
                  <input type="date" value={formData.leaseFinalDate} onChange={e => setFormData({...formData, leaseFinalDate: e.target.value})} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="form-section">
          <p className="form-section-title"><Shield size={16} /> Compliance & Renewals</p>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Insurance Expiry</label>
              <input type="date" value={formData.insuranceExpirationDate} onChange={e => setFormData({...formData, insuranceExpirationDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>License Expiry</label>
              <input type="date" value={formData.licenseExpirationDate} onChange={e => setFormData({...formData, licenseExpirationDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Safety Cert Expiry</label>
              <input type="date" value={formData.safetyExpirationDate} onChange={e => setFormData({...formData, safetyExpirationDate: e.target.value})} />
            </div>
          </div>
        </div>

      </div>

      <div className="hire-form-footer">
        <div className="total-display">
          <span>{initialData ? 'Update Fleet Record' : 'Register New Vehicle'}</span>
          <strong>{formData.number || 'New Unit'}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : initialData ? 'Update Vehicle' : 'Register Vehicle'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default VehicleForm;
