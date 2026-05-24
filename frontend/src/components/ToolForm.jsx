import React, { useState, useEffect } from 'react';
import { toolAPI } from '../services/api';
import { Wrench, Hash, Zap, Calendar, Shield, CreditCard, Package } from 'lucide-react';
import '../styles/forms.css';

const ToolForm = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState({
    number: '',
    model: '',
    category: 'General',
    powerSource: '',
    status: 'Available',
    dailyRate: 0,
    warrantyExpirationDate: '',
    nextServiceDate: '',
    lastServiceDate: '',
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
        warrantyExpirationDate: initialData.warrantyExpirationDate ? new Date(initialData.warrantyExpirationDate).toISOString().split('T')[0] : '',
        nextServiceDate: initialData.nextServiceDate ? new Date(initialData.nextServiceDate).toISOString().split('T')[0] : '',
        lastServiceDate: initialData.lastServiceDate ? new Date(initialData.lastServiceDate).toISOString().split('T')[0] : '',
        leaseFinalDate: initialData.leaseFinalDate ? new Date(initialData.leaseFinalDate).toISOString().split('T')[0] : ''
      });
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initialData) {
        await toolAPI.update(initialData._id, formData);
      } else {
        await toolAPI.create(formData);
      }
      onSubmit();
    } catch (err) {
      console.error(err);
      alert('Failed to save tool. Check if Tool ID is unique.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="hire-form" onSubmit={handleSubmit}>
      <div className="hire-form-scroll">

        <div className="form-section">
          <p className="form-section-title"><Package size={16} /> Basic Information</p>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Tool ID / Serial *</label>
              <div className="select-wrapper">
                <Hash className="input-icon-left" size={16} />
                <input
                  style={{ paddingLeft: '40px' }}
                  type="text" required placeholder="e.g. GRILL-001"
                  value={formData.number}
                  onChange={e => setFormData({ ...formData, number: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Tool Model</label>
              <input
                type="text" placeholder="e.g. Electric Grill Large"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Category</label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="General">General</option>
                <option value="Kitchen">Kitchen / Catering</option>
                <option value="Electric">Power Tools</option>
                <option value="Construction">Construction</option>
                <option value="Garden">Garden</option>
                <option value="Cleaning">Cleaning</option>
              </select>
            </div>
            {/* Power Source */}
            <div className="form-group">
              <label htmlFor="powerSource">Power Source</label>
              <div className="select-wrapper">
                {/* <Zap className="input-icon-left" size={15} /> */}
                <select
                  id="powerSource"
                  value={formData.powerSource}
                  onChange={e => set('powerSource', e.target.value)}
                  style={{ paddingLeft: '10px' }}
                >
                  <option value="" disabled>Select source</option>
                  <option value="Electric">Electric (Corded)</option>
                  <option value="Battery">Battery Powered</option>
                  <option value="Petrol">Petrol / Diesel</option>
                  <option value="Manual">Manual / Mechanical</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                <option value="Available">Available</option>
                <option value="Booked">Booked</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Repair">Under Repair</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}>
          <p className="form-section-title" style={{ color: 'var(--accent)' }}><CreditCard size={16} /> Rates</p>
          <div className="form-grid-1">
            <div className="form-group">
              <label>Daily Rate (LKR)</label>
              <input type="number" value={formData.dailyRate} onChange={e => setFormData({ ...formData, dailyRate: Number(e.target.value) })} />
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
                onChange={e => setFormData({ ...formData, hasLeasing: e.target.checked })}
              />
              This tool is on lease
            </label>
          </div>

          {formData.hasLeasing && (
            <>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Leasing Company</label>
                  <input type="text" value={formData.leasingCompany} onChange={e => setFormData({ ...formData, leasingCompany: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Monthly Premium (LKR)</label>
                  <input type="number" value={formData.monthlyPremium} onChange={e => setFormData({ ...formData, monthlyPremium: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-grid-2" style={{ marginTop: '16px' }}>
                <div className="form-group">
                  <label>Payment Due Day (1-31)</label>
                  <input type="number" min="1" max="31" value={formData.leaseDueDate} onChange={e => setFormData({ ...formData, leaseDueDate: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Lease Final Date</label>
                  <input type="date" value={formData.leaseFinalDate} onChange={e => setFormData({ ...formData, leaseFinalDate: e.target.value })} />
                </div>
              </div>
            </>
          )}
        </div>
{/* ////////////////////////////// Warranty & Maintenance////////////////////////////*/}
        <div className="form-section">
          <p className="form-section-title">
            <Shield size={16} /> Warranty & Maintenance
          </p>

          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={formData.hasWarranty}
                onChange={(e) =>
                  setFormData({ ...formData, hasWarranty: e.target.checked })
                }
              />
              This tool has warranty & maintenance
            </label>
          </div>

          {formData.hasWarranty && (
            <>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Warranty Expiry Date</label>
                  <input
                    type="date"
                    value={formData.warrantyExpirationDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        warrantyExpirationDate: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Next Service Date</label>
                  <input
                    type="date"
                    value={formData.nextServiceDate}
                    onChange={(e) =>
                      setFormData({ ...formData, nextServiceDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: "16px" }}>
                <div className="form-group">
                  <label>Last Service Date</label>
                  <input
                    type="date"
                    value={formData.lastServiceDate}
                    onChange={(e) =>
                      setFormData({ ...formData, lastServiceDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <div className="hire-form-footer">
        <div className="total-display">
          <span>{initialData ? 'Update Inventory Record' : 'Register New Tool'}</span>
          <strong>{formData.number || 'New Unit'}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : initialData ? 'Update Tool' : 'Register Tool'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ToolForm;
