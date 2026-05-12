import React, { useState, useEffect, useMemo } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import BookingForm from './BookingForm';
import RecordDetails from './RecordDetails';
import { bookingAPI } from '../services/api';
import { generatePDFReport } from '../utils/reportGenerator';
import { Download, Search, PlusCircle, RefreshCw, Filter, Calendar as CalIcon, ChevronRight, TrendingUp, Clock, CheckCircle, AlertCircle, Package, Bell, MessageCircle, Trash2 } from 'lucide-react';
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
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnRecord, setReturnRecord] = useState(null);

  const tableColumns = ['ID', 'CUSTOMER', 'TOOL', 'PICKUP', 'RETURN', 'DAYS', 'TOTAL', 'BALANCE', 'STATUS', 'ACTION'];
  
  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await bookingAPI.get();
      const rawData = Array.isArray(response.data) ? response.data : [];
      const formatted = rawData.map((item, index) => {
        let toolsLabel = '—';
        if (item.items && item.items.length > 0) {
          toolsLabel = item.items.length === 1 
            ? item.items[0].toolNumber 
            : `${item.items.length} Tools (${item.items.map(it => it.toolNumber).join(', ')})`;
        } else if (item.tool) {
          toolsLabel = typeof item.tool === 'object' ? item.tool.number : 'Tool';
        }

        return {
          ...item,
          rawData:      item,
          displayId:    item.bookingId || `BK-${(index + 1).toString().padStart(3, '0')}`,
          clientName:   item.clientName,
          displayTool:  toolsLabel,
          displayPickup: new Date(item.pickupDate).toLocaleDateString(),
          displayReturn: new Date(item.returnDate).toLocaleDateString(),
          totalDays:    item.totalDays || 1,
          displayTotal: (item.totalAmount || 0).toLocaleString(),
          displayStatus: item.status || 'Confirmed'
        };
      });
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
        r.tool?.number?.toLowerCase().includes(searchQuery.toLowerCase());
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
    e.stopPropagation();
    if (!canManage) return;

    const statuses = ['Confirmed', 'Active', 'Returned', 'Cancelled'];
    const currentIdx = statuses.indexOf(record.status || 'Confirmed');
    const nextStatus = statuses[(currentIdx + 1) % statuses.length];

    if (nextStatus === 'Returned') {
        setReturnRecord(record);
        setReturnDate(new Date().toISOString().split('T')[0]);
        setReturnModalOpen(true);
        return;
    }

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

  const handleNotify = async (e, record) => {
    e.stopPropagation();
    if (!record.clientPhone) return alert('No phone number found for this customer.');
    
    setLoading(true);
    try {
      await bookingAPI.sendReminder(record._id);
      setSuccess(`SMS Reminder sent to ${record.clientName}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to send SMS reminder.');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = (e, record) => {
    e.stopPropagation();
    if (!record.clientPhone) return alert('No phone number found.');
    
    const phone = record.clientPhone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Reminder from DVD Tool Rentals: Dear ${record.clientName}, your rental of ${record.tool ? record.tool.number : 'Tool'} is due on ${new Date(record.returnDate).toLocaleDateString()}. Please ensure timely return to avoid extra charges.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleReturnSubmit = async () => {
    if (!returnRecord) return;
    setLoading(true);
    try {
      const actualDate = new Date(returnDate);
      const expectedDate = new Date(returnRecord.returnDate);
      
      let extraDays = 0;
      let extraCharges = 0;
      
      if (actualDate > expectedDate) {
        const diffTime = Math.abs(actualDate - expectedDate);
        extraDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        extraCharges = extraDays * (returnRecord.dailyRate || 0);
      }

      await bookingAPI.update(returnRecord._id, { 
        status: 'Returned', 
        actualReturnDate: returnDate,
        extraCharges,
        totalAfterExtra: (returnRecord.totalAmount || 0) + extraCharges,
        balanceAmount: (returnRecord.balanceAmount || 0) + extraCharges
      });
      
      setSuccess(`Tool Returned. ${extraDays > 0 ? `LKR ${extraCharges.toLocaleString()} extra added for ${extraDays} days.` : 'No extra charges.'}`);
      setReturnModalOpen(false);
      fetchBookings();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError('Failed to process return.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    setLoading(true);
    try {
      if (Array.isArray(formData)) {
        await bookingAPI.bulkCreate(formData);
        setSuccess(`${formData.length} tools booked successfully.`);
      } else if (editingItem && editingItem._id) {
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
    const exportColumns = ['ID', 'CUSTOMER', 'TOOL', 'PICKUP', 'RETURN', 'DAYS', 'TOTAL', 'STATUS'];
    const exportData = filteredRecords.map(r => [r.id, r.clientName, r.tool ? `${r.tool.number} (${r.tool.model})` : '—', r.pickup, r.return, r.days, r.total_disp, r.status]);
    generatePDFReport({ title: 'RAXWO - Tool Reservations Report', columns: exportColumns, data: exportData, filename: `RAXWO_Reservations_${new Date().toISOString().split('T')[0]}.pdf` });
  };

  return (
    <div className="book-container">
      {/* ── Summary ── */}
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Reservations</label>
          <h3>{stats.total}</h3>
          <TrendingUp size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Tools in Use</label>
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
          <input type="text" placeholder="Search customer or tool ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        
        <div className="filter-actions">
           <div className="tab-switcher" style={{ margin: 0 }}>
              {['All', 'Confirmed', 'Active', 'Returned', 'Cancelled'].map(s => (
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
                <PlusCircle size={18} /> New Tool Booking
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
            CUSTOMER: <strong style={{ color: 'var(--text-main)' }}>{r.clientName || '—'}</strong>,
            TOOL: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.displayTool}</span>,
            PICKUP: r.displayPickup,
            RETURN: r.displayReturn,
            DAYS: <span className="status-badge status-confirmed" style={{ background: 'var(--bg-side)', color: 'var(--text-main)' }}>{r.totalDays || 1} Days</span>,
            TOTAL: <strong style={{ color: 'var(--accent)' }}>LKR {r.displayTotal}</strong>,
            BALANCE: <strong style={{ color: (r.balanceAmount || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {(r.balanceAmount || 0).toLocaleString()}</strong>,
            STATUS: (
              <span 
                className={`status-badge status-${(r.displayStatus || 'Confirmed').toLowerCase()}`} 
                onClick={(e) => handleStatusCycle(e, r)}
                style={{ cursor: canManage ? 'pointer' : 'default', userSelect: 'none' }}
                title={canManage ? "Click to cycle status" : ""}
              >
                {r.displayStatus}
              </span>
            ),
            ACTION: (
              <div className="table-actions" onClick={e => e.stopPropagation()}>
                {canManage && r.displayStatus === 'Active' && (
                  <button 
                    className="edit-btn" 
                    style={{ background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success)' }}
                    onClick={(e) => { e.stopPropagation(); setReturnRecord(r.rawData || r); setReturnDate(new Date().toISOString().split('T')[0]); setReturnModalOpen(true); }}
                  >
                    Mark Returned
                  </button>
                )}
                <div className="table-actions" style={{ gap: '6px' }}>
                  <button className="edit-btn" onClick={() => handleEdit(r)} title="Edit Booking"><PlusCircle size={14} /></button>
                  <button className="edit-btn" style={{ background: '#0EA5E9' }} onClick={(e) => handleNotify(e, r)} title="Send SMS Reminder"><Bell size={14} /></button>
                  <button className="edit-btn" style={{ background: '#25D366' }} onClick={(e) => handleWhatsApp(e, r)} title="Send WhatsApp Reminder"><MessageCircle size={14} /></button>
                  {canManage && <button className="delete-btn" onClick={() => handleDelete(r._id)} title="Delete"><Trash2 size={14} /></button>}
                </div>
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

      <Modal isOpen={returnModalOpen} onClose={() => setReturnModalOpen(false)} title="Process Tool Return">
        <div className="hire-form" style={{ padding: '20px' }}>
          <div className="form-group">
            <label>Actual Return Date</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
          </div>
          <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-side)', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>
              Expected: <strong>{returnRecord ? new Date(returnRecord.returnDate).toLocaleDateString() : ''}</strong>
            </p>
            {returnRecord && new Date(returnDate) > new Date(returnRecord.returnDate) && (
              <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                Late by {Math.ceil(Math.abs(new Date(returnDate) - new Date(returnRecord.returnDate)) / (1000 * 60 * 60 * 24))} Days!
                <br />
                Extra Charge: LKR {(Math.ceil(Math.abs(new Date(returnDate) - new Date(returnRecord.returnDate)) / (1000 * 60 * 60 * 24)) * (returnRecord.dailyRate || 0)).toLocaleString()}
              </div>
            )}
          </div>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button className="cancel-btn" onClick={() => setReturnModalOpen(false)}>Cancel</button>
            <button className="submit-btn" onClick={handleReturnSubmit}>Confirm Return</button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
        title={editingItem ? 'Edit Booking' : 'New Tool Booking'}
        wide={true}
      >
        <BookingForm onSubmit={handleFormSubmit} onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} initialData={editingItem} />
      </Modal>
    </div>
  );
};

export default BookingBook;
