import React, { useEffect, useState } from 'react';
import axios from 'axios';
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

  const { booking, invoice, companyName, itemsBreakdown } = data;
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
  if (Number(booking.discount) > 0) optionalRows.push(['Discount', fmtMoney(booking.discount)]);

  return (
    <div className="public-bill-page">
      <div className="public-bill-card">
        <h1>{companyName || 'MAGGI TOOL RENTALS'}</h1>
        <p className="public-bill-sub">
          Booking Bill{invoice?.invoiceNo ? ` · ${invoice.invoiceNo}` : ''}
        </p>

        <div className="public-bill-meta">
          <p><strong>Customer:</strong> {booking.clientName || '—'}</p>
          <p><strong>Phone:</strong> {booking.clientPhone || '—'}</p>
          <p><strong>Date:</strong> {pickupDate} to {returnDate}</p>
        </div>

        <table className="public-bill-table">
          <thead>
            <tr>
              <th>Item</th>
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
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{fmtMoney(booking.totalAmount)}</td>
            </tr>
            <tr>
              <td>Paid</td>
              <td className="paid">{fmtMoney(booking.advancePayment)}</td>
            </tr>
            <tr>
              <td>Balance Due</td>
              <td className="balance">{fmtMoney(booking.balanceAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="public-bill-contact">Contact Us: 0777778845</p>
      </div>
    </div>
  );
};

export default PublicBillView;
