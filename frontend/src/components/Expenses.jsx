import React from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import { toolAPI, expenseAPI } from '../services/api';
import { Download, Search, RefreshCw, PlusCircle, TrendingDown } from 'lucide-react';
import ToolFilter from './ToolFilter';
import Autocomplete from './Autocomplete';
import '../styles/forms.css';
import '../styles/books.css';

const ExpenseForm = ({ onSubmit, onCancel, initialData, tools = [] }) => {
  const [formData, setFormData] = React.useState(initialData || { date: new Date().toISOString().split('T')[0], description: '', amount: '', category: '', toolNo: '', note: '' });

  React.useEffect(() => {
    if (initialData) {
      const formattedDate = initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      setFormData({ ...initialData, date: formattedDate, toolNo: initialData.toolNo || initialData.vehicleNumber || initialData.vehicle || '' });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  return (
    <form className="hire-form" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div className="hire-form-scroll">
        <div className="form-section">
          <p className="form-section-title">Expense Details</p>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Amount (LKR) *</label>
              <input type="number" required placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Description *</label>
            <input type="text" required placeholder="e.g. Electricity bill, Repair cost" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="form-grid-2" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Category *</label>
              <select 
                required 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="">Select Category</option>
                <option value="Repair & Maintenance">Repair & Maintenance</option>
                <option value="Fuel / Energy">Fuel / Energy</option>
                <option value="Office Rent">Office Rent</option>
                <option value="Utility (Water/Elec)">Utility (Water/Elec)</option>
                <option value="Staff Welfare">Staff Welfare</option>
                <option value="Marketing">Marketing</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Link to Tool (Optional)</label>
              <Autocomplete
                name="toolNo"
                value={formData.toolNo}
                onChange={handleChange}
                options={tools.map(v => v.number)}
                placeholder="Select tool ID"
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Detailed Notes</label>
            <textarea placeholder="Any additional details..." value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} rows={3} />
          </div>
        </div>
      </div>

      <div className="hire-form-footer">
        <div className="total-display">
          <span>Expense Amount</span>
          <strong style={{ color: '#EF4444' }}>LKR {parseFloat(formData.amount || 0).toLocaleString()}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn" style={{ background: '#EF4444' }}>{initialData ? 'Update Expense' : 'Add Expense'}</button>
        </div>
      </div>
    </form>
  );
};

const Expenses = () => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const canManage = ['Admin', 'Manager'].includes(userRole);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [records, setRecords] = React.useState([]);
  const [tools, setTools] = React.useState([]);
  const [selectedTool, setSelectedTool] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [editingRecord, setEditingRecord] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  const columns = canManage 
    ? ['DATE', 'TOOL', 'DESCRIPTION', 'CATEGORY', 'AMOUNT (LKR)', 'ACTION']
    : ['DATE', 'TOOL', 'DESCRIPTION', 'CATEGORY', 'AMOUNT (LKR)'];

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
      const res = await expenseAPI.get();
      const raw = Array.isArray(res.data) ? res.data : [];
      const formatted = raw.map(r => ({
        ...r,
        rawData: r,
        date_disp: r.date ? new Date(r.date).toLocaleDateString() : '—',
        amount_disp: (
          <span style={{ fontWeight: '600', color: '#EF4444' }}>
            {parseFloat(r.amount || 0).toLocaleString()}
          </span>
        ),
        action: canManage ? (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            <button className="edit-btn" onClick={() => handleEdit(r)}>Edit</button>
            <button className="delete-btn" onClick={() => handleDelete(r._id)}>Delete</button>
          </div>
        ) : null
      }));
      setRecords(formatted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filteredRecords = React.useMemo(() => {
    return records.filter(r => {
      const v = r.toolNo || r.vehicleNumber || r.vehicle;
      const matchV = !selectedTool || v === selectedTool;
      const matchS = !searchQuery || 
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchV && matchS;
    });
  }, [records, searchQuery, selectedTool]);

  const totalAmount = React.useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [filteredRecords]);

  const handleAdd = async (data) => {
    try {
      if (editingRecord) {
        await expenseAPI.update(editingRecord._id, data);
        setSuccessMsg('Expense updated successfully!');
      } else {
        await expenseAPI.create(data);
        setSuccessMsg('Expense added successfully!');
      }
      fetchRecords();
      setIsModalOpen(false);
      setEditingRecord(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record.rawData || record);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense record?')) {
      try {
        await expenseAPI.delete(id);
        setSuccessMsg('Record deleted');
        fetchRecords();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) { console.error(err); }
    }
  };

  return (
    <div className="book-container">
      <div className="book-summary">
        <div className="summary-item">
          <label>EXPENSE RECORDS</label>
          <h3>{filteredRecords.length}</h3>
        </div>
        <div className="summary-item" style={{ borderRight: 'none' }}>
          <label>TOTAL EXPENSES</label>
          <h3 style={{ color: '#EF4444' }}>LKR {totalAmount.toLocaleString()}</h3>
        </div>
      </div>

      <ToolFilter tools={tools} selectedTool={selectedTool} onSelect={setSelectedTool} />


      <div className="book-filters">
        <div className="search-box">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            placeholder="Search description, category..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-actions">
          <button className="secondary-btn" onClick={fetchRecords} title="Refresh">
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
          {canManage && (
            <button className="add-btn" style={{ background: '#EF4444' }} onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}>
              <PlusCircle size={18} /> <span>Add Expense</span>
            </button>
          )}
        </div>
      </div>
      
      {successMsg && <div className="success-banner" style={{ margin: '0 20px 20px' }}>{successMsg}</div>}
      
      <DataTable 
        columns={columns} 
        data={filteredRecords.map(r => ({
          ...r,
          DATE: r.date_disp,
          TOOL: r.toolNo || r.vehicleNumber || r.vehicle,
          DESCRIPTION: r.description,
          CATEGORY: r.category || '—',
          'AMOUNT (LKR)': r.amount_disp,
          ACTION: r.action
        }))} 
        loading={loading} 
        emptyMessage="No expense records found." 
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingRecord(null); }} 
        title={editingRecord ? 'Edit Expense' : 'Add Expense'}
      >
        <ExpenseForm 
          onSubmit={handleAdd} 
          onCancel={() => { setIsModalOpen(false); setEditingRecord(null); }} 
          initialData={editingRecord}
          tools={tools}
        />
      </Modal>
    </div>
  );
};

export default Expenses;
