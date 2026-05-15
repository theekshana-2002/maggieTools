import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, TrendingUp, TrendingDown, Wallet, FileText, RefreshCw, Package } from 'lucide-react';
import { hireAPI, bookingAPI, salaryAPI, paymentAPI, extraIncomeAPI, expenseAPI, toolAPI } from '../services/api';
import logoUrl from '../logo.png';
import '../styles/report.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const FinancialReport = ({ appSettings }) => {
  const [data, setData] = useState({ hires: [], bookings: [], salaries: [], payments: [], extraIncome: [], expenses: [], tools: [] });
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
      const [h, b, s, p, ei, ex, t] = await Promise.all([
        hireAPI.get(),
        bookingAPI.get(),
        salaryAPI.get(),
        paymentAPI.get(),
        extraIncomeAPI.get(),
        expenseAPI.get(),
        toolAPI.get()
      ]);
      setData({
        hires: h.data || [],
        bookings: b.data || [],
        salaries: s.data || [],
        payments: p.data || [],
        extraIncome: ei.data || [],
        expenses: ex.data || [],
        tools: t.data || []
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

    // Polling as a fallback (every 10 seconds)
    const interval = setInterval(() => fetchAll(true), 10000);

    // Real-time update listeners
    const handleRefresh = () => fetchAll(true);

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('raxwo_data_updated', handleRefresh);
    window.addEventListener('raxwo_lease_updated', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('raxwo_data_updated', handleRefresh);
      window.removeEventListener('raxwo_lease_updated', handleRefresh);
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

  const filterSalaries = (records) => {
    return records.filter(r => {
      const period = r.month || '';
      if (selectedMonth === 'All') return period.includes(selectedYear);
      return period.includes(selectedMonth) && period.includes(selectedYear);
    });
  };

  const stats = useMemo(() => {
    const fHires = filterByPeriod(data.hires, 'date');
    const fBookings = filterByPeriod(data.bookings, 'date');
    const fSalaries = filterSalaries(data.salaries);
    const fPayments = filterByPeriod(data.payments, 'date');
    const fExtraIncome = filterByPeriod(data.extraIncome, 'date');
    const fExpenses = filterByPeriod(data.expenses, 'date');

    // Tally Rental Revenue correctly from primary records (Hires + Bookings)
    // fHires uses .totalAmount or .billAmount, fBookings uses .amount or .totalAmount
    const totalHireRevenue = fHires.reduce((s, r) => s + (parseFloat(r.totalAmount || r.billAmount) || 0), 0);
    const totalBookingRevenue = fBookings.reduce((s, r) => s + (parseFloat(r.totalAmount || r.amount) || 0), 0);
    const totalRentalRevenue = totalHireRevenue + totalBookingRevenue;

    const totalSalary = fSalaries.reduce((s, r) => s + (parseFloat(r.netPay) || 0), 0);
    const totalPayments = fPayments.reduce((s, r) => s + (parseFloat(r.takenAmount || r.paidAmount) || 0), 0);
    const totalExtraIncome = fExtraIncome.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalOtherExp = fExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const totalLeasing = data.tools
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


    const totalIncome = totalRentalRevenue + totalExtraIncome;
    const totalExpense = totalSalary + totalOtherExp + totalLeasing;
    const netProfit = totalIncome - totalExpense;

    // Actual Cash in Hand: Actual Payments Received + Extra Income - Expenses
    const cashBalance = (totalPayments + totalExtraIncome) - totalExpense;

    // Group payments by payment method for the breakdown
    const paymentsByMethod = fPayments.reduce((acc, r) => {
      const method = r.paymentMethod || 'Cash';
      const amount = parseFloat(r.takenAmount || r.paidAmount) || 0;
      if (!acc[method]) acc[method] = 0;
      acc[method] += amount;
      return acc;
    }, {});

    return {
      fHires, fBookings, fSalaries, fPayments, fExtraIncome, fExpenses,
      totalRentalRevenue, totalHireRevenue, totalBookingRevenue,
      totalSalary, totalPayments, totalExtraIncome, totalOtherExp, totalLeasing,
      totalIncome, totalExpense, netProfit, cashBalance,
      paymentsByMethod
    };
  }, [data, selectedMonth, selectedYear]);

  const periodLabel = selectedMonth === 'All'
    ? `Full Year ${selectedYear}`
    : `${selectedMonth} ${selectedYear}`;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const [jspdfMod, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);

      const jsPDF = jspdfMod.default || jspdfMod.jsPDF || jspdfMod;
      const html2canvas = html2canvasMod.default || html2canvasMod;

      const element = reportRef.current;
      if (!element) return;

      // Add class to body to ensure CSS selectors like .is-downloading #report-document work
      document.body.classList.add('is-downloading');

      // Small delay to allow the layout to recalculate
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
      });

      document.body.classList.remove('is-downloading');

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      // Add pages
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const filename = `Financial_Report_${selectedMonth === 'All' ? selectedYear : `${selectedMonth}_${selectedYear}`}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      document.body.classList.remove('is-downloading');
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

        <button className="download-btn-premium" onClick={handleDownload} disabled={downloading}>
          <Download size={18} />
          <span>{downloading ? 'Preparing PDF...' : 'Download Full Report'}</span>
        </button>
      </div>

      <div id="report-document" ref={reportRef}>

        <div className="report-header">
          <div className="report-header-left">
            <img src={appSettings?.logo || logoUrl} alt="Logo" className="report-logo" />
            <div className="report-title">
              <h2>{appSettings?.companyName || 'RAXWO Tool Rentals'}</h2>
              <p>{appSettings?.tagline || 'Premium Tool Rental & Equipment Management'}</p>
            </div>
          </div>
          <div className="report-contact-info">
            <p>{appSettings?.address || '123 Main Street, Colombo'}</p>
            <p>Phone: {appSettings?.phone || '+94 77 123 4567'}</p>
            <p>Email: {appSettings?.email || 'info@raxwo.com'}</p>
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

        <div className="report-kpi-grid">
          <div className="kpi-card" style={{ '--kpi-color': '#2563EB' }}>
            <div className="kpi-label">Total Revenue</div>
            <div className="kpi-value">LKR {stats.totalIncome.toLocaleString()}</div>
            <div className="kpi-sub">Rental + Extra Income</div>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': '#EF4444' }}>
            <div className="kpi-label">Total Outgoings</div>
            <div className="kpi-value">LKR {stats.totalExpense.toLocaleString()}</div>
            <div className="kpi-sub">Staff, Lease, Other Expenses</div>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': '#F59E0B' }}>
            <div className="kpi-label">Rental Revenue</div>
            <div className="kpi-value">LKR {stats.totalRentalRevenue.toLocaleString()}</div>
            <div className="kpi-sub">{stats.fHires.length + stats.fBookings.length} total rental entries</div>
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

        <div className="report-section">
          <div className="report-section-title">Income &amp; Expense Breakdown</div>
          <div className="report-section-table-wrapper">
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
                  <td><span className="cat-badge cat-revenue">Rental Revenue</span></td>
                  <td>Income</td>
                  <td>{stats.fHires.length + stats.fBookings.length}</td>
                  <td className="amount-cell amount-pos">+ {stats.totalRentalRevenue.toLocaleString()}</td>
                  <td>{stats.totalIncome > 0 ? ((stats.totalRentalRevenue / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
                </tr>
                <tr>
                  <td><span className="cat-badge cat-revenue">Extra Income</span></td>
                  <td>Income</td>
                  <td>{stats.fExtraIncome.length}</td>
                  <td className="amount-cell amount-pos">+ {stats.totalExtraIncome.toLocaleString()}</td>
                  <td>{stats.totalIncome > 0 ? ((stats.totalExtraIncome / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
                </tr>
                <tr>
                  <td><span className="cat-badge cat-revenue" style={{ background: '#8B5CF6', color: '#fff' }}>Payments Received</span></td>
                  <td>Info</td>
                  <td>{stats.fPayments.length}</td>
                  <td className="amount-cell amount-pos">+ {stats.totalPayments.toLocaleString()}</td>
                  <td>—</td>
                </tr>
                {Object.entries(stats.paymentsByMethod).map(([method, amount], idx) => (
                  amount > 0 ? (
                    <tr key={`pm-${idx}`} style={{ backgroundColor: 'var(--bg-main)', fontSize: '0.9rem' }}>
                      <td style={{ paddingLeft: '30px' }}>↳ {method}</td>
                      <td>Info</td>
                      <td>—</td>
                      <td className="amount-cell amount-pos">+ {amount.toLocaleString()}</td>
                      <td>{stats.totalPayments > 0 ? ((amount / stats.totalPayments) * 100).toFixed(1) + '%' : '—'}</td>
                    </tr>
                  ) : null
                ))}
                <tr>
                  <td><span className="cat-badge cat-expense">Staff Wages</span></td>
                  <td>Expense</td>
                  <td>{stats.fSalaries.length}</td>
                  <td className="amount-cell amount-neg">− {stats.totalSalary.toLocaleString()}</td>
                  <td>{stats.totalIncome > 0 ? ((stats.totalSalary / stats.totalIncome) * 100).toFixed(1) + '%' : '—'}</td>
                </tr>
                <tr>
                  <td><span className="cat-badge cat-expense">Leasing Payments</span></td>
                  <td>Expense</td>
                  <td>{data.tools.filter(t => t.hasLeasing).length} units</td>
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
        </div>

        {stats.fHires.length > 0 && (
          <div className="report-section">
            <div className="report-section-title">Recent Rental Transactions</div>
            <div className="transactions-list">
              {stats.fHires.slice(0, 6).map((h, i) => (
                <div key={i} className="txn-item">
                  <div className="txn-dot" style={{ background: '#2563EB' }}></div>
                  <div className="txn-info">
                    <p>{h.client || 'Customer'} — {h.tool || h.vehicle || 'Tool ID'}</p>
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

        {stats.fSalaries.length > 0 && (
          <div className="report-section">
            <div className="report-section-title">Staff Salary Disbursements</div>
            <div className="transactions-list">
              {stats.fSalaries.slice(0, 6).map((s, i) => (
                <div key={i} className="txn-item">
                  <div className="txn-dot" style={{ background: '#F59E0B' }}></div>
                  <div className="txn-info">
                    <p>{s.employee || 'Staff'} — {s.role || 'Role'}</p>
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

        <div className="report-footer">
          <span>{appSettings?.companyName || 'RAXWO Tool Rentals'} Management System · Confidential</span>
          <span>Generated on {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default FinancialReport;
