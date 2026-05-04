import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Wallet, Fuel, ArrowDown,
  BarChart, RefreshCw, CheckCircle, Clock, Users,
  ShieldCheck, FileText, CreditCard, Bell, ChevronRight,
  Truck, Car, FileBarChart
} from 'lucide-react';
import { bookingAPI, dieselAPI, salaryAPI, paymentAPI, invoiceAPI, vehicleAPI, expenseAPI, extraIncomeAPI } from '../services/api';
import Modal from './Modal';
import RecordDetails from './RecordDetails';
import './Dashboard.css';

const pulseStyle = `
  @keyframes pulse-red {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  .pulse-icon {
    animation: pulse-red 2s infinite ease-in-out;
  }
`;

/* ── Helpers ── */
const fmt = (n) => `LKR ${Number(n || 0).toLocaleString()}`;

const getUrgencyColor = (date) => {
  if (!date) return 'var(--text-dim)';
  const targetDate = new Date(date);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return 'var(--danger)';
  if (diffDays <= 3) return 'var(--warning)';
  return 'var(--accent)';
};

const isExpiringSoon = (date, daysThreshold = 7) => {
  if (!date) return false;
  const targetDate = new Date(date);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= daysThreshold;
};

/* ── Reminder Card ── */
const ReminderCard = ({ r }) => {
  const isToday = r.daysLeft <= 0;
  const isTomorrow = r.daysLeft === 1;

  let urgencyColor = '#3b82f6'; // default blue
  let iconColor = '#3b82f6';
  
  if (r.daysLeft <= 0) {
    urgencyColor = '#ef4444'; // red
    iconColor = '#ef4444';
  } else if (r.daysLeft <= 2) {
    urgencyColor = '#f59e0b'; // orange
    iconColor = '#f59e0b';
  }

  let badgeStyle = {
    background: '#eff6ff', 
    color: '#3b82f6', 
  };
  let badgeText = `${r.daysLeft}d`;

  if (isToday) {
    badgeStyle = { background: '#ef4444', color: '#fff' };
    badgeText = 'DUE';
  } else if (isTomorrow) {
    badgeStyle = { background: '#f59e0b', color: '#fff' };
    badgeText = 'TOMORROW';
  }

  return (
    <div className="reminder-card" style={{ borderLeftColor: urgencyColor }}>
      <div className="reminder-icon" style={{ color: iconColor }}>
        <r.icon size={20} strokeWidth={2.5} />
      </div>
      <div className="reminder-info">
        <div className="reminder-header">
          <span className="reminder-vehicle">{r.vehicle}</span>
          <span className="reminder-badge" style={badgeStyle}>{badgeText}</span>
        </div>
        <p className="reminder-type">{r.type}</p>
      </div>
    </div>
  );
};

/* ── Stat Card ── */
const StatCard = ({ title, value, subtext, icon: Icon, color, onClick }) => (
  <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <div className="stat-icon" style={{ color }}>
      <Icon size={26} />
    </div>
    <div className="stat-info">
      <p className="stat-title">{title}</p>
      <h3 className="stat-value">{value}</h3>
      <p className="stat-subtext">{subtext}</p>
    </div>
  </div>
);

/* ── Dashboard Component ── */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const Dashboard = ({ role = 'User', name = 'Guest', setActiveTab }) => {
  const currentRole = role?.toLowerCase();
  const isAdmin = currentRole === 'admin' || currentRole === 'manager';
  const isEmployee = currentRole === 'employee';
  const isStaff = isAdmin || isEmployee;
  const displayName = name && name !== 'null' ? name : 'Administrator';

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = pulseStyle;
    document.head.appendChild(styleTag);
    return () => document.head.removeChild(styleTag);
  }, []);

  const [data, setData] = useState({ bookings: [], diesel: [], salaries: [], payments: [], invoices: [], vehicles: [], expenses: [], extraIncome: [] });
  const [insights, setInsights] = useState({ topVehicles: [], topCustomers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewType, setViewType] = useState('hire');

  const handleOpenDetail = (item, type) => {
    setSelectedRecord(item);
    setViewType(type);
    setViewModalOpen(true);
  };

  const fetchAll = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [b, d, s, p, inv, v, ex, ei, insRes] = await Promise.all([
        bookingAPI.get(), dieselAPI.get(), salaryAPI.get(),
        paymentAPI.get(), invoiceAPI.get(), vehicleAPI.get(),
        expenseAPI.get(), extraIncomeAPI.get(),
        bookingAPI.getInsights()
      ]);
      setData({
        bookings: Array.isArray(b.data)   ? b.data   : [],
        diesel:   Array.isArray(d.data)   ? d.data   : [],
        salaries: Array.isArray(s.data)   ? s.data   : [],
        payments: Array.isArray(p.data)   ? p.data   : [],
        invoices: Array.isArray(inv.data) ? inv.data : [],
        vehicles: Array.isArray(v.data)   ? v.data   : [],
        expenses: Array.isArray(ex.data)  ? ex.data  : [],
        extraIncome: Array.isArray(ei.data) ? ei.data : [],
      });
      if (insRes.data) setInsights(insRes.data);
      setLastFetch(new Date());
      setError(null);
    } catch (err) {
      console.error('RAXWO Dashboard: Fetch failed', err);
      setError(`Dashboard Sync Issue: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    console.log(`RAXWO Dashboard: Syncing for ${name} (${role})`);
    fetchAll(); 
  }, [name, role]);

  useEffect(() => {
    const onRefresh = () => fetchAll(true);
    window.addEventListener('raxwo_data_updated', onRefresh);
    window.addEventListener('raxwo_lease_updated', onRefresh);
    return () => {
      window.removeEventListener('raxwo_data_updated', onRefresh);
      window.removeEventListener('raxwo_lease_updated', onRefresh);
    };
  }, []);

  const filterByPeriod = (records, dateField = 'date') => {
    return records.filter(r => {
      const d = new Date(r[dateField] || r.createdAt);
      const yearMatch = d.getFullYear() === parseInt(selectedYear);
      const monthMatch = selectedMonth === 'All' || d.getMonth() === MONTHS.indexOf(selectedMonth);
      return yearMatch && monthMatch;
    });
  };

  const groupedReminders = useMemo(() => {
    if (!isAdmin) return { insurance: [], license: [], safety: [], leasing: [] };
    const groups = { insurance: [], license: [], safety: [], leasing: [] };
    const today = new Date();
    
    const getDaysLeft = (date) => {
      const d = new Date(date);
      const diff = d - today;
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    data.vehicles.forEach(v => {
      if (isExpiringSoon(v.insuranceExpirationDate)) {
        groups.insurance.push({ vehicle: v.number, type: 'Insurance', date: v.insuranceExpirationDate, icon: ShieldCheck, daysLeft: getDaysLeft(v.insuranceExpirationDate) });
      }
      if (isExpiringSoon(v.licenseExpirationDate)) {
        groups.license.push({ vehicle: v.number, type: 'License', date: v.licenseExpirationDate, icon: FileText, daysLeft: getDaysLeft(v.licenseExpirationDate) });
      }
      if (isExpiringSoon(v.safetyExpirationDate)) {
        groups.safety.push({ vehicle: v.number, type: 'Safety', date: v.safetyExpirationDate, icon: CheckCircle, daysLeft: getDaysLeft(v.safetyExpirationDate) });
      }
      if (v.hasLeasing && v.leaseDueDate) {
        const nextDue = new Date(today.getFullYear(), today.getMonth(), v.leaseDueDate);
        if (isExpiringSoon(nextDue)) {
           groups.leasing.push({ vehicle: v.number, type: 'Lease Due', date: nextDue, icon: CreditCard, amount: v.monthlyPremium, daysLeft: getDaysLeft(nextDue) });
        }
      }
    });

    // Add Booking End Reminders
    data.bookings.forEach(b => {
      if (b.status === 'Active' && isExpiringSoon(b.returnDate, 2)) {
        groups.leasing.push({ 
          vehicle: b.vehicle?.number || 'Unknown', 
          type: 'Return Due Soon', 
          date: b.returnDate, 
          icon: Clock, 
          daysLeft: getDaysLeft(b.returnDate) 
        });
      }
    });

    return groups;
  }, [data.vehicles, data.bookings, isAdmin]);

  const hasAnyReminders = useMemo(() => Object.values(groupedReminders).some(g => g.length > 0), [groupedReminders]);

  const stats = useMemo(() => {
    if (isStaff) {
      const fBookings = filterByPeriod(data.bookings, 'pickupDate');
      const fExtra = filterByPeriod(data.extraIncome, 'date');
      const fExpenses = filterByPeriod(data.expenses, 'date');
      const fDiesel = filterByPeriod(data.diesel, 'date');
      const fSalaries = filterByPeriod(data.salaries, 'createdAt');

      const revenue = fBookings.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0) + fExtra.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const cost = fSalaries.reduce((s, r) => s + (parseFloat(r.netPay) || 0), 0) + fDiesel.reduce((s, r) => s + (parseFloat(r.total) || 0), 0) + fExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const profit = revenue - cost;
      const pending = fBookings.reduce((s, r) => s + (parseFloat(r.balanceAmount) || 0), 0);

      const baseStats = [
        { id: 1, title: 'Total Bookings', value: fBookings.length, subtext: 'Company wide', icon: Car, color: 'var(--accent)' },
        { id: 2, title: 'Active Rides', value: fBookings.filter(b => b.status === 'Active').length, subtext: 'In progress', icon: Clock, color: 'var(--warning)' },
      ];

      if (isAdmin) {
        return [
          { id: 1, title: 'Total Revenue', value: fmt(revenue), subtext: `From ${fBookings.length} bookings`, icon: TrendingUp, color: 'var(--accent)', tab: 'reports' },
          { id: 2, title: 'Operational Cost', value: fmt(cost), subtext: 'Fuel, Salary, Expenses', icon: ArrowDown, color: 'var(--danger)', tab: 'expenses' },
          { id: 3, title: 'Net Profit', value: fmt(profit), subtext: 'Estimated earnings', icon: BarChart, color: profit >= 0 ? 'var(--success)' : 'var(--danger)', tab: 'reports' },
          { id: 4, title: 'Pending Dues', value: fmt(pending), subtext: 'To be collected', icon: Clock, color: 'var(--warning)', tab: 'bookings' },
        ];
      }

      return baseStats;
    }

    // Client View
    const myBookings = data.bookings.filter(b => {
      const n = name?.trim().toLowerCase();
      return b.clientName?.trim().toLowerCase() === n || 
             b.driverName?.trim().toLowerCase() === n || 
             b.helperName?.trim().toLowerCase() === n;
    });
    return [
      { id: 1, title: 'My Total Bookings', value: myBookings.length, subtext: 'Lifetime total', icon: TrendingUp, color: 'var(--accent)' },
      { id: 2, title: 'Active Rides', value: myBookings.filter(b => b.status === 'Active').length, subtext: 'In progress', icon: Clock, color: 'var(--warning)' },
      { id: 3, title: 'Completed', value: myBookings.filter(b => b.status === 'Completed').length, subtext: 'Returned safely', icon: CheckCircle, color: 'var(--success)' },
    ];
  }, [data, isAdmin, isStaff, role, name, selectedMonth, selectedYear]);

  const recentActivity = useMemo(() => {
    // Admins and Employees see all bookings, Clients only see their own
    const list = isStaff ? data.bookings : data.bookings.filter(b => {
      const n = name?.trim().toLowerCase();
      return b.clientName?.trim().toLowerCase() === n || 
             b.driverName?.trim().toLowerCase() === n || 
             b.helperName?.trim().toLowerCase() === n;
    });
    return [...list].sort((a, b) => {
      const dateA = new Date(b.pickupDate || b.createdAt || 0);
      const dateB = new Date(a.pickupDate || a.createdAt || 0);
      return dateA - dateB;
    }).slice(0, 5);
  }, [data.bookings, isAdmin, isStaff, role, name]);

  return (
    <div className="dashboard-container">
      {/* ── Welcome Header ── */}
      <div className="dashboard-header">
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Overview Dashboard</p>
          <h1>Hello, {displayName}</h1>
        </div>
        <div className="header-controls">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="period-select">
            <option value="All">All Months</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="period-select">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => fetchAll(false)} className="refresh-btn">
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Reminders ── */}
      {isAdmin && hasAnyReminders && (
        <div className="critical-alerts-section">
          <div className="critical-alerts-header">
            <h3 className="critical-alerts-title">
                <Bell size={20} className="pulse-icon" />
                Critical Attention Required
            </h3>
            <span className="pending-actions-badge">Pending Actions</span>
          </div>
          <div className="reminders-grid">
            {Object.values(groupedReminders).flat().slice(0, 4).map((r, i) => <ReminderCard key={i} r={r} />)}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      {isAdmin && (
        <div className="quick-actions-row" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button className="refresh-btn" onClick={() => setActiveTab('bookings')} style={{ background: 'var(--accent)', color: 'white', border: 'none' }}>
                <Car size={18} /> New Booking
            </button>
            <button className="refresh-btn" onClick={() => setActiveTab('vehicle-reg')} style={{ background: 'var(--success)', color: 'white', border: 'none' }}>
                <Truck size={18} /> Add Vehicle
            </button>
            <button className="refresh-btn btn-report-inverted" onClick={() => setActiveTab('reports')}>
                <FileBarChart size={18} /> View Reports
            </button>
        </div>
      )}

      {error && (
        <div className="form-info-banner" style={{ background: 'var(--danger)', color: '#fff', border: 'none', marginBottom: '24px' }}>
          <Bell size={18} />
          <span>{error}</span>
        </div>
      )}
      
      {/* ── Core Stats ── */}
      <div className="stats-grid">
        {stats.map(s => <StatCard key={s.id} {...s} onClick={s.tab ? () => setActiveTab(s.tab) : null} />)}
      </div>

      {/* ── Business Insights ── */}
      {isAdmin && (
        <div className="insights-row">
            <div className="insight-card">
                <div className="section-header" style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Car size={20} style={{ color: 'var(--accent)' }} />
                        Top Customer Choice
                    </h3>
                </div>
                <div className="insight-list">
                    {insights.topVehicles.length > 0 ? insights.topVehicles.map((v, i) => (
                        <div key={i} className="insight-item">
                            <div className="insight-rank">{i + 1}</div>
                            <div className="insight-info">
                                <span className="insight-name">{v.name}</span>
                                <span className="insight-sub">{v.count} Hires · Most Popular</span>
                            </div>
                            <div className="insight-value">
                                <span className="insight-main-val">{fmt(v.revenue)}</span>
                            </div>
                        </div>
                    )) : <p className="insight-sub">No data available yet</p>}
                </div>
            </div>

            <div className="insight-card">
                <div className="section-header" style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={20} style={{ color: 'var(--success)' }} />
                        Best Customers
                    </h3>
                </div>
                <div className="insight-list">
                    {insights.topCustomers.length > 0 ? insights.topCustomers.map((c, i) => (
                        <div key={i} className="insight-item">
                            <div className="insight-rank" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>{i + 1}</div>
                            <div className="insight-info">
                                <span className="insight-name">{c.name}</span>
                                <span className="insight-sub">{c.count} Bookings · Latest: {c.latestVehicle}</span>
                            </div>
                            <div className="insight-value">
                                <span className="insight-main-val" style={{ color: 'var(--success)' }}>{fmt(c.revenue)}</span>
                            </div>
                        </div>
                    )) : <p className="insight-sub">No data available yet</p>}
                </div>
            </div>
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div className="recent-activity">
        <div className="section-header">
          <h3>Recent Bookings Activity</h3>
          <button className="period-select" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>View All</button>
        </div>
        {recentActivity.length > 0 ? (
          <div className="activity-list">
            {recentActivity.map((b, i) => (
              <div key={i} className="activity-item" onClick={() => handleOpenDetail(b, 'booking')}>
                <div className={`activity-indicator ${b.status === 'Completed' ? 'green' : 'blue'}`} />
                <div className="activity-details">
                  <p>{b.clientName} · {b.vehicle?.number || 'No Vehicle'}</p>
                  <span>{new Date(b.pickupDate).toLocaleDateString()} — {new Date(b.returnDate).toLocaleDateString()}</span>
                </div>
                <div className="activity-value">
                  {fmt(b.totalAmount)}
                  <ChevronRight size={16} style={{ marginLeft: '12px', opacity: 0.3 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--bg-muted)', borderRadius: '20px', margin: '20px' }}>
            <Clock size={48} style={{ marginBottom: '16px', opacity: 0.1 }} />
            <h4 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>No Assigned Bookings</h4>
            <p style={{ fontSize: '0.875rem' }}>
              {isAdmin ? 'No records found for the selected period.' : `No bookings are currently assigned to ${displayName}.`}
            </p>
          </div>
        )}
      </div>

      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Record Details">
        <RecordDetails data={selectedRecord} type={viewType} />
      </Modal>
    </div>
  );
};

export default Dashboard;
