import React from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Fuel, 
  CreditCard, 
  Contact,
  LogOut,
  UserCircle,
  FileBarChart,
  Car,
  FileText,
  FileCheck,
  Wallet,
  TrendingDown,
  X,
  Shield
} from 'lucide-react';
import './Sidebar.css';
import logo from '../logo.png';

const Sidebar = ({ activeTab, setActiveTab, handleLogout, role, userName, isOpen, isCollapsed, onClose, onToggleCollapse }) => {
  const allMenuItems = [
    { id: 'dashboard',  label: 'Main Dashboard',     icon: LayoutDashboard },
    { id: 'bookings',   label: 'Bookings',           icon: Car },
    { id: 'vehicles',   label: 'Manage Fleet',       icon: Truck },
    { id: 'salaries',   label: 'Staff Salaries',     icon: Contact },
    { id: 'payments',   label: 'Payment History',    icon: CreditCard },
    { id: 'invoices',   label: 'Customer Invoices',  icon: FileText },
    { id: 'quotations', label: 'Price Quotes',       icon: FileCheck },
    { id: 'expenses',    label: 'Other Expenses',    icon: TrendingDown },
    { id: 'clients',    label: 'Client List',        icon: Users },
    { id: 'compliance', label: 'Renewals & Safety',  icon: FileCheck },
    { id: 'employees',  label: 'Our Team',           icon: UserCircle },
    { id: 'reports',    label: 'Financial Reports',  icon: FileBarChart },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (role !== 'Admin' && role !== 'Manager') {
      return ['dashboard', 'bookings', 'vehicles', 'compliance'].includes(item.id);
    }
    return true;
  });

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-row">
          <img src={logo} alt="RAXWO" className="raxwo-logo-img" />
          <button className="sidebar-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {!isCollapsed && (
          <div className="logo-text">
            <span className="logo-subtitle">PREMIUM FLEET MANAGEMENT</span>
          </div>
        )}
      </div>
      
      {!isCollapsed && (
        <div className="sidebar-user-section">
          <div className="user-profile-glass">
            <div className="avatar-wrapper">
               <div className="profile-initials">{(userName || 'A')[0].toUpperCase()}</div>
               <div className="online-indicator"></div>
            </div>
            <div className="profile-info">
              <p className="profile-name">{userName && userName !== 'null' ? userName : 'Administrator'}</p>
              <div className="role-badge">
                 <Shield size={10} />
                 <span>{role || 'System'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
            <div className="profile-initials" style={{ width: '40px', height: '40px', fontSize: '0.9rem' }}>
                {(userName || 'A')[0].toUpperCase()}
            </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              title={isCollapsed ? item.label : ''}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth <= 1024) onClose();
              }}
            >
              <div className="nav-icon-box">
                <Icon size={18} />
              </div>
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
