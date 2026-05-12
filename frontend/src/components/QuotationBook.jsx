import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from './DataTable';
import Modal from './Modal';
import RecordDetails from './RecordDetails';
import QuotationForm from './QuotationForm';
import { FileCheck, Plus, Download, Trash2, Search, RefreshCw, FileDown, PlusCircle } from 'lucide-react';
import { generateQuotationPDF } from '../utils/billingGenerator';
import { generatePDFReport } from '../utils/reportGenerator';
import '../styles/forms.css';
import '../styles/books.css';

const DEFAULT_TERMS = `1. Prices are exclusive of any taxes unless mentioned.
2. Payment must be made as per agreed terms.
3. We are not responsible for any delays due to site access issues.`;

const QuotationBook = () => {
  const [quotations, setQuotations] = useState([]);
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const userRole = localStorage.getItem('raxwo_user_role');
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchQuotations(); }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations');
      const raw = Array.isArray(res.data) ? res.data : [];
      setQuotations(raw.map(quote => ({
        ...quote,
        rawData: quote,
        validity_disp: `${quote.validityDays || 30} Days`,
        total_disp: `LKR ${(quote.estimatedTotal || 0).toLocaleString()}`,
        status_disp: (
          <span className={`status-badge ${quote.status === 'Accepted' ? 'status-active' : quote.status === 'Closed' ? 'status-inactive' : quote.status === 'Open' ? 'status-pending' : ''}`}>
            {quote.status || 'Open'}
          </span>
        ),
        action: (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            <button className="edit-btn" style={{ background: 'var(--accent-soft)', color:'var(--accent)', border: '1px solid var(--accent-soft)' }} onClick={() => generateQuotationPDF(quote)} title="Download PDF">
               <FileDown size={14} /> PDF
            </button>
            {canManage && <button className="edit-btn" onClick={() => handleEdit(quote)}>Edit</button>}
            {canManage && <button className="delete-btn" onClick={() => handleDelete(quote._id)}>Delete</button>}
          </div>
        )
      })));
    } catch { alert('Error fetching quotations'); }
    finally { setLoading(false); }
  };

  const handleEdit = (item) => {
    const target = item.rawData || item;
    setEditingItem(target);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (editingItem) {
        await api.put(`/quotations/${editingItem._id}`, data);
      } else {
        await api.post('/quotations', data);
      }
      setShowModal(false);
      setEditingItem(null);
      fetchQuotations();
    } catch { alert('Error saving quotation'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this quotation?')) {
      await api.delete(`/quotations/${id}`);
      fetchQuotations();
    }
  };

  const handleRowClick = (record) => {
    setSelectedRecord(record.rawData || record);
    setIsDetailsOpen(true);
  };

  const handleExportFullReport = () => {
    const columns = ['QUOTE#', 'DATE', 'CUSTOMER', 'VALIDITY', 'EST. TOTAL', 'STATUS'];
    const data = filtered.map(q => [
      q.quotationNo || '—',
      new Date(q.date).toLocaleDateString(),
      q.clientName,
      `${q.validityDays} Days`,
      `Rs. ${q.estimatedTotal?.toLocaleString()}`,
      q.status
    ]);
    generatePDFReport({
      title: 'Quotations Summary Report',
      columns,
      data,
      filename: `Quotations_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
  };

  const filtered = quotations.filter(q =>
    (q.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.quotationNo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: quotations.length,
    activeCount: quotations.filter(q => q.status === 'Open' || q.status === 'Accepted').length,
    totalPotentialRevenue: quotations.reduce((sum, q) => sum + (q.estimatedTotal || 0), 0)
  };

  return (
    <div className="book-container">
      
      <div className="dashboard-header">
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sales & Proposals</p>
          <h1>Service Quotations</h1>
        </div>
        <div className="header-controls">
           <div className="search-box">
             <Search className="search-icon" size={18} />
             <input type="text" placeholder="Search quotes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <button className="theme-toggle-btn" onClick={fetchQuotations} title="Refresh"><RefreshCw size={18} className={loading ? 'spinner' : ''} /></button>
           {canManage && (
             <button className="refresh-btn" onClick={handleAddNew} style={{ height: '48px', padding: '0 24px' }}>
               <PlusCircle size={18} /> New Quotation
             </button>
           )}
        </div>
      </div>

      <div className="book-summary">
        <div className="summary-item">
          <label>TOTAL QUOTES</label>
          <h3>{stats.total} Records</h3>
        </div>
        <div className="summary-item">
          <label>ACTIVE / OPEN</label>
          <h3 style={{ color: 'var(--warning)' }}>{stats.activeCount} Open</h3>
        </div>
        <div className="summary-item" style={{ borderRight: 'none' }}>
          <label>POTENTIAL REVENUE</label>
          <h3 style={{ color: 'var(--accent)' }}>LKR {stats.totalPotentialRevenue.toLocaleString()}</h3>
        </div>
      </div>

      <div className="compliance-card">
        <DataTable 
          columns={['QUOTE#', 'DATE', 'CUSTOMER', 'VALIDITY', 'EST. TOTAL', 'STATUS', 'ACTION']}
          data={filtered}
          loading={loading}
          onRowClick={handleRowClick}
          emptyMessage="No quotations found."
        />
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingItem(null); }} 
        title={editingItem ? "Edit Quotation" : "Generate New Quotation"}
      >
        <QuotationForm 
          onSubmit={handleSubmit} 
          onCancel={() => { setShowModal(false); setEditingItem(null); }} 
          initialData={editingItem} 
        />
      </Modal>

      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Quotation Details">
        {selectedRecord && <RecordDetails data={selectedRecord} type="quotation" />}
      </Modal>

    </div>
  );
};

export default QuotationBook;
