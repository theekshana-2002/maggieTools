import React from 'react';
import { ShieldCheck, Users, HardHat, ChevronRight } from 'lucide-react';
import './RoleSelection.css';
import logo from '../logo.png';

const RoleSelection = ({ onRoleSelect }) => {
  const roles = [
    {
      id: 'Admin',
      title: 'System Administrator',
      desc: 'Full access to financial records, fleet oversight, and global management.',
      icon: ShieldCheck,
      color: 'var(--accent)',
    },
    {
      id: 'Manager',
      title: 'Operations Manager',
      desc: 'Manage day-to-day car bookings, client relations, and operational reports.',
      icon: Users,
      color: '#10B981',
    },
    {
      id: 'Employee',
      title: 'Staff Portal',
      desc: 'Track assignments, salary history, and individual job performance.',
      icon: HardHat,
      color: '#F59E0B',
    }
  ];

  return (
    <div className="gateway-layout">
      <div className="gateway-bg-decoration">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <div className="gateway-content">
        <div className="gateway-header">
          <img src={logo} alt="RAXWO Logo" className="gateway-logo" />
          <h1>RAXWO <span>Rent A Car</span></h1>
          <p>The Standard of Excellence in Fleet Management.</p>
        </div>

        <div className="gateway-grid">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div 
                key={role.id} 
                className="gateway-card" 
                onClick={() => onRoleSelect(role.id)}
                style={{ '--role-color': role.color }}
              >
                <div className="card-top">
                  <div className="gateway-icon-box">
                    <Icon size={32} />
                  </div>
                  <h3>{role.title}</h3>
                  <p>{role.desc}</p>
                </div>
                
                <div className="gateway-card-footer">
                  <span>Enter Dashboard</span>
                  <div className="action-circle">
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="gateway-footer">
          <p>© {new Date().getFullYear()} RAXWO International. Secure Gateway System.</p>
        </footer>
      </div>
    </div>
  );
};

export default RoleSelection;
