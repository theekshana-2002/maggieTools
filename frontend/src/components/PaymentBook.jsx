import React from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import PaymentForm from './PaymentForm';
import RecordDetails from './RecordDetails';
import { paymentAPI, toolAPI } from '../services/api';
import { generatePDFReport } from '../utils/reportGenerator';
import { Download, Search, PlusCircle, RefreshCw } from 'lucide-react';
import '../styles/forms.css';
import '../styles/books.css';
import ToolFilter from './ToolFilter';

/* ─── Helpers ────────────────────────────────────────────────── */
const fmt = (n) => `LKR ${Number(n || 0).toLocaleString()}`;
const fmtH = (n) => (n != null ? `${n}h` : '—');
const safe = (v) => v || '—';

/* ─── Component ──────────────────────────────────────────────── */
const PaymentBook = () => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const isDev    = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [isModalOpen,   setIsModalOpen]   = React.useState(false);
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);
  const [editingItem,   setEditingItem]   = React.useState(null);

  const [rawRecords,    setRawRecords]    = React.useState([]);   // ← pure DB data
  const [tools,      setTools]      = React.useState([]);
  const [selectedTool, setSelectedTool] = React.useState(null);
  const [searchQuery,   setSearchQuery]   = React.useState('');
  const [loading,       setLoading]       = React.useState(true);
  const [error,         setError]         = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [success,       setSuccess]       = React.useState(null);

  /* Table columns */
  const tableColumns = ['DATE', 'CLIENT', 'TOOL', 'HIRE AMT', 'PAID', 'BALANCE', 'STATUS', 'ACTION'];

  React.useEffect(() => { fetchRecords(); fetchTools(); }, []);
  
  const fetchTools = async () => {
    try {
      const res = await toolAPI.get();
      setTools(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res  = await paymentAPI.get();
      const data = Array.isArray(res.data) ? res.data : [];
      setRawRecords(data);
      setError(null);
    } catch (err) {
      console.error('Fetch Payments Error:', err);
      setError('Connection error: could not load payment records.');
    } finally {
      setLoading(false);
    }
  };

  /* Build display rows from raw DB data ───────────────────────── */
  const buildRow = (item) => ({
    /* ── original raw data preserved for edit/details ── */
    _raw: item,
    _id:  item._id,

    /* ── display fields ── */
    date:        item.date ? new Date(item.date).toLocaleDateString() : '—',
    clientName:  safe(item.client),
    vehicleNo:   safe(item.tool || item.vehicle),
    address:     item.address || '—',
    city:        item.city    || item.location || '—',
    days:        item.days    || 1,
    startKm:     item.startKm || 0,
    endKm:       item.endKm   || 0,
    extraKmCharges: item.extraKmCharges || 0,
    'HIRE AMT':  fmt(item.hireAmount),
    PAID:        fmt(item.takenAmount),
    BALANCE:     fmt(Math.max(0, item.balance || 0)),
    status_text: item.status || 'Pending',
    status_disp: (
      <span className={`status-badge ${item.status === 'Paid' ? 'status-completed' : 'status-active'}`}>
        {item.status || 'Pending'}
      </span>
    ),
    action: (
      <div className="table-actions" onClick={e => e.stopPropagation()}>
        {canManage && <button className="edit-btn"   onClick={() => handleEdit(item)}>Edit</button>}
        {canManage && <button className="delete-btn" onClick={() => handleDelete(item._id)}>Delete</button>}
      </div>
    ),
  });

  /* Derived filtered rows */
  const displayRows = React.useMemo(() => {
    return rawRecords
      .map(buildRow)
      .filter(r => {
        const matchV = !selectedTool || r.vehicleNo === selectedTool;
        const q      = searchQuery.toLowerCase();
        const matchS = !q ||
          (r.clientName || '').toLowerCase().includes(q) ||
          (r.vehicleNo || '').toLowerCase().includes(q) ||
          (r.city || '').toLowerCase().includes(q) ||
          (r.address || '').toLowerCase().includes(q);
        const matchStatus = statusFilter === 'All' || r.status_text === statusFilter;
        return matchV && matchS && matchStatus;
      });
  }, [rawRecords, selectedTool, searchQuery, statusFilter, canManage]);

  /* Summary stats */
  const stats = React.useMemo(() => ({
    totalHires:  rawRecords.reduce((s, r) => s + (r.hireAmount || 0), 0),
    outstanding: rawRecords.reduce((s, r) => s + (r.balance    || 0), 0),
    count:       rawRecords.length,
  }), [rawRecords]);

  /* ── CRUD ────────────────────────────────────────────────────── */
  const handleSave = async (data) => {
    try {
      if (editingItem) {
        await paymentAPI.update(editingItem._id, data);
        setSuccess('Payment record updated!');
      } else {
        await paymentAPI.create(data);
        setSuccess('New payment record added!');
      }
      fetchRecords();
      setIsModalOpen(false);
      setEditingItem(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving payment.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleEdit = (rawItem) => {
    setEditingItem(rawItem);   // pass pure DB object to form
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      await paymentAPI.delete(id);
      setSuccess('Record deleted.');
      fetchRecords();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Could not delete record.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRowClick = (row) => {
    /* Pass the raw DB item to the details view so keys match */
    setSelectedRecord(row._raw || row);
    setViewModalOpen(true);
  };

  /* ── PDF Export ─────────────────────────────────────────────── */
  const handleExportPDF = () => {
    const cols = ['DATE','CLIENT','VEHICLE','DAYS','START KM','END KM','EXTRA KM','HIRE AMT','ADVANCE','TAKEN','BALANCE','STATUS'];
    const data = displayRows.map(r => [
      r.date, r.clientName, r.vehicleNo,
      r.days, r.startKm, r.endKm, r.extraKmCharges,
      r.hireAmount, r.dayPayment, r.takenAmount,
      r.balance, r.status_text,
    ]);
    generatePDFReport({
      title:    'Payment History Report',
      columns:  cols,
      data,
      filename: `Payments_${new Date().toISOString().split('T')[0]}.pdf`,
    });
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="book-container">

      {/* Summary Strip */}
      <div className="book-summary">
        <div className="summary-item">
          <label>TOTAL RENTAL VALUE</label>
          <h3 style={{ color: '#2563EB' }}>LKR {stats.totalHires.toLocaleString()}</h3>
        </div>
        <div className="summary-item">
          <label>OUTSTANDING BALANCE</label>
          <h3 style={{ color: '#DC2626' }}>LKR {stats.outstanding.toLocaleString()}</h3>
        </div>
        <div className="summary-item" style={{ borderRight: 'none' }}>
          <label>TOTAL RECORDS</label>
          <h3>{stats.count}</h3>
        </div>
      </div>

      <ToolFilter tools={tools} selectedTool={selectedTool} onSelect={setSelectedTool} />

      {/* Filters & Actions */}
      <div className="book-filters">
        <div className="search-box" style={{ width: '200px', flex: 'none' }}>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={{ border: 'none', background: 'none', width: '100%', fontWeight: '600', color: 'var(--text-main)', cursor: 'pointer' }}
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid Only</option>
            <option value="Pending">Pending Only</option>
          </select>
        </div>
        <div className="search-box">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search client, driver, helper, city, address…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="secondary-btn" onClick={fetchRecords} title="Refresh">
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
          <button className="secondary-btn" onClick={handleExportPDF}>
            <Download size={18} /> <span>Export PDF</span>
          </button>
          {canManage && (
            <button className="add-btn" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
              <PlusCircle size={18} /> <span>Add Payment</span>
            </button>
          )}
        </div>
      </div>

      {success && <div className="success-banner">{success}</div>}
      {error   && <div className="error-banner">{error}</div>}

      <DataTable
        columns={tableColumns}
        data={displayRows}
        loading={loading}
        onRowClick={handleRowClick}
        emptyMessage={loading ? 'Connecting to service…' : 'No payment records found.'}
      />

      {/* Detail View Modal */}
      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Payment Record Details" wide>
        <RecordDetails data={selectedRecord} type="payment" />
        <div className="modal-footer" style={{ padding: '15px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-main)' }}>
          <button className="secondary-btn" onClick={() => setViewModalOpen(false)}>Close</button>
        </div>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        title={editingItem ? 'Edit Payment Record' : 'Add Payment Record'}
        wide
      >
        <PaymentForm
          onSubmit={handleSave}
          onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          initialData={editingItem}
        />
      </Modal>

    </div>
  );
};

export default PaymentBook;
