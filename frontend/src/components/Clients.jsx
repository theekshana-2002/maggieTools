import React, { useState, useEffect, useMemo } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import ClientForm from './ClientForm';
import { clientAPI } from '../services/api';
import { generatePDFReport } from '../utils/reportGenerator';
import { Download, Search, RefreshCw, PlusCircle, Users, CheckCircle, TrendingUp, Clock, UserCheck, Phone, AlertCircle } from 'lucide-react';
import '../styles/forms.css';
import '../styles/books.css';
import RecordDetails from './RecordDetails';

const Clients = () => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [clientRecords, setClientRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const columns = ['CLIENT NAME', 'CONTACT', 'TOTAL HIRES', 'OUTSTANDING', 'STATUS', 'ACTION'];

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await clientAPI.get();
      const formatted = (response.data || []).map(item => ({
        ...item,
        rawData: item,
        name_disp: <strong style={{ color: 'var(--text-main)' }}>{item.name || '—'}</strong>,
        contact_disp: <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} color="var(--text-dim)" /> {item.contact || '—'}</div>,
        hires_disp: <span className="status-badge status-confirmed" style={{ background: 'var(--bg-side)', color: 'var(--text-main)' }}>{item.totalHires || 0} Hires</span>,
        outstanding_disp: <strong style={{ color: (item.outstanding || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {(item.outstanding || 0).toLocaleString()}</strong>,
        status_disp: (
          <span className={`status-badge ${item.status === 'Active' ? 'status-completed' : 'status-cancelled'}`}>
            {item.status || 'Active'}
          </span>
        ),
        action: canManage ? (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            <button className="edit-btn" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>Edit</button>
          </div>
        ) : null
      }));
      setClientRecords(formatted);
      setError(null);
    } catch (err) {
      console.error('RAXWO Clients: Fetch failed', err);
      setError('Could not load client records.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return clientRecords.filter(r => !searchQuery || (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (r.contact || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [clientRecords, searchQuery]);

  const stats = useMemo(() => ({
    total: clientRecords.length,
    active: clientRecords.filter(c => c.status === 'Active').length,
    outstanding: clientRecords.reduce((sum, c) => sum + (c.outstanding || 0), 0)
  }), [clientRecords]);

  return (
    <div className="book-container">
      {/* ── Header ── */}
      <div className="dashboard-header">
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Customer Relations</p>
          <h1>Client Directory</h1>
        </div>
        <div className="header-controls">
           <div className="search-box">
             <Search className="search-icon" size={18} />
             <input type="text" placeholder="Search by name or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
           </div>
           <button className="theme-toggle-btn" onClick={fetchRecords} title="Refresh"><RefreshCw size={18} className={loading ? 'spinner' : ''} /></button>
           {canManage && (
             <button className="refresh-btn" onClick={() => { setEditingItem(null); setIsModalOpen(true); }} style={{ height: '48px', padding: '0 24px' }}>
               <PlusCircle size={18} /> Add Client
             </button>
           )}
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Clients</label>
          <h3>{stats.total} Records</h3>
          <Users size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Active Accounts</label>
          <h3 style={{ color: 'var(--success)' }}>{stats.active} Active</h3>
          <UserCheck size={16} color="var(--success)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Net Outstanding</label>
          <h3 style={{ color: 'var(--danger)' }}>LKR {stats.outstanding.toLocaleString()}</h3>
          <TrendingUp size={16} color="var(--danger)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
      </div>

      {error && <div className="form-info-banner" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}><AlertCircle size={18} /> {error}</div>}

      <div className="compliance-card">
        <DataTable columns={columns} data={filteredRecords} loading={loading} onRowClick={(row) => { setSelectedRecord(row); setViewModalOpen(true); }} />
      </div>

      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Client Profile">
        <RecordDetails data={selectedRecord} type="client" />
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? 'Edit Client' : 'Add New Client'}>
        <ClientForm onSubmit={async (d) => { if (editingItem) await clientAPI.update(editingItem._id, d); else await clientAPI.create(d); setIsModalOpen(false); fetchRecords(); }} onCancel={() => setIsModalOpen(false)} initialData={editingItem} />
      </Modal>
    </div>
  );
};

export default Clients;
