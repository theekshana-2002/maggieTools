import React from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import HireForm from './HireForm';
import RecordDetails from './RecordDetails';
import { hireAPI, vehicleAPI } from '../services/api';
import { generatePDFReport } from '../utils/reportGenerator';
import { Download, Search, PlusCircle, RefreshCw } from 'lucide-react';
import '../styles/forms.css';
import '../styles/books.css';
import VehicleFilter from './VehicleFilter';

const HireBook = () => {
  const userRole = localStorage.getItem('kt_user_role');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);
  
  const [hireRecords, setHireRecords] = React.useState([]);
  const [vehicles, setVehicles] = React.useState([]);
  const [selectedVehicle, setSelectedVehicle] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [editingItem, setEditingItem] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Simplified Table Columns
  const tableColumns = ['DATE', 'BILL#', 'COMPANY', 'VEHICLE', 'CITY', 'TOTAL', 'STATUS', 'ACTION'];
  
  React.useEffect(() => {
    fetchRecords();
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await vehicleAPI.get();
      setVehicles(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await hireAPI.get();
      const rawData = Array.isArray(response.data) ? response.data : [];
      const formatted = rawData.map(item => ({
        ...item,
        rawData:    item, // Store original for Editing
        date:       new Date(item.date).toLocaleDateString(),
        billNumber: item.billNumber || '—',
        timeSheetNumber: item.timeSheetNumber || '—',
        client:     item.client || '—',
        vehicle:    item.vehicle || '—',
        address:    item.address || (item.location ? '—' : '—'), 
        city:       item.city    || item.location || '—',
        driverName: item.driverName || '—',
        helperName: item.helperName || '—',
        startTime:  item.startTime  || '—',
        endTime:    item.endTime    || '—',
        workingHours: item.workingHours ? `${item.workingHours}h` : '—',
        minimumHours: item.minimumHours ? `${item.minimumHours}h` : '—',
        dieselCost: `LKR ${(item.dieselCost || 0).toLocaleString()}`,
        commission: `LKR ${(item.commission || 0).toLocaleString()}`,
        billAmount_val: item.billAmount || 0,
        totalAmount_val: item.totalAmount || 0,
        billAmount: `LKR ${(item.billAmount || 0).toLocaleString()}`,
        totalAmount_disp: `LKR ${(item.totalAmount || 0).toLocaleString()}`,
        details:    item.details || '—',
        status_text: item.status || 'Pending',
        status_disp: (
          <span className={`status-badge ${item.status === 'Completed' ? 'status-active' : 'status-pending'}`}>
            {item.status || 'Pending'}
          </span>
        ),
        action: (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            {canManage && (
              <button className="edit-btn" onClick={() => handleEdit(item)} title="Edit" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Edit
              </button>
            )}
            {canManage && (
              <button className="duplicate-btn" onClick={() => handleDuplicate(item)} title="Add More" style={{ padding: '4px 8px' }}>
                <PlusCircle size={14} /> Add More
              </button>
            )}
            {canManage && (
              <button className="delete-btn" onClick={() => handleDelete(item._id)} title="Delete">
                Delete
              </button>
            )}
          </div>
        )
      }));
      setHireRecords(formatted);
      setError(null);
    } catch (err) {
      console.error('Fetch Hires Error:', err);
      setError('Connection issue: could not load hire records.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = React.useMemo(() => {
    return hireRecords.filter(r => {
      const matchVehicle = !selectedVehicle || r.vehicle === selectedVehicle;
      const matchSearch = !searchQuery || 
        r.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.timeSheetNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.driverName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchVehicle && matchSearch;
    });
  }, [hireRecords, selectedVehicle, searchQuery]);

  const stats = React.useMemo(() => {
    const totalJobs    = filteredRecords.length;
    const totalRevenue = filteredRecords.reduce((sum, r) => sum + (r.billAmount_val || 0), 0);
    const totalAmount  = filteredRecords.reduce((sum, r) => sum + (r.totalAmount_val || 0), 0);
    return { totalJobs, totalRevenue, totalAmount };
  }, [filteredRecords]);

  const handleAddJob = async (data) => {
    try {
      if (editingItem && editingItem._id) {
        await hireAPI.update(editingItem._id, data);
        setSuccess('Hire record updated!');
      } else {
        await hireAPI.create(data);
        setSuccess('New hire job(s) added!');
      }
      fetchRecords();
      setIsModalOpen(false);
      setEditingItem(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving hire details.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleEdit = (item) => {
    const target = item.rawData || item;
    setEditingItem(target);
    setIsModalOpen(true);
  };

  const handleDuplicate = (item) => {
    const target = item.rawData || item;
    // Remove database internal fields to treat it as a new entry
    const { _id, createdAt, updatedAt, __v, ...rest } = target;
    setEditingItem(rest);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this hire record?')) {
      try {
        await hireAPI.delete(id);
        setSuccess('Record deleted.');
        fetchRecords();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError('Could not delete record.');
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const handleRowClick = (record) => {
    setSelectedRecord(record);
    setViewModalOpen(true);
  };

  const handleExportPDF = () => {
    // PDF Report ALWAYS contains full 15+ detail columns as requested
    const exportColumns = ['DATE', 'BILL#', 'TS#', 'COMPANY', 'VEHICLE', 'ADDRESS', 'CITY', 'DRIVER', 'HELPER', 'START', 'END', 'HOURS', 'MIN HRS', 'BILL AMT', 'D COST', 'COMM', 'TOTAL', 'STATUS'];
    const exportData = filteredRecords.map(r => [
      r.date || '—',
      r.billNumber || '—',
      r.timeSheetNumber || '—',
      r.client || '—',
      r.vehicle || '—',
      r.address || '—',
      r.city || '—',
      r.driverName || '—',
      r.helperName || '—',
      r.startTime || '—',
      r.endTime || '—',
      r.workingHours || '—',
      r.minimumHours || '—',
      r.billAmount || '—',
      r.dieselCost || '—',
      r.commission || '—',
      r.totalAmount_disp || '—',
      r.status_text || '—'
    ]);
    
    generatePDFReport({
      title: 'Full Hire Book Report',
      columns: exportColumns,
      data: exportData,
      filename: `HireReport_Full_${new Date().toISOString().split('T')[0]}.pdf`
    });
  };

  return (
    <div className="book-container">
      <div className="book-summary">
        <div className="summary-item">
          <label>TOTAL JOBS</label>
          <h3>{stats.totalJobs}</h3>
        </div>
        <div className="summary-item">
          <label>TOTAL BILL AMT</label>
          <h3 style={{ color: '#2563EB' }}>LKR {stats.totalRevenue.toLocaleString()}</h3>
        </div>
        <div className="summary-item" style={{ borderRight: 'none' }}>
          <label>NET TOTAL</label>
          <h3 style={{ color: '#10B981' }}>LKR {stats.totalAmount.toLocaleString()}</h3>
        </div>
      </div>

      <VehicleFilter 
        vehicles={vehicles} 
        selectedVehicle={selectedVehicle} 
        onSelect={setSelectedVehicle} 
      />

      <div className="book-filters">
        <div className="search-box">
          <Search className="search-icon" size={20} style={{ minWidth: '20px' }} />
          <input 
            type="text" 
            placeholder="Search client, bill, city, address..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="secondary-btn" onClick={fetchRecords} title="Refresh">
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
          <button className="secondary-btn" onClick={handleExportPDF}>
            <Download size={18} /> <span>Full Report</span>
          </button>
          {canManage && (
            <button className="add-btn" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
              <PlusCircle size={18} /> <span>Add Job</span>
            </button>
          )}
        </div>
      </div>

      {success && <div className="success-banner">{success}</div>}
      {error && <div className="error-banner">{error}</div>}

      <DataTable 
        columns={tableColumns} 
        data={filteredRecords} 
        loading={loading}
        onRowClick={handleRowClick}
        emptyMessage={loading ? "Connecting to service..." : "No hire records found."} 
      />

      {/* Detail View Modal */}
      <Modal 
        isOpen={viewModalOpen} 
        onClose={() => setViewModalOpen(false)} 
        title="Hire Job Details"
        wide
      >
        <RecordDetails data={selectedRecord} type="hire" />
        <div className="modal-footer" style={{ padding: '15px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', background: '#F8FAFC' }}>
            <button className="secondary-btn" onClick={() => setViewModalOpen(false)}>Close</button>
        </div>
      </Modal>

      {/* Edit/Add Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
        title={editingItem && editingItem._id ? 'Edit Hire Job' : 'Add Hire Job'}
        wide
      >
        <HireForm 
          onSubmit={handleAddJob} 
          onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} 
          initialData={editingItem}
        />
      </Modal>
    </div>
  );
};

export default HireBook;
