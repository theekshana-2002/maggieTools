import React, { useState, useEffect } from 'react';
import { clientAPI, toolAPI } from '../services/api';
import Autocomplete from './Autocomplete';
import '../styles/forms.css';

/* ── Helpers ───────────────────────────────────────────────── */
const defaultForm = () => ({
  clientName: '',
  site: '',
  toolNo: '',   // Internal field name kept for schema compatibility (tool ID)
  toolCategory: '', // Internal field name kept for schema compatibility (tool category)
  date: new Date().toISOString().split('T')[0],
  jobDescription: '',
  unitType: 'Days',
  totalUnits: 0,
  ratePerUnit: 0,
  totalAmount: 0,
  status: 'Draft',
});

const calcTotal = (d) =>
  +(Number(d.totalUnits || 0) * Number(d.ratePerUnit || 0)).toFixed(2);

const calcSubtotal = (d) =>
  +(Number(d.totalUnits || 0) * Number(d.ratePerUnit || 0)).toFixed(2);

/* ── Component ─────────────────────────────────────────────── */
const InvoiceForm = ({ onSubmit, onCancel, initialData }) => {
  const [formData,   setFormData]   = useState(defaultForm());
  const [clients,    setClients]    = useState([]);
  const [tools,   setTools]   = useState([]);
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
      const [cRes, tRes] = await Promise.all([
        clientAPI.get(),
        toolAPI.get(),
      ]);
      setClients(Array.isArray(cRes.data) ? cRes.data : []);
      setTools(Array.isArray(tRes.data) ? tRes.data : []);
    } catch (err) {
      console.error('Failed to fetch linked data', err);
    }
  };

  /* Generic field change — recalcs total automatically */
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };

    if (name === 'toolNo') { // tool ID
      const toolObj = tools.find(v => v.number === value);
      if (toolObj) updated.toolCategory = toolObj.category || '';
    }

    updated.totalAmount = calcTotal(updated);
    setFormData(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (formData.clientName && !clients.find(c => c.name.toLowerCase() === formData.clientName.toLowerCase())) {
        await clientAPI.create({ name: formData.clientName, status: 'Active' });
      }
      if (formData.toolNo && !tools.find(t => t.number.toLowerCase() === formData.toolNo.toLowerCase())) {
        await toolAPI.create({ number: formData.toolNo, status: 'Active' });
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

        {/* ── Section 1: Customer & Logistics ── */}
        <div className="form-section">
          <p className="form-section-title">Customer &amp; Logistics</p>
          <div className="form-grid">

            <div className="form-group">
              <label>Customer Name *</label>
              <Autocomplete 
                name="clientName" 
                value={formData.clientName} 
                onChange={handleChange} 
                options={clients.map(c => c.name)}
                placeholder="Customer name"
                required
              />
            </div>

            {/* Tool ID */}
            <div className="form-group">
              <label>Tool ID / Serial</label>
              <Autocomplete 
                name="toolNo" 
                value={formData.toolNo} 
                onChange={handleChange} 
                options={tools.map(t => t.number)}
                placeholder="Tool ID"
              />
            </div>

            {/* Tool Category */}
            <div className="form-group">
              <label>Tool Category</label>
              <select name="toolCategory" value={formData.toolCategory} onChange={handleChange}>
                <option value="">Select Category</option>
                <option value="Power Tools">Power Tools</option>
                <option value="Hand Tools">Hand Tools</option>
                <option value="Heavy Machinery">Heavy Machinery</option>
                <option value="Kitchen">Kitchen / Catering</option>
                <option value="Gardening">Gardening</option>
                <option value="Construction">Construction</option>
                <option value="Other">Other</option>
              </select>
              {formData.toolNo && formData.toolCategory && (
                <span style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', display: 'block' }}>
                  ✓ Auto-filled from tool record
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
            <label>Description of Rental</label>
            <textarea
              name="jobDescription" value={formData.jobDescription}
              onChange={handleChange} rows="2"
              placeholder="e.g. Weekly rental for construction site..."
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
                <option value="Hours">Hours</option>
                <option value="Units">Units</option>
                <option value="Lumpsum">Lumpsum</option>
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
                background: 'var(--accent-soft)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--accent)',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>Units Subtotal ({formData.totalUnits} × LKR {Number(formData.ratePerUnit).toLocaleString()})</span>
                <strong>LKR {subtotal.toLocaleString()}</strong>
              </div>
            )}
          <div className="form-grid" style={{ marginTop: '12px' }}>
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

      </div>

      <div className="hire-form-footer">
        <div className="total-display" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Grand Total
          </span>
          <strong style={{ fontSize: '22px', color: 'var(--accent)' }}>
            LKR {grandTotal.toLocaleString()}
          </strong>
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
