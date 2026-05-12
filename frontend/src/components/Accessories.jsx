import React, { useState, useEffect, useMemo } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import { accessoryAPI } from '../services/api';
import { Package, PlusCircle, Search, RefreshCw, Trash2, Edit3, Save, X } from 'lucide-react';
import '../styles/books.css';

const Accessories = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: '', price: 0, stock: 0, unit: 'pcs', description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await accessoryAPI.get();
      console.log('Accessories Loaded:', res.data);
      setItems(res.data || []);
    } catch (err) { 
      console.error('Fetch Accessories Error:', err);
      alert('Failed to load accessories: ' + (err.response?.data?.message || err.message));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this accessory?')) {
      try {
        await accessoryAPI.delete(id);
        fetchData();
      } catch (err) { console.error(err); }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = editingItem ? 
        await accessoryAPI.update(editingItem._id, formData) : 
        await accessoryAPI.create(formData);
      
      console.log('Accessory Save Response:', res);
      alert('Accessory saved successfully!');
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', category: '', price: 0, stock: 0, unit: 'pcs', description: '' });
      fetchData();
    } catch (err) { 
      console.error('Accessory Save Error:', err);
      alert('Save failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => 
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      i.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const columns = ['NAME', 'CATEGORY', 'STOCK', 'PRICE', 'ACTION'];

  return (
    <div className="book-container">
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Item Types</label>
          <h3>{items.length}</h3>
        </div>
        <div className="summary-item">
          <label>Low Stock Items</label>
          <h3 style={{ color: 'var(--danger)' }}>{items.filter(i => i.stock < 5).length}</h3>
        </div>
      </div>

      <div className="book-filters">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search accessories..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
        <div className="filter-actions">
          <button className="theme-toggle-btn" onClick={fetchData}><RefreshCw size={18} className={loading ? 'spinner' : ''} /></button>
          <button className="add-btn" onClick={() => { setEditingItem(null); setFormData({ name: '', category: '', price: 0, stock: 0, unit: 'pcs', description: '' }); setIsModalOpen(true); }}>
            <PlusCircle size={18} /> Add Accessory
          </button>
        </div>
      </div>

      <div className="compliance-card">
        <DataTable 
          columns={columns}
          data={filteredItems.map(i => ({
            'NAME': <strong>{i.name}</strong>,
            'CATEGORY': i.category,
            'STOCK': <span style={{ color: i.stock < 5 ? 'var(--danger)' : 'var(--text-main)' }}>{i.stock} {i.unit}</span>,
            'PRICE': `LKR ${i.price.toLocaleString()}`,
            'ACTION': (
              <div className="table-actions">
                <button className="edit-btn" onClick={() => handleEdit(i)}>Edit</button>
                <button className="delete-btn" onClick={() => handleDelete(i._id)}>Delete</button>
              </div>
            )
          }))}
          loading={loading}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Accessory' : 'New Accessory'}>
        <form onSubmit={handleSubmit} className="hire-form" style={{ padding: '20px' }}>
          <div className="form-group">
            <label>Accessory Name *</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Category</label>
              <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Drill Bits" />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="pcs, kg, etc." />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Price (LKR) *</label>
              <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Current Stock *</label>
              <input type="number" required value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="2" />
          </div>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="submit-btn">Save Accessory</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Accessories;
