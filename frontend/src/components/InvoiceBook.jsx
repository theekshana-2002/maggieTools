import React, { useState, useEffect, useMemo } from 'react';
import api, { invoiceAPI, paymentAPI, clientAPI } from '../services/api';
import DataTable from './DataTable';
import Modal from './Modal';
import RecordDetails from './RecordDetails';
import InvoiceForm from './InvoiceForm';
import { FileText, Plus, Download, Trash2, Search, RefreshCw, FileDown, TrendingUp, CheckCircle, Clock, CreditCard, PlusCircle, Printer, Users , Eye } from 'lucide-react';
import { generateInvoicePDF } from '../utils/billingGenerator';
import { generateGenericReportPDF } from '../utils/genericReportGenerator';
import '../styles/forms.css';
import '../styles/books.css';

const InvoiceBook = ({ initialTab }) => {
  const userRole = localStorage.getItem('raxwo_user_role');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canManage = isDev || ['Admin', 'Manager'].includes(userRole);

  const [activeTab, setActiveTab] = useState(initialTab || 'Summaries');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // For client modal showing their specific invoices & payments
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, payRes, cliRes] = await Promise.all([
        api.get('invoices'),
        paymentAPI.get(),
        clientAPI.get()
      ]);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      setClients(Array.isArray(cliRes.data) ? cliRes.data : []);
    } catch (err) { 
      console.error('Fetch failed', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleMarkAsPaid = async (id) => {
    if (window.confirm('Mark this invoice as fully paid? This will update the balance to zero.')) {
      try {
        await invoiceAPI.pay(id);
        setSuccessMsg('Invoice marked as Paid!');
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        alert('Failed to update invoice status.');
      }
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (window.confirm('Are you sure you want to delete this invoice? This cannot be undone.')) {
      try {
        await api.delete(`invoices/${id}`);
        fetchData();
      } catch (err) {
        alert('Failed to delete invoice.');
      }
    }
  };
  
  const handleDeletePayment = async (id) => {
    if (window.confirm('Delete this payment record?')) {
      try {
        await paymentAPI.delete(id);
        fetchData();
      } catch {
        alert('Failed to delete payment.');
      }
    }
  };

  // --- Data Transformations --- //

  // 1. Client Summaries
  const clientSummaries = useMemo(() => {
    const summaryMap = {};
    
    // Initialize with known clients
    clients.forEach(c => {
      summaryMap[c.name] = { clientName: c.name, totalInvoices: 0, totalBilled: 0, advancePayments: 0, totalPaid: 0, openBalance: 0 };
    });
    
    // Add Invoice Data
    invoices.forEach(inv => {
      const cName = inv.clientName || 'Unknown';
      if (!summaryMap[cName]) summaryMap[cName] = { clientName: cName, totalInvoices: 0, totalBilled: 0, advancePayments: 0, totalPaid: 0, openBalance: 0 };
      
      summaryMap[cName].totalInvoices += 1;
      const total = inv.totalAmount || 0;
      const balance = inv.balanceAmount !== undefined ? inv.balanceAmount : total;
      
      summaryMap[cName].totalBilled += total;
      summaryMap[cName].openBalance += balance;
    });

    // Add Payment Data (Advance / Paid)
    payments.forEach(pay => {
      const cName = pay.client || 'Unknown';
      if (!summaryMap[cName]) summaryMap[cName] = { clientName: cName, totalInvoices: 0, totalBilled: 0, advancePayments: 0, totalPaid: 0, openBalance: 0 };
      
      const amt = pay.takenAmount || pay.paidAmount || 0;
      summaryMap[cName].totalPaid += amt;
      // If it's labeled as advance or open balance is zero, we could try to guess, but let's just show Total Paid
      if (pay.type === 'Advance' || (pay.notes && pay.notes.toLowerCase().includes('advance'))) {
        summaryMap[cName].advancePayments += amt;
      }
    });

    // Recalculate Open Balance just in case (Billed - Paid is a good fallback if we want to combine them, but let's stick to invoice balances)
    // Actually, it's better to show the calculated balance:
    Object.values(summaryMap).forEach(s => {
      // Just formatting
      s.totalBilled_disp = <strong style={{ color: 'var(--text-main)' }}>LKR {s.totalBilled.toLocaleString()}</strong>;
      s.totalPaid_disp = <span style={{ color: 'var(--success)' }}>LKR {s.totalPaid.toLocaleString()}</span>;
      s.advancePayments_disp = <span style={{ color: 'var(--accent)' }}>LKR {s.advancePayments.toLocaleString()}</span>;
      s.openBalance_disp = <strong style={{ color: s.openBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {s.openBalance.toLocaleString()}</strong>;
      s.action = (
        <button className="action-icon-btn btn-details" onClick={() => { setSelectedClientName(s.clientName); setClientModalOpen(true); }}>
          <Search />
        </button>
      );
    });

    return Object.values(summaryMap).filter(s => s.totalInvoices > 0 || s.totalPaid > 0);
  }, [invoices, payments, clients]);

  const filteredSummaries = useMemo(() => {
    return clientSummaries.filter(s => s.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clientSummaries, searchTerm]);


  // 2. All Invoices
  const formattedInvoices = useMemo(() => {
    return invoices.map(inv => {
      const total = inv.totalAmount || 0;
      const balance = inv.balanceAmount !== undefined ? inv.balanceAmount : total;
      return {
        ...inv,
        rawData: inv,
        invoiceNo_disp: <strong style={{ color: 'var(--text-main)' }}>{inv.invoiceNo}</strong>,
        date_disp: new Date(inv.date).toLocaleDateString(),
        TOTAL: <strong style={{ color: 'var(--accent)' }}>LKR {total.toLocaleString()}</strong>,
        BALANCE: <strong style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {balance.toLocaleString()}</strong>,
        status_disp: (
          <span className={`status-badge ${inv.status === 'Paid' ? 'status-completed' : inv.status === 'Cancelled' ? 'status-cancelled' : 'status-active'}`}>
            {inv.status || 'Draft'}
          </span>
        ),
        action: (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            
                <button className="action-icon-btn btn-details" onClick={(e) => { e.stopPropagation(); setSelectedRecord(inv.rawData || inv); setIsDetailsOpen(true); }} title="View Details">
                  <Eye />
                </button>
                <button className="action-icon-btn btn-print" onClick={() => generateInvoicePDF(inv)} title="Download PDF">
               <FileDown />
            </button>
            <button className="action-icon-btn btn-details" style={{ background: '#64748b', color:'#fff' }} onClick={() => generateInvoicePDF(inv, 'print')} title="Direct Print">
               <Printer />
            </button>
            {canManage && (
              <>
                <button className="action-icon-btn btn-details" onClick={() => { setEditingItem(inv); setShowModal(true); }} title="Edit Invoice">
                  <FileText />
                </button>
                {inv.status !== 'Paid' && (
                  <button className="action-icon-btn btn-msg" onClick={() => handleMarkAsPaid(inv._id)} title="Mark as Paid">
                    <CheckCircle />
                  </button>
                )}
                <button className="action-icon-btn btn-delete" onClick={() => handleDeleteInvoice(inv._id)} title="Delete Invoice">
                  <Trash2 />
                </button>
              </>
            )}
          </div>
        )
      };
    }).filter(inv => 
      (inv.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.invoiceNo  || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm, canManage]);

  // 3. All Payments
  const formattedPayments = useMemo(() => {
    return payments.map(pay => {
      return {
        ...pay,
        rawData: pay,
        date_disp: pay.date ? new Date(pay.date).toLocaleDateString() : '—',
        CLIENT: pay.client || '—',
        TOOL: pay.tool || pay.vehicle || '—',
        HIRE_AMT: `LKR ${(pay.hireAmount || 0).toLocaleString()}`,
        PAID: <strong style={{ color: 'var(--success)' }}>LKR ${(pay.takenAmount || 0).toLocaleString()}</strong>,
        BALANCE: `LKR ${(pay.balance || 0).toLocaleString()}`,
        status_disp: (
          <span className={`status-badge ${pay.status === 'Paid' ? 'status-completed' : 'status-active'}`}>
            {pay.status || 'Pending'}
          </span>
        ),
        action: (
          <div className="table-actions" onClick={e => e.stopPropagation()}>
            
            <button className="action-icon-btn btn-details" onClick={(e) => { e.stopPropagation(); setSelectedRecord(pay.rawData || pay); setIsDetailsOpen(true); }} title="View Details">
              <Eye />
            </button>
            {canManage && (
              <button className="action-icon-btn btn-delete" onClick={() => handleDeletePayment(pay._id)}>
                <Trash2 />
              </button>
            )}
          </div>
        )
      };
    }).filter(pay => 
      (pay.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pay.tool || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [payments, searchTerm, canManage]);


  const stats = useMemo(() => ({
    totalBilled: invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
    totalPaid: payments.reduce((sum, p) => sum + (p.takenAmount || 0), 0),
    pendingInvoices: invoices.filter(i => i.status !== 'Paid').length,
  }), [invoices, payments]);

  return (
    <div className="book-container">
      {/* ── Header ── */}
      <div className="book-header" style={{ marginBottom: '10px' }}>
        <div className="header-title">
          <h2>Invoices & Payments</h2>
        </div>
        <p className="header-subtitle">Billing & Receivables</p>
      </div>
      <div className="book-filters">
        <div className="bf-top-row">
          
           <div className="search-and-refresh" style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <div className="search-box-unified">
             <Search className="search-icon" size={18} />
             <input type="text" placeholder="Search records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
            <button className="utility-icon-btn" onClick={fetchData} title="Refresh"><RefreshCw size={18} className={loading ? 'spinner' : ''} /></button>
          </div>
           
        
        </div>
      </div>
 
      {/* ── Summary ── */}
      <div className="book-summary">
        <div className="summary-item">
          <label>Total Billed</label>
          <h3>LKR {stats.totalBilled.toLocaleString()}</h3>
          <TrendingUp size={16} color="var(--accent)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Total Paid Received</label>
          <h3 style={{ color: 'var(--success)' }}>LKR {stats.totalPaid.toLocaleString()}</h3>
          <CreditCard size={16} color="var(--success)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
        <div className="summary-item">
          <label>Pending Invoices</label>
          <h3 style={{ color: 'var(--warning)' }}>{stats.pendingInvoices} Records</h3>
          <Clock size={16} color="var(--warning)" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.2 }} />
        </div>
      </div>
      
      {/* ── Tabs ── */}
      <div className="tab-switcher" style={{ marginTop: '20px' }}>
        <button className={activeTab === 'Summaries' ? 'active-tab' : ''} onClick={() => setActiveTab('Summaries')}>Customer Summaries</button>
        <button className={activeTab === 'Invoices' ? 'active-tab' : ''} onClick={() => setActiveTab('Invoices')}>All Invoices</button>
        <button className={activeTab === 'Payments' ? 'active-tab' : ''} onClick={() => setActiveTab('Payments')}>Payment History</button>
      </div>
 
      {successMsg && <div className="success-banner" style={{ margin: '0 20px 20px' }}>{successMsg}</div>}

      <div className="compliance-card">
        {activeTab === 'Summaries' && (
          <DataTable 
            columns={['CUSTOMER', 'TOTAL INVOICES', 'TOTAL BILLED', 'ADVANCE PAYMENTS', 'TOTAL PAID', 'OPEN BALANCE', 'VIEW']}
            data={filteredSummaries.map(s => ({
              ...s,
              CUSTOMER: <strong style={{ color: 'var(--text-main)' }}>{s.clientName}</strong>,
              'TOTAL INVOICES': `${s.totalInvoices} Invoices`,
              'TOTAL BILLED': s.totalBilled_disp,
              'ADVANCE PAYMENTS': s.advancePayments_disp,
              'TOTAL PAID': s.totalPaid_disp,
              'OPEN BALANCE': s.openBalance_disp,
              VIEW: s.action
            }))}
            loading={loading}
          />
        )}
        {activeTab === 'Invoices' && (
          <DataTable 
            columns={['INV#', 'DATE', 'CLIENT', 'TOTAL', 'BALANCE', 'STATUS', 'ACTION']}
            data={formattedInvoices.map(r => ({
               'INV#': r.invoiceNo_disp,
               'DATE': r.date_disp,
               'CLIENT': r.clientName,
               'TOTAL': r.TOTAL,
               'BALANCE': r.BALANCE,
               'STATUS': r.status_disp,
               'ACTION': r.action
            }))}
            loading={loading}
            
          />
        )}
        {activeTab === 'Payments' && (
          <DataTable 
            columns={['DATE', 'CLIENT', 'TOOL', 'HIRE AMT', 'PAID', 'BALANCE', 'STATUS', 'ACTION']}
            data={formattedPayments.map(r => ({
               'DATE': r.date_disp,
               'CLIENT': r.CLIENT,
               'TOOL': r.TOOL,
               'HIRE AMT': r.HIRE_AMT,
               'PAID': r.PAID,
               'BALANCE': r.BALANCE,
               'STATUS': r.status_disp,
               'ACTION': r.action
            }))}
            loading={loading}
            
          />
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? "Edit Invoice" : "Generate New Invoice"}>
        <InvoiceForm onSubmit={async (d) => { if (editingItem) await api.put(`/invoices/${editingItem._id}`, d); else await api.post('/invoices', d); setShowModal(false); fetchData(); }} onCancel={() => setShowModal(false)} initialData={editingItem} />
      </Modal>

      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Transaction Details">
        <RecordDetails data={selectedRecord} type={activeTab === 'Payments' ? 'payment' : 'invoice'} />
      </Modal>
      
      {/* Specific Client Modal */}
      <Modal isOpen={clientModalOpen} onClose={() => setClientModalOpen(false)} title={`${selectedClientName} - Financial Details`} wide>
        <div style={{ padding: '20px' }}>
          <h4>Invoices</h4>
          <DataTable 
            columns={['INV#', 'DATE', 'TOTAL', 'BALANCE', 'STATUS']}
            data={formattedInvoices.filter(i => i.clientName === selectedClientName).map(r => ({
               'INV#': r.invoiceNo_disp,
               'DATE': r.date_disp,
               'TOTAL': r.TOTAL,
               'BALANCE': r.BALANCE,
               'STATUS': r.status_disp,
            }))}
            loading={false}
          />
          <h4 style={{ marginTop: '20px' }}>Payments</h4>
          <DataTable 
            columns={['DATE', 'TOOL', 'PAID', 'BALANCE', 'STATUS']}
            data={formattedPayments.filter(p => p.CLIENT === selectedClientName).map(r => ({
               'DATE': r.date_disp,
               'TOOL': r.TOOL,
               'PAID': r.PAID,
               'BALANCE': r.BALANCE,
               'STATUS': r.status_disp,
            }))}
            loading={false}
          />
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceBook;
