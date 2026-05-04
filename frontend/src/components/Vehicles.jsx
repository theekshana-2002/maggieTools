import React, { useState, useEffect, useMemo } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import { vehicleAPI, markLeasePayment } from '../services/api';
import { generatePDFReport } from '../utils/reportGenerator';
import { Download, Search, RefreshCw, PlusCircle, CheckCircle, XCircle, CreditCard, ChevronRight, Truck, Info, AlertCircle } from 'lucide-react';
import '../styles/forms.css';
import '../styles/books.css';
import RecordDetails from './RecordDetails';
import VehicleForm from './VehicleForm';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const LeasingBook = ({ vehicles, onPaymentToggle }) => {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const leasingVehicles = vehicles.filter(v => v.rawData?.hasLeasing);

  if (leasingVehicles.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)' }}>
        <CreditCard size={64} style={{ opacity: 0.1, marginBottom: '20px' }} />
        <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>No active leases found in the fleet.</p>
      </div>
    );
  }

  return (
    <div className="compliance-content">
      <div className="book-filters" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CreditCard size={24} color="var(--accent)" />
          <h3 style={{ margin: 0, fontWeight: 800 }}>Leasing Management</h3>
        </div>
        <div className="filter-actions">
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {leasingVehicles.map(v => {
          const rd = v.rawData || {};
          const payments = rd.leasePayments || [];
          return (
            <div key={v._id} className="stat-card" style={{ display: 'block', padding: 0 }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent-soft)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{rd.number}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>{rd.leasingCompany || 'Corporate Leasing'} · LKR {parseFloat(rd.monthlyPremium || 0).toLocaleString()}/mo</p>
                </div>
                <span className="status-badge status-confirmed">Due Day: {rd.leaseDueDate || '—'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px', padding: '16px' }}>
                {MONTHS.map((m, idx) => {
                  const month = idx + 1;
                  const isPaid = (payments.find(lp => lp.year === selYear && lp.month === month))?.paid || false;
                  const isFuture = selYear === now.getFullYear() && month > (now.getMonth() + 1);
                  return (
                    <button key={m} disabled={isFuture} onClick={() => onPaymentToggle(rd._id, selYear, month, !isPaid)}
                      className={`nav-item ${isPaid ? 'active' : ''}`}
                      style={{
                        padding: '12px 8px', borderRadius: '12px', justifyContent: 'center', flexDirection: 'column', height: 'auto', gap: '4px',
                        background: isFuture ? 'transparent' : isPaid ? 'var(--success)' : 'var(--danger)',
                        color: isFuture ? 'var(--text-dim)' : '#fff',
                        opacity: isFuture ? 0.3 : 1, border: 'none', boxShadow: 'none'
                      }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{m}</span>
                      {isPaid ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Vehicles = () => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const canManage = ['Admin', 'Manager'].includes(userRole);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [vehicleRecords, setVehicleRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('fleet');

  const columns = ['VEHICLE NUMBER', 'MODEL', 'CATEGORY', 'DAILY RATE', 'STATUS', 'ACTION'];

  useEffect(() => { fetchVehicles(); }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await vehicleAPI.get();
      const raw = Array.isArray(res.data) ? res.data : [];
      const formatted = raw.map(v => ({
        ...v,
        rawData: v,
        number: <strong style={{ color: 'var(--text-main)' }}>{v.number || '—'}</strong>,
        model_disp: v.model || '—',
        category_disp: <span className="status-badge status-confirmed" style={{ background: 'var(--bg-side)', color: 'var(--text-main)' }}>{v.category}</span>,
        dailyRate_disp: <strong style={{ color: 'var(--accent)' }}>LKR {(v.dailyRate || 0).toLocaleString()}</strong>,
        status_disp: (
          <span className={`status-badge ${v.status === 'Available' ? 'status-completed' : v.status === 'Booked' ? 'status-active' : 'status-cancelled'}`}>
            {v.status || 'Available'}
          </span>
        ),
        action: (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            <button className="edit-btn" onClick={() => { setSelectedRecord(v); setIsModalOpen(true); }}>Edit</button>
          </div>
        )
      }));
      setVehicleRecords(formatted);
    } catch (err) { console.error('RAXWO Vehicles: Fetch failed', err); }
    finally { setLoading(false); }
  };

  const filteredRecords = useMemo(() => {
    return vehicleRecords.filter(r => !searchQuery || (r.rawData?.number || '').toLowerCase().includes(searchQuery.toLowerCase()) || (r.rawData?.model || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [vehicleRecords, searchQuery]);

  const handleExportPDF = () => {
    const exportColumns = ['NUMBER', 'MODEL', 'CATEGORY', 'STATUS'];
    const exportData = filteredRecords.map(v => [v.rawData.number, v.rawData.model, v.rawData.category, v.rawData.status]);
    generatePDFReport({ title: 'Fleet Inventory Report', columns: exportColumns, data: exportData, filename: `Fleet_Report.pdf` });
  };

  return (
    <div className="book-container">
      <div className="dashboard-header">
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Fleet Management</p>
          <h1>Garage Fleet</h1>
        </div>
        <div className="header-controls">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input type="text" placeholder="Search fleet..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button className="theme-toggle-btn" onClick={fetchVehicles} title="Refresh"><RefreshCw size={18} className={loading ? 'spinner' : ''} /></button>
          {canManage && (
            <button className="refresh-btn" onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }} style={{ height: '48px', padding: '0 24px' }}>
              <PlusCircle size={18} /> Add Vehicle
            </button>
          )}
        </div>
      </div>

      <div className="book-summary">
        <div className="summary-item">
          <label>Total Fleet</label>
          <h3>{vehicleRecords.length} Units</h3>
          <Truck size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Available Now</label>
          <h3 style={{ color: 'var(--success)' }}>{vehicleRecords.filter(v => v.rawData?.status === 'Available').length}</h3>
          <CheckCircle size={16} color="var(--success)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>On Lease</label>
          <h3 style={{ color: 'var(--accent)' }}>{vehicleRecords.filter(v => v.rawData?.hasLeasing).length}</h3>
          <CreditCard size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
      </div>

      <div className="tab-switcher">
        <button onClick={() => setActiveTab('fleet')} className={activeTab === 'fleet' ? 'active-tab' : ''}>Fleet List</button>
        <button onClick={() => setActiveTab('leasing')} className={activeTab === 'leasing' ? 'active-tab' : ''}>Leasing Book</button>
      </div>

      {activeTab === 'fleet' ? (
        <div className="compliance-card">
          <DataTable columns={columns} data={filteredRecords} loading={loading} onRowClick={(row) => { setSelectedRecord(row); setViewModalOpen(true); }} />
        </div>
      ) : (
        <LeasingBook vehicles={vehicleRecords} onPaymentToggle={async (id, y, m, p) => { await markLeasePayment(id, y, m, p); fetchVehicles(); }} />
      )}

      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Vehicle Profile">
        <RecordDetails data={selectedRecord?.rawData || selectedRecord} type="vehicle" />
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedRecord(null); }} title={selectedRecord ? 'Edit Vehicle' : 'Register Vehicle'}>
        <VehicleForm 
          initialData={selectedRecord} 
          onCancel={() => { setIsModalOpen(false); setSelectedRecord(null); }} 
          onSubmit={() => { fetchVehicles(); setIsModalOpen(false); setSelectedRecord(null); }} 
        />
      </Modal>
    </div>
  );
};

export default Vehicles;
