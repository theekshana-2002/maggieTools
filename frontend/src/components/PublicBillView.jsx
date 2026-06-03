import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Phone, FileText } from 'lucide-react';
import './PublicBillView.css';

const getApiBase = () => {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const raw = import.meta.env.VITE_API_URL || (isLocal ? `http://${window.location.hostname}:5001/api` : '');
  let trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().endsWith('/api')) trimmed += '/';
  else if (!trimmed.toLowerCase().endsWith('/api/')) trimmed = trimmed.replace(/\/+$/, '') + '/api/';
  return trimmed;
};

const fmtMoney = (v) => `LKR ${Number(v || 0).toLocaleString()}`;

const PublicBillView = ({ token }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Invalid bill link.');
      setLoading(false);
      return;
    }

    const apiBase = getApiBase();
    if (!apiBase) {
      setError('Bill service is not configured.');
      setLoading(false);
      return;
    }

    axios
      .get(`${apiBase}bookings/bill/data/${encodeURIComponent(token)}`)
      .then((res) => setData(res.data))
      .catch(() => setError('This bill link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="public-bill-page">
        <div className="public-bill-card">Loading bill...</div>
      </div>
    );
  }

  if (error || !data?.booking) {
    return (
      <div className="public-bill-page">
        <div className="public-bill-card public-bill-error">{error || 'Bill not found.'}</div>
      </div>
    );
  }

  const { booking, invoice, settings, companyName, itemsBreakdown } = data;
  const lines = String(itemsBreakdown || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.replace(/^•\s*/, ''));

  const pickupDate = booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString() : '-';
  const returnDate = booking.returnDate ? new Date(booking.returnDate).toLocaleDateString() : '-';

  const optionalRows = [];
  if (Number(booking.transportCharge) > 0) optionalRows.push(['Transport', fmtMoney(booking.transportCharge)]);
  if (Number(booking.extraCharges) > 0) optionalRows.push(['Other Charges', fmtMoney(booking.extraCharges)]);
  if (Number(booking.securityDeposit ?? booking.deposit) > 0) {
    optionalRows.push(['Deposit', fmtMoney(booking.securityDeposit ?? booking.deposit)]);
  }
  if (Number(booking.discount) > 0) optionalRows.push(['Discount', `-${fmtMoney(booking.discount)}`]);

  const contactPhone = (settings?.phones && settings.phones.length > 0) ? settings.phones[0] : '0777778845';

  return (
    <div className="public-bill-page">
      <div className="public-bill-card">
        
        <div className="public-bill-header">
          <h1>{companyName || 'MAGGI TOOL RENTALS'}</h1>
          <p className="public-bill-contact-info">
            <Phone size={14} /> {contactPhone}
          </p>
        </div>

        <div className="public-bill-meta">
          <div className="public-bill-meta-row">
            <span className="public-bill-meta-label">Invoice No:</span>
            <span className="public-bill-meta-value">{invoice?.invoiceNo || '—'}</span>
          </div>
          <div className="public-bill-meta-row">
            <span className="public-bill-meta-label">Customer:</span>
            <span className="public-bill-meta-value">{booking.clientName || '—'}</span>
          </div>
          <div className="public-bill-meta-row">
            <span className="public-bill-meta-label">Phone:</span>
            <span className="public-bill-meta-value">{booking.clientPhone || '—'}</span>
          </div>
          <div className="public-bill-meta-row">
            <span className="public-bill-meta-label">Rental Period:</span>
            <span className="public-bill-meta-value">{pickupDate} to {returnDate}</span>
          </div>
        </div>

        <div className="public-bill-table-container">
          <table className="public-bill-table">
            <thead>
              <tr>
                <th>Item / Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const [name, amount] = line.split(':').map((p) => p.trim());
                return (
                  <tr key={line}>
                    <td>{name}</td>
                    <td>{amount}</td>
                  </tr>
                );
              })}
              {optionalRows.map(([label, amount]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="public-bill-totals">
          <div className="public-bill-total-row grand-total">
            <span>Grand Total</span>
            <span>{fmtMoney(booking.totalAmount)}</span>
          </div>
          <div className="public-bill-total-row paid">
            <span>Advance / Paid</span>
            <span>{fmtMoney(booking.advancePayment)}</span>
          </div>
          <div className={`public-bill-total-row balance ${(booking.balanceAmount || 0) <= 0 ? 'settled' : ''}`}>
            <span>Balance Due</span>
            <span>{fmtMoney(booking.balanceAmount)}</span>
          </div>
        </div>

        <div className="public-bill-footer">
          {settings?.termsConditions && (
            <div className="public-bill-legal">
              <h4>Terms & Conditions</h4>
              <div style={{ whiteSpace: 'pre-line' }}>{settings.termsConditions}</div>
            </div>
          )}
          {settings?.privacyPolicy && (
            <div className="public-bill-legal">
              <h4>Privacy Policy</h4>
              <div style={{ whiteSpace: 'pre-line' }}>{settings.privacyPolicy}</div>
            </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>
            <p style={{ margin: 0 }}>Thank you for doing business with us!</p>
            <p style={{ margin: '4px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <FileText size={12} /> Digital Receipt
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PublicBillView;
