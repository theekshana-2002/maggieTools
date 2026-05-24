import React, { useState, useEffect, useMemo } from 'react';
import DataTable from './DataTable';
import { Edit } from "lucide-react";
import Modal from './Modal';
import BookingForm from './BookingForm';
import RecordDetails from './RecordDetails';
import { bookingAPI, clientAPI } from '../services/api';
import { generatePDFReport, generateInvoicePDF } from '../utils/reportGenerator';
import { generateGenericReportPDF } from '../utils/genericReportGenerator';
import { Download, Search, PlusCircle, RefreshCw, Filter, Calendar as CalIcon, ChevronRight, TrendingUp, Clock, CheckCircle, AlertCircle, Package, Bell, MessageCircle, Trash2, Printer, FileText, UserPlus, Users, X, DollarSign, Send } from 'lucide-react';
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
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnRecord, setReturnRecord] = useState(null);

  // Client lookup state (merged with main search)
  const [allClients, setAllClients] = useState([]);
  const [clientDetails, setClientDetails] = useState(null);
  const [clientPanelOpen, setClientPanelOpen] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Add client modal
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contact: '', nic: '' });

  // Custom SMS modal
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsRecord, setSmsRecord] = useState(null);
  const [customSmsText, setCustomSmsText] = useState('');

  const handlePrint = (booking) => {
    generateInvoicePDF(booking, 'invoice');
  };

  const handlePrintQuote = (booking) => {
    generateInvoicePDF(booking, 'quotation');
  };

  const tableColumns = ['ID', 'CUSTOMER', 'TOOL', 'PICKUP', 'RETURN', 'DAYS', 'TOTAL', 'BALANCE', 'STATUS', 'ACTION'];

  useEffect(() => { 
    fetchBookings(); 
    fetchAllClients();
  }, []);

  const fetchAllClients = async () => {
    try {
      const res = await clientAPI.get();
      setAllClients(res.data || []);
    } catch (err) {
      console.error('Failed to fetch clients');
    }
  };

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
          rawData: item,
          displayId: item.bookingId || `BK-${(index + 1).toString().padStart(3, '0')}`,
          clientName: item.clientName,
          displayTool: toolsLabel,
          displayPickup: new Date(item.pickupDate).toLocaleDateString(),
          displayReturn: new Date(item.returnDate).toLocaleDateString(),
          totalDays: item.totalDays || 1,
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
      
      let matchPayment = true;
      if (paymentFilter === 'Paid') {
        matchPayment = (r.balanceAmount || 0) <= 0;
      } else if (paymentFilter === 'Unpaid') {
        matchPayment = (r.balanceAmount || 0) > 0;
      }

      const search = searchQuery.toLowerCase().trim();
      if (!search) return matchStatus && matchPayment;

      const matchSearch =
        r.clientName?.toLowerCase().includes(search) ||
        r.displayTool?.toLowerCase().includes(search) ||
        r.bookingId?.toLowerCase().includes(search) ||
        (r.items && r.items.some(it => it.toolNumber?.toLowerCase().includes(search)));

      return matchStatus && matchPayment && matchSearch;
    });
  }, [bookings, statusFilter, paymentFilter, searchQuery]);

  // Unified search handler: filters bookings + looks up client profile
  const handleUnifiedSearch = async (value) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);

    if (!value.trim()) {
      setClientDetails(null);
      setClientPanelOpen(false);
      return;
    }

    // Check if the query matches an exact client name
    const matched = allClients.find(
      c => c.name?.toLowerCase() === value.toLowerCase().trim()
    );

    if (matched) {
      setLoadingClient(true);
      try {
        const res = await bookingAPI.getClientDetails(matched.name);
        setClientDetails(res.data);
        setClientPanelOpen(true);
      } catch (err) {
        setClientPanelOpen(false);
      } finally {
        setLoadingClient(false);
      }
    } else {
      setClientDetails(null);
      setClientPanelOpen(false);
    }
  };

  const handleSuggestionSelect = (name) => {
    handleUnifiedSearch(name);
    setShowSuggestions(false);
  };

  const handleAddClientSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clientAPI.create({ ...newClient, status: 'Active' });
      setSuccess('Client added successfully');
      setAddClientOpen(false);
      fetchAllClients();
      setNewClient({ name: '', contact: '', nic: '' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFollowups = async () => {
    if (!window.confirm('Process automated follow-up SMS for overdue bookings?')) return;
    setLoading(true);
    try {
      const res = await bookingAPI.processFollowups();
      setSuccess(res.data.message);
      fetchBookings();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to process follow-ups');
    } finally {
      setLoading(false);
    }
  };

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
    setSmsRecord(record);
    setCustomSmsText('');
    setSmsModalOpen(true);
  };

  const handleSmsSubmit = async () => {
    if (!smsRecord) return;
    setLoading(true);
    try {
      await bookingAPI.sendReminder(smsRecord._id, customSmsText);
      setSuccess(`SMS sent to ${smsRecord.clientName}`);
      setSmsModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to send SMS.');
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
    generateGenericReportPDF('Tool Reservations Report', ['ID', 'CUSTOMER', 'TOOL', 'PICKUP', 'RETURN', 'DAYS', 'TOTAL', 'STATUS'], filteredRecords);
  };

  // Filtered suggestions for autocomplete dropdown
  const clientSuggestions = useMemo(() => {
    if (!searchQuery.trim() || !showSuggestions) return [];
    const q = searchQuery.toLowerCase();
    return allClients
      .filter(c => c.name?.toLowerCase().includes(q))
      .slice(0, 6)
      .map(c => c.name);
  }, [searchQuery, allClients, showSuggestions]);

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

      {/* ── Unified Filters & Search Bar ── */}
      <div className="book-filters">
        {/* ─ Row 1: Search + Action Buttons ─ */}
        <div className="bf-top-row">
          <div className="search-box-unified" style={{ position: 'relative' }}>
            {loadingClient
              ? <RefreshCw className="search-icon spinner" size={18} />
              : <Search className="search-icon" size={18} />}
            <input
              type="text"
              placeholder="Search by customer name, tool ID, booking ID..."
              value={searchQuery}
              onChange={e => handleUnifiedSearch(e.target.value)}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => { setSearchQuery(''); setClientDetails(null); setClientPanelOpen(false); setShowSuggestions(false); }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
            {/* Autocomplete dropdown */}
            {showSuggestions && clientSuggestions.length > 0 && (
              <ul className="search-suggestions">
                {clientSuggestions.map(name => (
                  <li key={name} onMouseDown={() => handleSuggestionSelect(name)}>
                    <Users size={14} />
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bf-action-btns">
            {canManage && (
              <button className="add-btn" onClick={() => setAddClientOpen(true)}>
                <UserPlus size={18} /> Add Customer
              </button>
            )}
            <button className="utility-icon-btn" onClick={handleProcessFollowups} title="Process 14-Day SMS Follow-ups">
              <Send size={18} />
            </button>
            <button className="utility-icon-btn" onClick={fetchBookings} title="Refresh">
              <RefreshCw size={20} className={loading ? 'spinner' : ''} />
            </button>
            <button className="utility-icon-btn" onClick={handleExportPDF} title="Export PDF">
              <Download size={20} />
            </button>
            {canManage && (
              <button className="add-btn" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
                <PlusCircle size={20} /> New Booking
              </button>
            )}
          </div>
        </div>

        {/* ─ Row 2: Status & Payment Tabs ─ */}
        <div className="bf-tabs-row">
          <div className="tab-switcher" style={{ margin: 0 }}>
            {['All', 'Confirmed', 'Active', 'Returned', 'Cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'active-tab' : ''}>
                {s}
              </button>
            ))}
          </div>
          <div className="tab-switcher" style={{ margin: 0 }}>
            {['All', 'Paid', 'Unpaid'].map(s => (
              <button key={s} onClick={() => setPaymentFilter(s)} className={paymentFilter === s ? 'active-tab' : ''}>
                {s === 'All' ? 'All Payments' : s}
              </button>
            ))}
          </div>
        </div>

        {/* ─ Client Profile Card (shown when name matches) ─ */}
        {clientDetails && clientPanelOpen && (
          <div className="client-profile-inline">
            <div className="cpi-info">
              <div className="cpi-avatar">{clientDetails.client.name?.charAt(0).toUpperCase()}</div>
              <div>
                <div className="cpi-name">{clientDetails.client.name}</div>
                <div className="cpi-meta">{clientDetails.client.contact}{clientDetails.client.nic ? ` · ${clientDetails.client.nic}` : ''}</div>
              </div>
            </div>
            <div className="cpi-stats">
              <div className="cpi-stat">
                <span className="cpi-stat-label">Total Bookings</span>
                <span className="cpi-stat-value accent">{clientDetails.summary.totalBookings}</span>
              </div>
              <div className="cpi-stat">
                <span className="cpi-stat-label">Outstanding</span>
                <span className={`cpi-stat-value ${clientDetails.summary.totalOutstanding > 0 ? 'danger' : 'success'}`}>
                  LKR {clientDetails.summary.totalOutstanding.toLocaleString()}
                </span>
              </div>
            </div>
            <button className="cpi-close" onClick={() => setClientPanelOpen(false)} title="Close profile">
              <X size={16} />
            </button>
          </div>
        )}
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
            BALANCE: <strong style={{ color: (r.balanceAmount || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {Math.max(0, r.balanceAmount || 0).toLocaleString()}</strong>,
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
                {canManage && (
                  <>
                    <button className="action-icon-btn btn-print" onClick={() => handlePrint(r.rawData)} title="Print Bill">
                      <Printer />
                    </button>
                    <button className="action-icon-btn btn-details" onClick={() => handlePrintQuote(r.rawData)} title="Print Quotation">
                      <FileText />
                    </button>
                  </>
                )}
                {canManage && r.displayStatus === 'Active' && (
                  <button
                    className="action-icon-btn btn-msg"
                    style={{ width: 'auto', padding: '0 12px' }}
                    onClick={(e) => { e.stopPropagation(); setReturnRecord(r.rawData || r); setReturnDate(new Date().toISOString().split('T')[0]); setReturnModalOpen(true); }}
                  >
                    Mark Returned
                  </button>
                )}
                {/* //////////////////////////////////// */}
                <button
                  className="action-icon-btn btn-details"
                  onClick={() => handleEdit(r)}
                  title="Edit Booking"
                >
                  <Edit />
                </button>
                {/* //////////////////////////////////// */}
                <button className="action-icon-btn btn-bell" onClick={(e) => handleNotify(e, r)} title="Send SMS Reminder">
                  <Bell />
                </button>
                <button className="action-icon-btn btn-msg" onClick={(e) => handleWhatsApp(e, r)} title="Send WhatsApp Reminder">
                  <MessageCircle />
                </button>
                {canManage && (
                  <button className="action-icon-btn btn-delete" onClick={() => handleDelete(r._id)} title="Delete">
                    <Trash2 />
                  </button>
                )}
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

      {/* ── Add Client Modal ── */}
      <Modal isOpen={addClientOpen} onClose={() => setAddClientOpen(false)} title="Add New Customer">
        <form onSubmit={handleAddClientSubmit} className="hire-form" style={{ padding: '20px' }}>
          <div className="form-group">
            <label>Customer Name *</label>
            <input required type="text" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input type="text" value={newClient.contact} onChange={e => setNewClient({ ...newClient, contact: e.target.value })} />
          </div>
          <div className="form-group">
            <label>NIC / Passport</label>
            <input type="text" value={newClient.nic} onChange={e => setNewClient({ ...newClient, nic: e.target.value })} />
          </div>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="cancel-btn" onClick={() => setAddClientOpen(false)}>Cancel</button>
            <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Saving...' : 'Add Customer'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Custom SMS Modal ── */}
      <Modal isOpen={smsModalOpen} onClose={() => setSmsModalOpen(false)} title="Send SMS Reminder">
        <div className="hire-form" style={{ padding: '20px' }}>
          <div className="form-group">
            <label>Customer</label>
            <input type="text" readOnly value={smsRecord?.clientName || ''} style={{ background: 'var(--bg-main)' }} />
          </div>
          <div className="form-group">
            <label>Custom Message (Optional)</label>
            <textarea 
              rows={4} 
              placeholder="Leave blank to use the default follow-up template..."
              value={customSmsText}
              onChange={e => setCustomSmsText(e.target.value)}
            />
            <small style={{ color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>If blank, the automated template from Settings will be used.</small>
          </div>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button className="cancel-btn" onClick={() => setSmsModalOpen(false)}>Cancel</button>
            <button className="submit-btn" onClick={handleSmsSubmit} disabled={loading} style={{ background: 'var(--accent)', color: '#fff' }}>
              {loading ? 'Sending...' : 'Send SMS'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BookingBook;
