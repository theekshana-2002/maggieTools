import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, TrendingUp, TrendingDown, Wallet, Fuel, FileText, RefreshCw } from 'lucide-react';
import { hireAPI, dieselAPI, salaryAPI, paymentAPI, extraIncomeAPI, expenseAPI, vehicleAPI } from '../services/api';
import logoUrl from '../logo.png';
import '../styles/report.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const FinancialReport = () => {
  const [data, setData] = useState({ hires: [], diesel: [], salaries: [], payments: [], extraIncome: [], expenses: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [refreshing, setRefreshing] = useState(false);
  const reportRef = useRef(null);

  const fetchAll = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const [h, d, s, p, ei, ex, v] = await Promise.all([
        hireAPI.get(),
        dieselAPI.get(),
        salaryAPI.get(),
        paymentAPI.get(),
        extraIncomeAPI.get(),
        expenseAPI.get(),
        vehicleAPI.get()
      ]);
      setData({
        hires: h.data || [],
        diesel: d.data || [],
        salaries: s.data || [],
        payments: p.data || [],
        extraIncome: ei.data || [],
        expenses: ex.data || [],
        vehicles: v.data || []
      });
    } catch (err) {
      console.error('Report fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
    
    // Auto-refresh every 15 seconds silently
    const interval = setInterval(() => fetchAll(true), 15000);

    // Refresh on window focus or lease payment toggle
    const handleFocus = () => fetchAll(true);
    const handleLease = () => fetchAll(true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('kt_lease_updated', handleLease);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('kt_lease_updated', handleLease);
    };
  }, []);

  // ── Helper: filter records by selected month/year ──
  const filterByPeriod = (records, dateField = 'date') => {
    return records.filter(r => {
      const d = new Date(r[dateField] || r.createdAt);
      const yearMatch = d.getFullYear() === parseInt(selectedYear);
      const monthMatch = selectedMonth === 'All' || d.getMonth() === MONTHS.indexOf(selectedMonth);
      return yearMatch && monthMatch;
    });
  };

  const filterSalaries = (records) => {
    return records.filter(r => {
      const period = r.month || ''; // e.g. "April 2025"
      if (selectedMonth === 'All') return period.includes(selectedYear);
      return period.includes(selectedMonth) && period.includes(selectedYear);
    });
  };

  const stats = useMemo(() => {
    const fHires       = filterByPeriod(data.hires, 'date');
    const fDiesel      = filterByPeriod(data.diesel, 'date');
    const fSalaries    = filterSalaries(data.salaries);
    const fPayments    = filterByPeriod(data.payments, 'date');
    const fExtraIncome = filterByPeriod(data.extraIncome, 'date');
    const fExpenses    = filterByPeriod(data.expenses, 'date');

    const totalHire        = fPayments.reduce((s, r) => s + (parseFloat(r.hireAmount) || 0), 0);
    const totalDiesel      = fDiesel.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const totalSalary      = fSalaries.reduce((s, r) => s + (parseFloat(r.netPay) || 0), 0);
    const totalPayments    = fPayments.reduce((s, r) => s + (parseFloat(r.takenAmount) || 0), 0);
    const totalExtraIncome = fExtraIncome.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalOtherExp    = fExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // Leasing — only count months marked as PAID
    const totalLeasing = data.vehicles
      .filter(v => v.hasLeasing && v.monthlyPremium)
      .reduce((s, v) => {
        const premium = parseFloat(v.monthlyPremium) || 0;
        const payments = v.leasePayments || [];
        if (selectedMonth === 'All') {
          const paidMonths = payments.filter(lp =>
            lp.year === parseInt(selectedYear) && lp.paid
          ).length;
          return s + paidMonths * premium;
        } else {
          const monthIdx = MONTHS.indexOf(selectedMonth) + 1;
          const entry = payments.find(lp =>
            lp.year === parseInt(selectedYear) && lp.month === monthIdx && lp.paid
          );
          return s + (entry ? premium : 0);
        }
      }, 0);


    const totalIncome   = totalHire + totalExtraIncome;
    const totalExpense  = totalDiesel + totalSalary + totalOtherExp + totalLeasing;
    const netProfit     = totalIncome - totalExpense;
    const cashBalance   = (totalPayments + totalExtraIncome) - totalExpense;

    return {
      fHires, fDiesel, fSalaries, fPayments, fExtraIncome, fExpenses,
      totalHire, totalDiesel, totalSalary, totalPayments, totalExtraIncome, totalOtherExp, totalLeasing,
      totalIncome, totalExpense, netProfit, cashBalance
    };
  }, [data, selectedMonth, selectedYear]);

  const periodLabel = selectedMonth === 'All'
    ? `Full Year ${selectedYear}`
    : `${selectedMonth} ${selectedYear}`;

  // ── PDF Download using jsPDF + html2canvas ──
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Multi-page support
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const filename = `KT_Report_${selectedMonth === 'All' ? selectedYear : `${selectedMonth}_${selectedYear}`}.pdf`;
      pdf.save(filename);
    } catch (err) {
      alert('Could not generate PDF. Please try again.\n' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="report-loading">
        <div className="spinner"></div>
        <p>Loading financial data...</p>
      </div>
    );
  }

  return (
    <div className="report-container">

      {/* ── Controls ── */}
      <div className="report-controls">
        <label>Month</label>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          <option value="All">All Months</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label>Year</label>
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="report-divider" />

        <button className="refresh-btn-alt" onClick={() => fetchAll(false)}>
          <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>

        <button className="download-btn" onClick={handleDownload} disabled={downloading}>
          <Download size={16} />
          {downloading ? 'Generating PDF...' : 'Download PDF'}
        </button>
      </div>

      {/* ── Report Document (captured for PDF) ── */}
      <div id="report-document" ref={reportRef}>

        {/* Header */}
        <div className="report-header">
          <div className="report-header-left">
            <img src={logoUrl} alt="Logo" className="report-logo" />
            <div className="report-title">
              <h2>RAXWO Rent A Car</h2>
              <p>Premium Car Rental & Fleet Management</p>
            </div>
          </div>
          <div className="report-contact-info">
            <p>123 Main Street, Colombo</p>
            <p>Phone: +94 77 123 4567</p>
            <p>Email: info@raxwo.com</p>
          </div>
        </div>

        <div className="report-divider-line"></div>

        <div className="report-meta-section">
          <h3 className="report-doc-title">Financial Report &amp; Analytics</h3>
          <div className="report-meta-details">
            <div><strong>Period:</strong> {periodLabel}</div>
            <div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
            <div><strong>Currency:</strong> LKR</div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="report-kpi-grid">
          <div className="kpi-card" style={{ '--kpi-color': '#2563EB' }}>
            <div className="kpi-label">Total Revenue</div>
            <div className="kpi-value">LKR {stats.totalIncome.toLocaleString()}</div>
            <div className="kpi-sub">Hire + Extra Income</div>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': '#EF4444' }}>
            <div className="kpi-label">Total Outgoings</div>
            <div className="kpi-value">LKR {stats.totalExpense.toLocaleString()}</div>
            <div className="kpi-sub">Salaries, Fuel, Lease, Other</div>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': '#F59E0B' }}>
            <div className="kpi-label">Hire Revenue</div>
            <div className="kpi-value">LKR {stats.totalHire.toLocaleString()}</div>
            <div className="kpi-sub">{stats.fHires.length} jobs completed</div>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': '#10B981' }}>
            <div className="kpi-label">Payments Received</div>
            <div className="kpi-value">LKR {stats.totalPayments.toLocaleString()}</div>
            <div className="kpi-sub">Cash actually collected</div>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': '#8B5CF6' }}>
            <div className="kpi-label">Cash Balance</div>
            <div className="kpi-value">LKR {stats.cashBalance.toLocaleString()}</div>
            <div className="kpi-sub">Actual Cash in Hand</div>
          </div>
          <div className={`kpi-card ${stats.netProfit >= 0 ? 'kpi-profit' : 'kpi-loss'}`}
               style={{ '--kpi-color': stats.netProfit >= 0 ? '#10B981' : '#EF4444' }}>
            <div className="kpi-label">Net Profit / Loss</div>
            <div className="kpi-value">LKR {stats.netProfit.toLocaleString()}</div>
            <div className="kpi-sub">Total Income − Total Expenses</div>
          </div>
        </div>



        {/* ── Income & Expense Breakdown ── */}
        <div className="report-section">
          <div className="report-section-title">Income & Expense Breakdown</div>
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th>Count</th>
                <th>Amount (LKR)</th>
                <th>% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="cat-badge cat-revenue">Hire Revenue</span></td>
                <td>Income</td>
                <td>{stats.fHires.length}</td>
                <td className="amount-cell amount-pos">+ {stats.totalHire.toLocaleString()}</td>
                <td>{stats.totalIncome > 0 ? ((stats.totalHire / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
              <tr>
                <td><span className="cat-badge cat-revenue">Extra Income</span></td>
                <td>Income</td>
                <td>{stats.fExtraIncome.length}</td>
                <td className="amount-cell amount-pos">+ {stats.totalExtraIncome.toLocaleString()}</td>
                <td>{stats.totalIncome > 0 ? ((stats.totalExtraIncome / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
              <tr>
                <td><span className="cat-badge cat-revenue">Payments Received</span></td>
                <td>Info</td>
                <td>{stats.fPayments.length}</td>
                <td className="amount-cell amount-pos">+ {stats.totalPayments.toLocaleString()}</td>
                <td>—</td>
              </tr>
              <tr>
                <td><span className="cat-badge cat-expense">Salary Payments</span></td>
                <td>Expense</td>
                <td>{stats.fSalaries.length}</td>
                <td className="amount-cell amount-neg">− {stats.totalSalary.toLocaleString()}</td>
                <td>{stats.totalIncome > 0 ? ((stats.totalSalary / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
              <tr>
                <td><span className="cat-badge cat-expense">Fuel Cost</span></td>
                <td>Expense</td>
                <td>{stats.fDiesel.length}</td>
                <td className="amount-cell amount-neg">− {stats.totalDiesel.toLocaleString()}</td>
                <td>{stats.totalIncome > 0 ? ((stats.totalDiesel / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
              <tr>
                <td><span className="cat-badge cat-expense">Leasing Payments</span></td>
                <td>Expense</td>
                <td>{data.vehicles.filter(v => v.hasLeasing).length} units</td>
                <td className="amount-cell amount-neg">− {stats.totalLeasing.toLocaleString()}</td>
                <td>{stats.totalIncome > 0 ? ((stats.totalLeasing / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
              <tr>
                <td><span className="cat-badge cat-expense">Other Expenses</span></td>
                <td>Expense</td>
                <td>{stats.fExpenses.length}</td>
                <td className="amount-cell amount-neg">− {stats.totalOtherExp.toLocaleString()}</td>
                <td>{stats.totalIncome > 0 ? ((stats.totalOtherExp / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
              <tr className="total-row">
                <td colSpan={3}><strong>Net Profit / Loss</strong></td>
                <td className={`amount-cell ${stats.netProfit >= 0 ? 'amount-pos' : 'amount-neg'}`}>
                  <strong>LKR {stats.netProfit.toLocaleString()}</strong>
                </td>
                <td>{stats.totalIncome > 0 ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Recent Hire Transactions ── */}
        {stats.fHires.length > 0 && (
          <div className="report-section">
            <div className="report-section-title">Recent Hire Jobs</div>
            <div className="transactions-list">
              {stats.fHires.slice(0, 6).map((h, i) => (
                <div key={i} className="txn-item">
                  <div className="txn-dot" style={{ background: '#2563EB' }}></div>
                  <div className="txn-info">
                    <p>{h.client || 'Unknown Client'} — {h.vehicle || 'N/A'}</p>
                    <span>{h.city || '—'} · {h.date ? new Date(h.date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="txn-amount" style={{ color: '#2563EB' }}>
                    LKR {parseFloat(h.amount || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Salary Records ── */}
        {stats.fSalaries.length > 0 && (
          <div className="report-section">
            <div className="report-section-title">Salary Disbursements</div>
            <div className="transactions-list">
              {stats.fSalaries.slice(0, 6).map((s, i) => (
                <div key={i} className="txn-item">
                  <div className="txn-dot" style={{ background: '#F59E0B' }}></div>
                  <div className="txn-info">
                    <p>{s.employee || 'Employee'} — {s.vehicle || '—'}</p>
                    <span>{s.month}</span>
                  </div>
                  <div className="txn-amount" style={{ color: '#EF4444' }}>
                    LKR {parseFloat(s.netPay || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Extra Income ── */}
        {stats.fExtraIncome.length > 0 && (
          <div className="report-section">
            <div className="report-section-title">Other Income Sources</div>
            <div className="transactions-list">
              {stats.fExtraIncome.slice(0, 6).map((ei, i) => (
                <div key={i} className="txn-item">
                  <div className="txn-dot" style={{ background: '#10B981' }}></div>
                  <div className="txn-info">
                    <p>{ei.description || 'Other Income'}</p>
                    <span>{ei.category || 'General'} · {ei.date ? new Date(ei.date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="txn-amount" style={{ color: '#10B981' }}>
                    LKR {parseFloat(ei.amount || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Expenses ── */}
        {stats.fExpenses.length > 0 && (
          <div className="report-section">
            <div className="report-section-title">General Expenses</div>
            <div className="transactions-list">
              {stats.fExpenses.slice(0, 6).map((ex, i) => (
                <div key={i} className="txn-item">
                  <div className="txn-dot" style={{ background: '#EF4444' }}></div>
                  <div className="txn-info">
                    <p>{ex.description || 'Other Expense'}</p>
                    <span>{ex.category || 'General'} · {ex.date ? new Date(ex.date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="txn-amount" style={{ color: '#EF4444' }}>
                    LKR {parseFloat(ex.amount || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="report-footer">
          <span>RAXWO Rent A Car Management System · Confidential</span>
          <span>Generated on {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default FinancialReport;
