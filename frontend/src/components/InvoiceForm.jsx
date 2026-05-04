import React, { useState, useEffect } from 'react';
import { clientAPI, vehicleAPI } from '../services/api';
import Autocomplete from './Autocomplete';
import '../styles/forms.css';

/* ── Helpers ───────────────────────────────────────────────── */
const defaultForm = () => ({
  clientName: '',
  site: '',
  vehicleNo: '',
  vehicleType: '',
  date: new Date().toISOString().split('T')[0],
  jobDescription: '',
  unitType: 'Days',
  totalUnits: 0,
  ratePerUnit: 0,
  transportCharge: 0,
  otherCharges: 0,
  otherChargesDescription: '',
  totalAmount: 0,
  status: 'Draft',
});

const calcTotal = (d) =>
  +(
    Number(d.totalUnits    || 0) * Number(d.ratePerUnit    || 0) +
    Number(d.transportCharge || 0) +
    Number(d.otherCharges    || 0)
  ).toFixed(2);

const calcSubtotal = (d) =>
  +(Number(d.totalUnits || 0) * Number(d.ratePerUnit || 0)).toFixed(2);

/* ── Component ─────────────────────────────────────────────── */
const InvoiceForm = ({ onSubmit, onCancel, initialData }) => {
  const [formData,   setFormData]   = useState(defaultForm());
  const [clients,    setClients]    = useState([]);
  const [vehicles,   setVehicles]   = useState([]);
  const [submitting, setSubmitting] = useState(false);

  /* Load dropdowns & pre-fill when editing */
  useEffect(() => {
    fetchLinkedData();
    if (initialData) {
      setFormData({
        ...defaultForm(),
        ...initialData,
        date: initialData.date
          ? new Date(initialData.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      });
    } else {
      setFormData(defaultForm());
    }
  }, [initialData]);

  const fetchLinkedData = async () => {
    try {
      const [cRes, vRes] = await Promise.all([
        clientAPI.get(),
        vehicleAPI.get(),
      ]);
      setClients(Array.isArray(cRes.data) ? cRes.data : []);
      setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
    } catch (err) {
      console.error('Failed to fetch linked data', err);
    }
  };

  /* Generic field change — recalcs total automatically */
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };

    // Auto-fill type if selecting existing vehicle
    if (name === 'vehicleNo') {
      const vehicleObj = vehicles.find(v => v.number === value);
      if (vehicleObj) updated.vehicleType = vehicleObj.type || '';
    }

    updated.totalAmount = calcTotal(updated);
    setFormData(updated);
  };

  /* Vehicle select → auto-fill vehicleType from DB record */
  const handleVehicleChange = (e) => {
    const selectedNo = e.target.value;
    const vehicleObj = vehicles.find((v) => v.number === selectedNo);
    const updated = {
      ...formData,
      vehicleNo:   selectedNo,
      vehicleType: vehicleObj?.type || formData.vehicleType,
    };
    updated.totalAmount = calcTotal(updated);
    setFormData(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Auto-create missing records
    try {
      if (formData.clientName && !clients.find(c => c.name.toLowerCase() === formData.clientName.toLowerCase())) {
        await clientAPI.create({ name: formData.clientName, status: 'Active' });
      }
      if (formData.vehicleNo && !vehicles.find(v => v.number.toLowerCase() === formData.vehicleNo.toLowerCase())) {
        await vehicleAPI.create({ number: formData.vehicleNo, status: 'Active' });
      }
    } catch (err) { console.error('Auto-creation failed', err); }

    try {
      await onSubmit({ ...formData, totalAmount: calcTotal(formData) });
    } finally {
      setSubmitting(false);
    }
  };

  /* Derived display values */
  const subtotal  = calcSubtotal(formData);
  const grandTotal = calcTotal(formData);

  return (
    <form onSubmit={handleSubmit} className="hire-form">
      <div className="hire-form-scroll">

        {/* ── Section 1: Client & Logistics ── */}
        <div className="form-section">
          <p className="form-section-title">Client &amp; Logistics</p>
          <div className="form-grid">

            <div className="form-group">
              <label>Client Name *</label>
              <Autocomplete 
                name="clientName" 
                value={formData.clientName} 
                onChange={handleChange} 
                options={clients.map(c => c.name)}
                placeholder="Client name"
                required
              />
            </div>

            {/* Vehicle Number — triggers auto-fill of type */}
            <div className="form-group">
              <label>Vehicle Number</label>
              <Autocomplete 
                name="vehicleNo" 
                value={formData.vehicleNo} 
                onChange={handleChange} 
                options={vehicles.map(v => v.number)}
                placeholder="Vehicle No"
              />
            </div>

            {/* Vehicle Type — auto-filled but still editable */}
            <div className="form-group">
              <label>Vehicle Type</label>
              <select name="vehicleType" value={formData.vehicleType} onChange={handleChange}>
                <option value="">Select Type</option>
                <option value="Car">Car</option>
                <option value="SUV">SUV</option>
                <option value="Van">Van</option>
                <option value="Luxury Car">Luxury Car</option>
                <option value="Luxury SUV">Luxury SUV</option>
                <option value="Wedding Car">Wedding Car</option>
                <option value="Cab">Cab</option>
                <option value="Bus">Bus</option>
                <option value="Other">Other</option>
              </select>
              {formData.vehicleNo && formData.vehicleType && (
                <span style={{ fontSize: '11px', color: '#2563EB', marginTop: '4px', display: 'block' }}>
                  ✓ Auto-filled from vehicle record
                </span>
              )}
            </div>

          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Invoice Date *</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
          </div>
        </div>

        {/* ── Section 2: Job Details ── */}
        <div className="form-section">
          <p className="form-section-title">Rental Service Details</p>
          <div className="form-group">
            <label>Description of Hire</label>
            <textarea
              name="jobDescription" value={formData.jobDescription}
              onChange={handleChange} rows="2"
              placeholder="e.g. Full day hire, Airport drop..."
            />
          </div>
        </div>

        {/* ── Section 3: Pricing Breakdown ── */}
        <div className="form-section">
          <p className="form-section-title">Pricing Breakdown</p>
          <div className="form-grid">

            <div className="form-group">
              <label>Unit Type</label>
              <select name="unitType" value={formData.unitType} onChange={handleChange}>
                <option value="Days">Days</option>
                <option value="KM">KM</option>
                <option value="Lumpsum">Lumpsum</option>
                <option value="Hours">Hours</option>
              </select>
            </div>

            <div className="form-group">
              <label>Total Units</label>
              <input
                type="number" name="totalUnits"
                value={formData.totalUnits} onChange={handleChange}
                min="0" step="0.01"
              />
            </div>

            <div className="form-group">
              <label>Rate / Unit (LKR)</label>
              <input
                type="number" name="ratePerUnit"
                value={formData.ratePerUnit} onChange={handleChange}
                min="0"
              />
            </div>

          </div>

          {/* Live subtotal hint */}
          {subtotal > 0 && (
            <div style={{
              margin: '10px 0 4px',
              padding: '8px 12px',
              background: '#EFF6FF',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#1D4ED8',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>Units Subtotal ({formData.totalUnits} × LKR {Number(formData.ratePerUnit).toLocaleString()})</span>
              <strong>LKR {subtotal.toLocaleString()}</strong>
            </div>
          )}

          <div className="form-grid" style={{ marginTop: '12px' }}>

            <div className="form-group">
              <label>Transport Charge (LKR)</label>
              <input
                type="number" name="transportCharge"
                value={formData.transportCharge} onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Other Charges (LKR)</label>
              <input
                type="number" name="otherCharges"
                value={formData.otherCharges} onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

          </div>
        </div>

      </div>{/* end hire-form-scroll */}

      {/* ── Footer: Grand Total + Actions ── */}
      <div className="hire-form-footer">
        <div className="total-display" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Grand Total
          </span>
          <strong style={{ fontSize: '22px', color: '#2563EB' }}>
            LKR {grandTotal.toLocaleString()}
          </strong>
          {(Number(formData.transportCharge) > 0 || Number(formData.otherCharges) > 0) && (
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {subtotal.toLocaleString()} + {Number(formData.transportCharge || 0).toLocaleString()} + {Number(formData.otherCharges || 0).toLocaleString()}
            </span>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Saving...' : initialData ? 'Update Invoice' : 'Save & Generate'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default InvoiceForm;
