import React, { useState, useEffect, useMemo } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import BookingForm from './BookingForm';
import RecordDetails from './RecordDetails';
import { bookingAPI } from '../services/api';
import { generatePDFReport } from '../utils/reportGenerator';
import { Download, Search, PlusCircle, RefreshCw, Filter, Calendar as CalIcon, ChevronRight, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/forms.css';
import '../styles/books.css';

const BookingBook = () => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const tableColumns = ['ID', 'CLIENT', 'VEHICLE', 'PICKUP', 'RETURN', 'DAYS', 'TOTAL', 'STATUS', 'ACTION'];
  
  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await bookingAPI.get();
      const rawData = Array.isArray(response.data) ? response.data : [];
      const formatted = rawData.map((item, index) => ({
        ...item,
        rawData:    item,
        displayId:  `BK-${(index + 1).toString().padStart(3, '0')}`,
        displayPickup: new Date(item.pickupDate).toLocaleDateString(),
        displayReturn: new Date(item.returnDate).toLocaleDateString(),
        displayTotal:  (item.totalAmount || 0).toLocaleString(),
        displayStatus: item.status || 'Confirmed'
      }));
      setBookings(formatted);
      setError(null);
    } catch (err) {
      console.error('RAXWO Bookings: Fetch failed', err);
      const msg = err.response?.data?.message || err.message || 'Connection issue: could not load bookings.';
      setError(`RAXWO Sync Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return bookings.filter(r => {
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchSearch = !searchQuery || 
        r.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.vehicle?.number?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [bookings, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const active = filteredRecords.filter(r => r.status === 'Active').length;
    const revenue = filteredRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    return { total, active, revenue };
  }, [filteredRecords]);

  const handleEdit = (item) => {
    setEditingItem(item.rawData || item);
    setIsModalOpen(true);
  };

  const handleStatusCycle = async (e, record) => {
    e.stopPropagation(); // Don't trigger row click (view details)
    if (!canManage) return;

    const statuses = ['Confirmed', 'Active', 'Completed', 'Cancelled'];
    const currentIdx = statuses.indexOf(record.status || 'Confirmed');
    const nextStatus = statuses[(currentIdx + 1) % statuses.length];

    try {
      setLoading(true);
      await bookingAPI.update(record._id, { status: nextStatus });
      setSuccess(`Status updated to ${nextStatus}`);
      fetchBookings();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Quick update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this booking record?')) {
      try {
        await bookingAPI.delete(id);
        setSuccess('Booking record deleted.');
        fetchBookings();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) { setError('Could not delete record.'); }
    }
  };

  const handleFormSubmit = async (formData) => {
    setLoading(true);
    try {
      if (editingItem && editingItem._id) {
        await bookingAPI.update(editingItem._id, formData);
        setSuccess('Booking updated successfully.');
      } else {
        await bookingAPI.create(formData);
        setSuccess('Booking created successfully.');
      }
      fetchBookings();
      setIsModalOpen(false);
      setEditingItem(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setError(err.response?.data?.message || 'Failed to save booking.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const exportColumns = ['ID', 'CLIENT', 'VEHICLE', 'PICKUP', 'RETURN', 'DAYS', 'TOTAL', 'STATUS'];
    const exportData = filteredRecords.map(r => [r.id, r.clientName, r.vehicle ? `${r.vehicle.number} (${r.vehicle.model})` : '—', r.pickup, r.return, r.days, r.total_disp, r.status]);
    generatePDFReport({ title: 'RAXWO Rent A Car - Bookings Report', columns: exportColumns, data: exportData, filename: `RAXWO_Bookings_${new Date().toISOString().split('T')[0]}.pdf` });
  };

  return (
    <div className="book-container">
      {/* ── Summary ── */}
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Bookings</label>
          <h3>{stats.total}</h3>
          <TrendingUp size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Active Hires</label>
          <h3 style={{ color: 'var(--warning)' }}>{stats.active}</h3>
          <Clock size={16} color="var(--warning)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Gross Revenue</label>
          <h3 style={{ color: 'var(--success)' }}>LKR {stats.revenue.toLocaleString()}</h3>
          <CheckCircle size={16} color="var(--success)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="book-filters">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input type="text" placeholder="Search client or vehicle..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        
        <div className="filter-actions">
           <div className="tab-switcher" style={{ margin: 0 }}>
              {['All', 'Confirmed', 'Active', 'Completed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'active-tab' : ''}>
                  {s}
                </button>
              ))}
           </div>
           <button className="theme-toggle-btn" onClick={fetchBookings} title="Refresh">
              <RefreshCw size={18} className={loading ? 'spinner' : ''} />
           </button>
           <button className="theme-toggle-btn" onClick={handleExportPDF} title="Export PDF">
              <Download size={18} />
           </button>
           {canManage && (
              <button className="refresh-btn" onClick={() => { setEditingItem(null); setIsModalOpen(true); }} style={{ height: '48px', padding: '0 24px' }}>
                <PlusCircle size={18} /> New Booking
              </button>
           )}
        </div>
      </div>

      {success && <div className="form-info-banner" style={{ background: 'var(--success)', color: '#fff', border: 'none' }}><CheckCircle size={18} /> {success}</div>}
      {error && <div className="form-info-banner" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}><AlertCircle size={18} /> {error}</div>}

      <div className="compliance-card">
        <DataTable 
          columns={tableColumns} 
          data={filteredRecords.map(r => ({
            ...r,
            ID: <span style={{ fontWeight: 800, color: 'var(--text-dim)' }}>{r.displayId}</span>,
            CLIENT: <strong style={{ color: 'var(--text-main)' }}>{r.clientName || '—'}</strong>,
            VEHICLE: r.vehicle ? <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{r.vehicle.number}</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.vehicle.model}</span></div> : '—',
            PICKUP: r.displayPickup,
            RETURN: r.displayReturn,
            DAYS: <span className="status-badge status-confirmed" style={{ background: 'var(--bg-side)', color: 'var(--text-main)' }}>{r.totalDays || 1} Days</span>,
            TOTAL: <strong style={{ color: 'var(--accent)' }}>LKR {r.displayTotal}</strong>,
            STATUS: (
              <span 
                className={`status-badge status-${r.displayStatus.toLowerCase()}`} 
                onClick={(e) => handleStatusCycle(e, r)}
                style={{ cursor: canManage ? 'pointer' : 'default', userSelect: 'none' }}
                title={canManage ? "Click to cycle status" : ""}
              >
                {r.displayStatus}
              </span>
            ),
            ACTION: (
              <div className="table-actions" onClick={e => e.stopPropagation()}>
                {canManage && <button className="edit-btn" onClick={() => handleEdit(r)}>Edit</button>}
                {canManage && <button className="delete-btn" onClick={() => handleDelete(r._id)}>Delete</button>}
              </div>
            )
          }))}
          loading={loading} 
          onRowClick={(record) => { setSelectedRecord(record.rawData || record); setViewModalOpen(true); }} 
        />
      </div>

      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Booking Details">
        <RecordDetails data={selectedRecord} type="booking" />
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
        title={editingItem ? 'Edit Booking' : 'New Vehicle Booking'}
        wide={true}
      >
        <BookingForm onSubmit={handleFormSubmit} onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} initialData={editingItem} />
      </Modal>
    </div>
  );
};

export default BookingBook;
