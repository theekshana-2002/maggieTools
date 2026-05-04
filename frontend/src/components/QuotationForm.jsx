import React, { useState, useEffect } from 'react';
import { clientAPI, vehicleAPI } from '../services/api';
import Autocomplete from './Autocomplete';
import '../styles/forms.css';

/* ── Helpers ───────────────────────────────────────────────── */
const defaultForm = () => ({
  clientName: '',
  clientAddress: '',
  quotationNo: '',
  date: new Date().toISOString().split('T')[0],
  validityDays: 30,
  vehicleType: '',
  vehicleNo: '',
  refundableDeposit: 0,
  mandatoryCharge: 0,
  transportCharge: 0,
  extraHourRate: 0,
  estimatedTotal: 0,
  termsAndConditions: '',
  status: 'Draft',   // ← matches schema enum
});

/* Auto-calc: mandatory + transport + extraHourRate */
const calcTotal = (d) =>
  +(
    Number(d.mandatoryCharge || 0) +
    Number(d.transportCharge  || 0) +
    Number(d.extraHourRate    || 0)
  ).toFixed(2);

/* ── Component ─────────────────────────────────────────────── */
const QuotationForm = ({ onSubmit, onCancel, initialData }) => {
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

  /* Generic field change — recalcs total for numeric fields */
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    
    // Auto-fill address if selecting existing client
    if (name === 'clientName') {
      const clientObj = clients.find(c => c.name === value);
      if (clientObj) updated.clientAddress = clientObj.address || '';
    }

    // Auto-fill type if selecting existing vehicle
    if (name === 'vehicleNo') {
      const vehicleObj = vehicles.find(v => v.number === value);
      if (vehicleObj) updated.vehicleType = vehicleObj.type || '';
    }

    updated.estimatedTotal = calcTotal(updated);
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
      await onSubmit({ ...formData, estimatedTotal: calcTotal(formData) });
    } finally {
      setSubmitting(false);
    }
  };

  const grandTotal = calcTotal(formData);

  return (
    <form onSubmit={handleSubmit} className="hire-form">
      <div className="hire-form-scroll">

        {/* ── Section 1: Quotation Details & Client ── */}
        <div className="form-section">
          <p className="form-section-title">Quotation Details &amp; Client</p>
          <div className="form-grid">

            <div className="form-group">
              <label>Client Name *</label>
              <Autocomplete 
                name="clientName" 
                value={formData.clientName} 
                onChange={handleChange} 
                options={clients.map(c => c.name)}
                placeholder="Type client name"
                required
              />
            </div>

            <div className="form-group">
              <label>Quotation Number</label>
              <input
                type="text" name="quotationNo"
                value={formData.quotationNo} onChange={handleChange}
                placeholder="Auto-generated if blank"
              />
            </div>

            <div className="form-group">
              <label>Validity (Days)</label>
              <input
                type="number" name="validityDays"
                value={formData.validityDays} onChange={handleChange}
                min="1"
              />
            </div>

          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Quotation Date *</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Client Address</label>
            <textarea
              name="clientAddress" value={formData.clientAddress}
              onChange={handleChange} rows="2"
              placeholder="Official address of the client..."
            />
          </div>
        </div>

        {/* ── Section 2: Vehicle Specifications ── */}
        <div className="form-section">
          <p className="form-section-title">Vehicle Specifications Required</p>
          <div className="form-grid">

            <div className="form-group">
              <label>Vehicle / Fleet No</label>
              <Autocomplete 
                name="vehicleNo" 
                value={formData.vehicleNo} 
                onChange={handleChange} 
                options={vehicles.map(v => v.number)}
                placeholder="Vehicle No"
              />
            </div>

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

            <div className="form-group">
              <label>Refundable Deposit (LKR)</label>
              <input
                type="number" name="refundableDeposit"
                value={formData.refundableDeposit} onChange={handleChange}
                placeholder="Security amount"
              />
            </div>

          </div>
        </div>

        {/* ── Section 3: Pricing ── */}
        <div className="form-section">
          <p className="form-section-title">Pricing &amp; Financial Offer (LKR)</p>
          <div className="form-grid">

            <div className="form-group">
              <label>Min / Mandatory Charge</label>
              <input
                type="number" name="mandatoryCharge"
                value={formData.mandatoryCharge} onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Transport Charge</label>
              <input
                type="number" name="transportCharge"
                value={formData.transportCharge} onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Extra KM Rate</label>
              <input
                type="number" name="extraHourRate"
                value={formData.extraHourRate} onChange={handleChange}
                min="0"
              />
            </div>

          </div>

          {/* Live breakdown hint */}
          {grandTotal > 0 && (
            <div style={{
              margin: '12px 0 0',
              padding: '8px 12px',
              background: '#EFF6FF',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#1D4ED8',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>
                Mandatory {Number(formData.mandatoryCharge || 0).toLocaleString()} +
                Transport {Number(formData.transportCharge || 0).toLocaleString()} +
                Extra KM {Number(formData.extraHourRate || 0).toLocaleString()}
              </span>
              <strong>LKR {grandTotal.toLocaleString()}</strong>
            </div>
          )}
        </div>

        {/* ── Section 4: Terms ── */}
        <div className="form-section">
          <p className="form-section-title">Terms &amp; Conditions</p>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Specific Terms</label>
            <textarea
              name="termsAndConditions" value={formData.termsAndConditions}
              onChange={handleChange} rows="4"
              placeholder="Mention working hours, fuel terms, etc..."
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

      </div>{/* end hire-form-scroll */}

      {/* ── Footer ── */}
      <div className="hire-form-footer">
        <div className="total-display" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estimated Total
          </span>
          <strong style={{ fontSize: '22px', color: '#2563EB' }}>
            LKR {grandTotal.toLocaleString()}
          </strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Saving...' : initialData ? 'Update Quotation' : 'Save & Issue'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default QuotationForm;
