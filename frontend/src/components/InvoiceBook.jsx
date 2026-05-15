import React, { useState, useEffect, useMemo } from 'react';
import api, { invoiceAPI } from '../services/api';
import DataTable from './DataTable';
import Modal from './Modal';
import RecordDetails from './RecordDetails';
import InvoiceForm from './InvoiceForm';
import { FileText, Plus, Download, Trash2, Search, RefreshCw, FileDown, TrendingUp, CheckCircle, Clock, CreditCard, PlusCircle, Printer } from 'lucide-react';
import { generateInvoicePDF } from '../utils/billingGenerator';
import { generatePDFReport } from '../utils/reportGenerator';
import '../styles/forms.css';
import '../styles/books.css';

const InvoiceBook = () => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { fetchInvoices(); }, []);

  const handleMarkAsPaid = async (id) => {
    if (window.confirm('Mark this invoice as fully paid? This will update the balance to zero.')) {
      try {
        await invoiceAPI.pay(id);
        setSuccessMsg('Invoice marked as Paid!');
        fetchInvoices();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        alert('Failed to update invoice status.');
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this invoice? This cannot be undone.')) {
      try {
        await api.delete(`invoices/${id}`);
        fetchInvoices();
      } catch (err) {
        alert('Failed to delete invoice.');
      }
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('invoices');
      const raw = Array.isArray(res.data) ? res.data : [];
      setInvoices(raw.map(inv => {
        const total = inv.totalAmount || 0;
        const balance = inv.balanceAmount !== undefined ? inv.balanceAmount : total;
        
        return {
          ...inv,
          rawData: inv,
          invoiceNo_disp: <strong style={{ color: 'var(--text-main)' }}>{inv.invoiceNo}</strong>,
          date_disp: new Date(inv.date).toLocaleDateString(),
          TOTAL: <strong style={{ color: 'var(--accent)' }}>LKR {total.toLocaleString()}</strong>,
          BALANCE: <strong style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {balance.toLocaleString()}</strong>,
          status_disp: (
            <span className={`status-badge ${inv.status === 'Paid' ? 'status-completed' : inv.status === 'Cancelled' ? 'status-cancelled' : 'status-active'}`}>
              {inv.status || 'Draft'}
            </span>
          ),
          action: (
            <div className="table-actions" onClick={e => e.stopPropagation()}>
              <button className="action-icon-btn btn-print" onClick={() => generateInvoicePDF(inv)} title="Download PDF">
                 <FileDown />
              </button>
              <button className="action-icon-btn btn-details" style={{ background: '#64748b', color:'#fff' }} onClick={() => generateInvoicePDF(inv, 'print')} title="Direct Print">
                 <Printer />
              </button>
              {canManage && (
                <>
                  <button className="action-icon-btn btn-details" onClick={() => { setEditingItem(inv); setShowModal(true); }} title="Edit Invoice">
                    <FileText />
                  </button>
                  {inv.status !== 'Paid' && (
                    <button className="action-icon-btn btn-msg" onClick={() => handleMarkAsPaid(inv._id)} title="Mark as Paid">
                      <CheckCircle />
                    </button>
                  )}
                  <button className="action-icon-btn btn-delete" onClick={() => handleDelete(inv._id)} title="Delete Invoice">
                    <Trash2 />
                  </button>
                </>
              )}
            </div>
          )
        };
      }));
    } catch (err) { console.error('RAXWO Invoices: Fetch failed', err); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return invoices.filter(inv =>
      (inv.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.invoiceNo  || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.site       || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm]);

  const stats = useMemo(() => ({
    total: invoices.length,
    pending: invoices.filter(i => i.status !== 'Paid').length,
    revenue: invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0)
  }), [invoices]);

  return (
    <div className="book-container">
      {/* ── Header ── */}
      <div className="dashboard-header">
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Billing & Receivables</p>
          <h1>Customer Invoices</h1>
        </div>
        <div className="header-controls">
           <div className="search-box">
             <Search className="search-icon" size={18} />
             <input type="text" placeholder="Search invoices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <button className="theme-toggle-btn" onClick={fetchInvoices} title="Refresh"><RefreshCw size={18} className={loading ? 'spinner' : ''} /></button>
           {canManage && (
             <button className="refresh-btn" onClick={() => { setEditingItem(null); setShowModal(true); }} style={{ height: '48px', padding: '0 24px' }}>
               <PlusCircle size={18} /> New Invoice
             </button>
           )}
        </div>
      </div>
 
      {/* ── Summary ── */}
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Billed</label>
          <h3>LKR {stats.revenue.toLocaleString()}</h3>
          <TrendingUp size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Pending Payments</label>
          <h3 style={{ color: 'var(--warning)' }}>{stats.pending} Invoices</h3>
          <Clock size={16} color="var(--warning)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Verified Paid</label>
          <h3 style={{ color: 'var(--success)' }}>{stats.total - stats.pending} Records</h3>
          <CheckCircle size={16} color="var(--success)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
      </div>
 
      {successMsg && <div className="success-banner" style={{ margin: '0 20px 20px' }}>{successMsg}</div>}

      <div className="compliance-card">
        <DataTable 
          columns={['INV#', 'DATE', 'CLIENT', 'TOTAL', 'BALANCE', 'STATUS', 'ACTION']}
          data={filtered}
          loading={loading}
          onRowClick={(r) => { setSelectedRecord(r.rawData || r); setIsDetailsOpen(true); }}
        />
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? "Edit Invoice" : "Generate New Invoice"}>
        <InvoiceForm onSubmit={async (d) => { if (editingItem) await api.put(`/invoices/${editingItem._id}`, d); else await api.post('/invoices', d); setShowModal(false); fetchInvoices(); }} onCancel={() => setShowModal(false)} initialData={editingItem} />
      </Modal>

      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Invoice Transaction Details">
        <RecordDetails data={selectedRecord} type="invoice" />
      </Modal>
    </div>
  );
};

export default InvoiceBook;
