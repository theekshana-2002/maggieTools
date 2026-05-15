import React, { useState, useEffect, useMemo } from 'react';
import { History, User, Calendar, Clock, ArrowRight, Filter, Search, Tag, Download, RefreshCw } from 'lucide-react';
import { hireAPI, bookingAPI, invoiceAPI, extraIncomeAPI, expenseAPI } from '../services/api';
import { generateGenericReportPDF } from '../utils/genericReportGenerator';
import DataTable from './DataTable';
import Modal from './Modal';
import RecordDetails from './RecordDetails';
import '../styles/audit.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [h, b, i, ei, ex] = await Promise.all([
        hireAPI.get(),
        bookingAPI.get(),
        invoiceAPI.get(),
        extraIncomeAPI.get(),
        expenseAPI.get()
      ]);

      const allLogs = [
        ...(h.data || []).map(x => ({ ...x, _type: 'Hire', _ref: x.billNumber })),
        ...(b.data || []).map(x => ({ ...x, _type: 'Booking', _ref: x.bookingId })),
        ...(i.data || []).map(x => ({ ...x, _type: 'Invoice', _ref: x.invoiceNo })),
        ...(ei.data || []).map(x => ({ ...x, _type: 'Extra Income', _ref: x.description })),
        ...(ex.data || []).map(x => ({ ...x, _type: 'Expense', _ref: x.description }))
      ];

      // Sort by updatedAt descending
      allLogs.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      setLogs(allLogs);
    } catch (err) {
      console.error('Audit fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    generateGenericReportPDF('Global Audit Log Report', ['USER', 'RECORD TYPE', 'REFERENCE', 'DATE', 'TIME'], filteredLogs.map(l => ({
        ...l,
        user: l.updatedByName || l.operatorName || 'System',
        recordtype: l._type,
        reference: l._ref,
        date: new Date(l.updatedAt || l.createdAt).toLocaleDateString(),
        time: new Date(l.updatedAt || l.createdAt).toLocaleTimeString()
    })));
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = (log.updatedByName || log.operatorName || '').toLowerCase().includes(filter.toLowerCase()) ||
                            (log._ref || '').toLowerCase().includes(filter.toLowerCase());
      const matchesType = typeFilter === 'All' || log._type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [logs, filter, typeFilter]);

  // Map data for DataTable
  const tableData = useMemo(() => {
    return filteredLogs.map(log => ({
      ...log,
      USER: (
        <div className="audit-user-cell">
          <div className="audit-avatar">{(log.updatedByName || log.operatorName || 'S')[0].toUpperCase()}</div>
          <div>
            <p className="audit-username">{log.updatedByName || log.operatorName || 'System'}</p>
            <p className="audit-role">{log.updatedBy ? 'Staff' : 'System'}</p>
          </div>
        </div>
      ),
      'ACTION / RECORD': (
        <div className="audit-action-cell">
          <div>
            <p className="audit-ref">Modified: <strong>{log._ref}</strong></p>
            <span className={`audit-badge badge-${log._type.replace(/\s+/g, '-').toLowerCase()}`}>
              {log._type}
            </span>
          </div>
        </div>
      ),
      TIMESTAMP: (
        <div className="audit-time-cell">
          <p className="audit-date"><Calendar size={12} /> {new Date(log.updatedAt || log.createdAt).toLocaleDateString()}</p>
          <p className="audit-time"><Clock size={12} /> {new Date(log.updatedAt || log.createdAt).toLocaleTimeString()}</p>
        </div>
      ),
      ACTION: (
        <div className="table-actions" onClick={e => e.stopPropagation()}>
           <button className="action-icon-btn btn-details" onClick={() => setSelectedLog(log)} title="View Details">
              <ArrowRight />
           </button>
        </div>
      )
    }));
  }, [filteredLogs]);

  const columns = ['USER', 'ACTION / RECORD', 'TIMESTAMP', 'STATUS', 'ACTION'];

  return (
    <div className="audit-container">
      <div className="audit-header-top">
        <div className="audit-title-area">
          <History className="title-icon" size={24} />
          <div>
            <h1>Global Audit Trail</h1>
            <p>Tracking system-wide modifications and user activities</p>
          </div>
        </div>

        <div className="audit-stats">
          <div className="audit-stat-card">
            <label>Total Updates</label>
            <h3>{logs.length}</h3>
          </div>
          <div className="audit-stat-card">
            <label>Active Users</label>
            <h3>{[...new Set(logs.map(l => l.updatedByName))].length}</h3>
          </div>
        </div>
      </div>

      <div className="audit-filters">
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search by user or record reference..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={18} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="All">All Categories</option>
            <option value="Hire">Daily Hires</option>
            <option value="Booking">Bookings</option>
            <option value="Invoice">Invoices</option>
            <option value="Extra Income">Extra Income</option>
            <option value="Expense">Expenses</option>
          </select>
        </div>

        <button className="refresh-audit" onClick={handleExportPDF} title="Export PDF">
          <Download size={18} />
        </button>
        <button className="refresh-audit" onClick={fetchLogs} disabled={loading} title="Refresh">
          <RefreshCw size={18} className={loading ? 'spinner' : ''} />
        </button>
      </div>

      <div className="audit-table-wrapper">
        <DataTable 
          columns={columns}
          data={tableData}
          loading={loading}
          onRowClick={(log) => setSelectedLog(log)}
        />
      </div>

      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Modification Details">
         <RecordDetails data={selectedLog} type={selectedLog?._type?.toLowerCase()} />
      </Modal>
    </div>
  );
};

export default AuditLog;
