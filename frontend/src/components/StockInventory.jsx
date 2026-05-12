import React, { useState, useEffect, useMemo } from 'react';
import { toolAPI, bookingAPI } from '../services/api';
import { Package, Search, Filter, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import DataTable from './DataTable';
import '../styles/books.css';

const StockInventory = () => {
  const [tools, setTools] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const today = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([toolAPI.get(), bookingAPI.get()]);
      setTools(tRes.data || []);
      setBookings(bRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toolStatus = useMemo(() => {
    return tools.map(tool => {
      // Check if tool is currently booked today
      const activeBooking = bookings.find(b => {
        const start = new Date(b.pickupDate).toISOString().split('T')[0];
        const end = new Date(b.returnDate).toISOString().split('T')[0];
        return b.tool?._id === tool._id && 
               today >= start && 
               today <= end && 
               ['Confirmed', 'Active'].includes(b.status);
      });

      return {
        ...tool,
        currentStatus: activeBooking ? 'Rented' : 'In Stock',
        activeBooking: activeBooking || null
      };
    });
  }, [tools, bookings, today]);

  const filteredTools = useMemo(() => {
    return toolStatus.filter(t => {
      const matchSearch = !searchQuery || 
        t.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus = statusFilter === 'All' || 
        (statusFilter === 'Available' && t.currentStatus === 'In Stock') ||
        (statusFilter === 'Rented' && t.currentStatus === 'Rented');

      return matchSearch && matchStatus;
    });
  }, [toolStatus, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = toolStatus.length;
    const available = toolStatus.filter(t => t.currentStatus === 'In Stock').length;
    const rented = total - available;
    return { total, available, rented };
  }, [toolStatus]);

  const columns = ['TOOL ID', 'CATEGORY', 'MODEL', 'DAILY RATE', 'CURRENT STATUS', 'LOCATION'];

  return (
    <div className="book-container">
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Tools</label>
          <h3>{stats.total}</h3>
        </div>
        <div className="summary-item">
          <label>Available (Stock)</label>
          <h3 style={{ color: 'var(--success)' }}>{stats.available}</h3>
        </div>
        <div className="summary-item">
          <label>Rented Out</label>
          <h3 style={{ color: 'var(--warning)' }}>{stats.rented}</h3>
        </div>
      </div>

      <div className="book-filters">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search by ID, Model or Category..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
        <div className="filter-actions">
          <div className="tab-switcher">
            {['All', 'Available', 'Rented'].map(s => (
              <button 
                key={s} 
                className={statusFilter === s ? 'active-tab' : ''} 
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <button className="theme-toggle-btn" onClick={fetchData}>
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      <div className="compliance-card">
        <DataTable 
          columns={columns}
          data={filteredTools.map(t => ({
            'TOOL ID': <strong style={{ color: 'var(--text-main)' }}>{t.number}</strong>,
            'CATEGORY': t.category,
            'MODEL': t.model,
            'DAILY RATE': `LKR ${(t.dailyRate || 0).toLocaleString()}`,
            'CURRENT STATUS': (
              <span className={`status-badge ${t.currentStatus === 'In Stock' ? 'status-active' : 'status-pending'}`}>
                {t.currentStatus === 'In Stock' ? 'Available' : 'Rented'}
              </span>
            ),
            'LOCATION': t.currentStatus === 'In Stock' ? 'Warehouse' : (t.activeBooking?.city || 'On Site')
          }))}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default StockInventory;
