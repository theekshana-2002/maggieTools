import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../services/api';

// Calculate days rented from pickup to a given return date (inclusive, same-day = 0 charge)
function calcDays(pickupDate, returnDateStr) {
  if (!pickupDate || !returnDateStr) return 0;
  const pickup = new Date(pickupDate);
  pickup.setHours(0, 0, 0, 0);
  const ret = new Date(returnDateStr);
  ret.setHours(0, 0, 0, 0);
  const diff = Math.round((ret - pickup) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 0;
  return diff + 1; // inclusive
}

export default function CheckoutModal({ isOpen, onClose, bookingRecord, accounts, onComplete }) {
  const [itemRows, setItemRows] = useState([]);
  const [accRows, setAccRows] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens with a booking
  useEffect(() => {
    if (isOpen && bookingRecord) {
      const todayStr = new Date().toISOString().split('T')[0];

      const items = (bookingRecord.items || []).map(it => {
        const pendingQty = (it.quantity || 1) - (it.returnedQuantity || 0);
        return {
          id: String(it._id || it.tool || ''),
          name: `${it.toolNumber || ''} - ${it.model || ''}`,
          dailyRate: Number(it.dailyRate) || 0,
          totalQty: it.quantity || 1,
          maxQty: pendingQty,
          returningQty: pendingQty,
          date: todayStr,
        };
      }).filter(it => it.maxQty > 0);

      const accs = (bookingRecord.accessories || []).map(ac => {
        const pendingQty = (ac.quantity || 1) - (ac.returnedQuantity || 0);
        return {
          id: String(ac._id || ac.accessory || ''),
          name: ac.name || '',
          dailyRate: Number(ac.price) || 0,
          totalQty: ac.quantity || 1,
          maxQty: pendingQty,
          returningQty: pendingQty,
          date: todayStr,
        };
      }).filter(ac => ac.maxQty > 0);

      setItemRows(items);
      setAccRows(accs);
      setPaymentAmount(Number(bookingRecord.balanceAmount || 0));
      setPaymentMethod('Cash');
      setAccountId('');
    }
  }, [isOpen, bookingRecord]);

  // ── Live cost calculation ──────────────────────────────────
  const pickupDate = bookingRecord?.pickupDate;
  const originalDays = bookingRecord?.totalDays || 1;

  function rowCost(row) {
    const qty = Number(row.returningQty) || 0;
    if (qty === 0) return 0;
    const days = calcDays(pickupDate, row.date) || originalDays;
    return row.dailyRate * qty * days;
  }

  const itemsTotal = itemRows.reduce((s, r) => s + rowCost(r), 0);
  const accsTotal = accRows.reduce((s, r) => s + rowCost(r), 0);
  const transport = Number(bookingRecord?.transportCharge) || 0;
  const discount = Number(bookingRecord?.discount) || 0;
  const extraCharges = Number(bookingRecord?.extraCharges) || 0;
  const calculatedTotal = Math.max(0, itemsTotal + accsTotal + transport + extraCharges - discount);
  const alreadyPaid = Number(bookingRecord?.advancePayment || 0);
  const remainingBalance = Math.max(0, calculatedTotal - alreadyPaid);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!bookingRecord) return;
    setLoading(true);
    try {
      const payload = {
        returnedItems: itemRows.map(it => ({
          id: it.id,
          quantity: Number(it.returningQty),
          date: it.date,
        })),
        returnedAccessories: accRows.map(ac => ({
          id: ac.id,
          quantity: Number(ac.returningQty),
          date: ac.date,
        })),
        paymentAmount: paymentAmount !== '' ? Number(paymentAmount) : undefined,
        paymentMethod,
        accountId,
      };
      await api.put(`/bookings/${bookingRecord._id}/partial-return`, payload);
      if (onComplete) onComplete();
      onClose();
    } catch (err) {
      alert('Failed to process. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !bookingRecord) return null;

  const cardStyle = {
    background: 'var(--bg-side)',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '14px',
    border: '1px solid var(--border)',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Return & Pay — ${bookingRecord.invoiceNo || bookingRecord.bookingId || 'Booking'}`}>
      <div className="hire-form" style={{ padding: '20px', maxHeight: '85vh', overflowY: 'auto' }}>

        {/* ── Per-item return rows ── */}
        <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-main)' }}>
          Items Being Returned
        </h4>

        {itemRows.length === 0 && accRows.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>All items have already been returned.</p>
        )}

        {itemRows.map((it, idx) => {
          const days = calcDays(pickupDate, it.date) || originalDays;
          const cost = rowCost(it);
          return (
            <div key={it.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{it.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    LKR {it.dailyRate.toLocaleString()} / day &nbsp;•&nbsp; Max pending: {it.maxQty}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
                    LKR {cost.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {it.returningQty} × {days} day{days !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-dim)' }}>Return Date:</label>
                  <input
                    type="date"
                    value={it.date}
                    onChange={e => {
                      const copy = [...itemRows];
                      copy[idx] = { ...copy[idx], date: e.target.value };
                      setItemRows(copy);
                    }}
                    style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-dim)' }}>Qty:</label>
                  <input
                    type="number"
                    min="0"
                    max={it.maxQty}
                    value={it.returningQty}
                    onChange={e => {
                      const v = Math.min(it.maxQty, Math.max(0, Number(e.target.value)));
                      const copy = [...itemRows];
                      copy[idx] = { ...copy[idx], returningQty: v };
                      setItemRows(copy);
                    }}
                    style={{ width: '65px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {accRows.map((ac, idx) => {
          const days = calcDays(pickupDate, ac.date) || originalDays;
          const cost = rowCost(ac);
          return (
            <div key={ac.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>[Acc] {ac.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    LKR {ac.dailyRate.toLocaleString()} / day &nbsp;•&nbsp; Max pending: {ac.maxQty}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
                    LKR {cost.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {ac.returningQty} × {days} day{days !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-dim)' }}>Return Date:</label>
                  <input
                    type="date"
                    value={ac.date}
                    onChange={e => {
                      const copy = [...accRows];
                      copy[idx] = { ...copy[idx], date: e.target.value };
                      setAccRows(copy);
                    }}
                    style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-dim)' }}>Qty:</label>
                  <input
                    type="number"
                    min="0"
                    max={ac.maxQty}
                    value={ac.returningQty}
                    onChange={e => {
                      const v = Math.min(ac.maxQty, Math.max(0, Number(e.target.value)));
                      const copy = [...accRows];
                      copy[idx] = { ...copy[idx], returningQty: v };
                      setAccRows(copy);
                    }}
                    style={{ width: '65px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Bill Summary ── */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '8px', padding: '14px', marginBottom: '14px', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Bill Summary</h4>
          {transport > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Transport:</span>
              <span>LKR {transport.toLocaleString()}</span>
            </div>
          )}
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Discount:</span>
              <span style={{ color: 'var(--success)' }}>− LKR {discount.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: '6px' }}>
            <span>Calculated Total:</span>
            <span style={{ color: 'var(--accent)' }}>LKR {calculatedTotal.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-dim)' }}>Already Paid:</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>LKR {alreadyPaid.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, padding: '8px 0 0 0', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
            <span>Remaining Balance:</span>
            <span style={{ color: remainingBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
              LKR {remainingBalance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ── Collect Payment ── */}
        <div style={{ background: 'var(--success-soft, #f0fdf4)', borderRadius: '8px', padding: '14px', marginBottom: '14px', border: '1px solid var(--success)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--success)' }}>Collect Payment Now</h4>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Amount Collecting (LKR)</label>
              <input
                type="number"
                min="0"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder={`e.g. ${remainingBalance}`}
              />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>
          {paymentMethod === 'Bank Transfer' && (
            <div className="form-group" style={{ marginTop: '8px' }}>
              <label>Deposit to Bank Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">-- Select Bank Account --</option>
                {(accounts || []).map(acc => (
                  <option key={acc._id} value={acc._id}>
                    {acc.accountName} (Balance: LKR {acc.balance?.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}
          {paymentAmount !== '' && Number(paymentAmount) > 0 && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', fontSize: '0.85rem' }}>
              After this payment: Balance = <strong>LKR {Math.max(0, remainingBalance - Number(paymentAmount)).toLocaleString()}</strong>
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '16px', lineHeight: '1.5' }}>
          Booked: {bookingRecord.pickupDate ? new Date(bookingRecord.pickupDate).toLocaleDateString() : '—'} → Expected: {bookingRecord.returnDate ? new Date(bookingRecord.returnDate).toLocaleDateString() : '—'}
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing...' : 'Confirm Return & Pay'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
