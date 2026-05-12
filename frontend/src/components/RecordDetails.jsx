import React from 'react';
import { Download, ShieldCheck, User, Calendar, Package } from 'lucide-react';
import { generateInvoicePDF, generateQuotationPDF } from '../utils/billingGenerator';
import { bookingAPI } from '../services/api';
import './RecordDetails.css';

const RecordDetails = ({ data, type }) => {
  const [history, setHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    if (type === 'client' && data?.name) {
      loadClientHistory();
    }
  }, [data, type]);

  const loadClientHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await bookingAPI.get();
      const clientName = (data.name || '').toLowerCase();
      const rentals = (response.data || []).filter(b => (b.clientName || '').toLowerCase() === clientName);
      setHistory(rentals);
    } catch (err) {
      console.error('History load failed', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!data) return null;

  const formatDate = (val) => {
    if (val === true) return 'Yes / Active';
    if (val === false) return 'No / Inactive';
    if (val === 0) return '0';
    if (val === null || val === undefined || val === '') return '—';
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val === 'string') {
      if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        }
      }
    }
    return val;
  };

  const DetailSection = ({ title, fields }) => (
    <div className="detail-section">
      <h4 className="detail-section-title">
        {title}
      </h4>
      <div className="detail-grid">
        {fields.map((f, i) => (
          <div key={i} className={`detail-field ${f.isImage ? 'full-width' : ''}`}>
            <label>{f.label}</label>
            <p>
              {(() => {
                if (f.value !== undefined) return f.value;
                const val = (data[f.key] !== undefined && data[f.key] !== null && data[f.key] !== '') ? data[f.key] : 
                            (data.rawData && data.rawData[f.key] !== undefined && data.rawData[f.key] !== null) ? data.rawData[f.key] :
                            data[f.key === 'tool' ? 'toolNo' : f.key === 'toolNo' ? 'tool' : f.key === 'tool' ? 'vehicle' : ''];
                
                if (val === undefined || val === null || val === '') return '—';

                if (f.isImage) {
                  return (
                    <div style={{ marginTop: '10px' }}>
                      <img 
                        src={val} 
                        alt={f.label} 
                        style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' }} 
                        onClick={() => window.open(val, '_blank')}
                      />
                    </div>
                  );
                }

                const isCurrency = (f.key.toLowerCase().includes('salary') || f.key.toLowerCase().includes('premium') || f.key.toLowerCase().includes('rate') || f.key.toLowerCase().includes('amount') || f.key.toLowerCase().includes('fee') || f.key.toLowerCase().includes('earnings') || f.key.toLowerCase().includes('allowance') || f.key.toLowerCase().includes('pay') || f.key.toLowerCase().includes('incentive') || f.key.toLowerCase().includes('advance') || f.key.toLowerCase().includes('total') || f.key.toLowerCase().includes('cost') || f.key.toLowerCase().includes('balance')) && 
                                   !f.key.toLowerCase().includes('days') && 
                                   !f.key.toLowerCase().includes('count') && 
                                   !f.key.toLowerCase().includes('limit');
                
                if (isCurrency && !isNaN(val) && val !== '') return `LKR ${Number(val).toLocaleString()}`;
                
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                  return val.number || val.name || JSON.stringify(val);
                }

                return formatDate(val);
              })()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const hireFields = [
    { title: 'Basic Information', fields: [
      { label: 'Date', key: 'date' },
      { label: 'Bill Number', key: 'billNumber' },
      { label: 'Time Sheet No', key: 'timeSheetNumber' },
      { label: 'Client / Company', key: 'client' },
      { label: 'Tool ID / Serial', key: 'tool' },
      { label: 'Service Address', key: 'address' },
      { label: 'City', key: 'city' }
    ]},
    { title: 'Time Tracking', fields: [
      { label: 'Start Time', key: 'startTime' },
      { label: 'End Time', key: 'endTime' },
      { label: 'Working Hours', key: 'workingHours' }
    ]},
    { title: 'Financial Breakdown', fields: [
      { label: 'One Hour Fee', key: 'oneHourFee' },
      { label: 'Transport Fee', key: 'transportFee' },
      { label: 'Total Amount', key: 'totalAmount_disp' }
    ]},
    { title: 'Additional Details', fields: [
        { label: 'Notes', key: 'details' },
        { label: 'Status', key: 'status_text' }
    ]}
  ];

  const paymentFields = [
    { title: 'Job Information', fields: [
      { label: 'Date',          key: 'date' },
      { label: 'Customer',       key: 'client' },
      { label: 'Tool ID',    key: 'tool' },
      { label: 'City',          key: 'city' },
      { label: 'Address',       key: 'address' },
    ]},
    { title: 'Rental Details', fields: [
      { label: 'Rental Duration (Days)', key: 'days' },
    ]},
    { title: 'Financial Breakdown', fields: [
      { label: 'Hire Amount',    key: 'hireAmount' },
      { label: 'Payment Received',    key: 'dayPayment' },
      { label: 'Taken Amount',   key: 'takenAmount' },
      { label: 'Balance',        key: 'balance' },
      { label: 'Status',         key: 'status_text' },
    ]},
  ];

  const invoiceFields = [
    { title: 'Billing Details', fields: [
      { label: 'Invoice Number', key: 'invoiceNo' },
      { label: 'Date', key: 'date' },
      { label: 'Client', key: 'clientName' },
      { label: 'Tool ID', key: 'toolNo' }
    ]},
    { title: 'Job Information', fields: [
      { label: 'Description', key: 'jobDescription' }
    ]},
    { title: 'Pricing Breakdown', fields: [
      { label: 'Total Units', key: 'totalUnits' },
      { label: 'Rate / Unit', key: 'ratePerUnit' },
      { label: 'Transport Charge', key: 'transportCharge' },
      { label: 'Other Charges', key: 'otherCharges' },
      { label: 'Grand Total', key: 'totalAmount' },
      { label: 'Balance Due', key: 'balanceAmount' },
      { label: 'Status', key: 'status' }
    ]},
    ...(data?.accessories?.length > 0 ? [{
      title: 'Parts & Accessories',
      fields: data.accessories.map((a, i) => ({ 
        label: `${a.name} (x${a.quantity})`, 
        key: `acc_${i}`, 
        value: `LKR ${(a.price * a.quantity).toLocaleString()}` 
      }))
    }] : [])
  ];

  const quotationFields = [
    { title: 'Quotation Basics', fields: [
      { label: 'Quote Number', key: 'quotationNo' },
      { label: 'Date', key: 'date' },
      { label: 'Client Name', key: 'clientName' },
      { label: 'Validity', key: 'validityDays' }
    ]},
    { title: 'Tool Specifications', fields: [
      { label: 'Tool Category', key: 'toolCategory' },
      { label: 'Tool ID', key: 'toolNo' },
      { label: 'Refundable Deposit', key: 'refundableDeposit' }
    ]},
    { title: 'Pricing Offer', fields: [
      { label: 'Min Charge', key: 'mandatoryCharge' },
      { label: 'Transport', key: 'transportCharge' },
      { label: 'Extra Rate', key: 'extraHourRate' },
      { label: 'Estimated Total', key: 'estimatedTotal' },
      { label: 'Status', key: 'status' }
    ]},
    { title: 'Terms & Conditions', fields: [
      { label: 'Terms', key: 'termsAndConditions' }
    ]}
  ];

  
  const salaryFields = [
    { title: 'Employee Information', fields: [
      { label: 'Pay Month', key: 'month' },
      { label: 'Employee Name', key: 'employee' },
      { label: 'Jobs Done', key: 'jobsCount' },
      { label: 'Working Days', key: 'workingDays' },
      { label: 'Total Hours', key: 'totalHours' }
    ]},
    { title: 'Earnings Breakdown', fields: [
      { label: 'Basic Salary', key: 'basic' },
      { label: 'Hourly Earnings', key: 'hourlyEarnings' },
      { label: 'Daily Allowance', key: 'dailyAllowance' },
      { label: 'Attendance Bonus', key: 'attendanceBonus' },
      { label: 'Attendance Penalty', key: 'attendancePenalty' },
      { label: 'Incentives (Manual)', key: 'incentive' },
      { label: 'Advance Deductions', key: 'advance' },
      { label: 'Final Net Payable', key: 'netPay' }
    ]}
  ];

  const employeeFields = [
    { title: 'Personal Information', fields: [
      { label: 'Full Name', key: 'name' },
      { label: 'NIC Number', key: 'nic' },
      { label: 'Contact Number', key: 'contact' },
      { label: 'Role', key: 'role' },
      { label: 'Status', key: 'status' }
    ]},
    { title: 'Employment Details', fields: [
      { label: 'Joined Date', key: 'joinedDate' },
      { label: 'Basic Salary (Monthly)', key: 'basicSalary' },
      { label: 'Hourly Rate', key: 'hourlyRate' }
    ]},
    { title: 'System Access', fields: [
      { label: 'Username', key: 'username' }
    ]}
  ];

  const clientFields = [
    { title: 'Customer Information', fields: [
      { label: 'Customer Name', key: 'name' },
      { label: 'Contact Number', key: 'contact' },
      { label: 'Email', key: 'email' },
      { label: 'Address', key: 'address' }
    ]},
    { title: 'Identity Verification', fields: [
      { label: 'ID Front Side', key: 'customerIdFront', isImage: true },
      { label: 'ID Back Side', key: 'customerIdBack', isImage: true }
    ]},
    { title: 'Financial Summary', fields: [
      { label: 'Total Rentals', key: 'totalHires' },
      { label: 'Outstanding Balance', key: 'outstanding' },
      { label: 'Status', key: 'status' }
    ]}
  ];

  const toolFields = [
    { title: 'Tool Information', fields: [
      { label: 'Tool ID / Serial', key: 'number' },
      { label: 'Category', key: 'category' },
      { label: 'Model / Brand', key: 'model' },
      { label: 'Power Source', key: 'powerSource' },
    ]},
    { title: 'Leasing & Finance', fields: [
      { label: 'Leasing Status', key: 'hasLeasing' },
      { label: 'Leasing Company', key: 'leasingCompany' },
      { label: 'Monthly Premium', key: 'monthlyPremium' },
      { label: 'Payment Due Day', key: 'leaseDueDate' },
      { label: 'Final Payment Date', key: 'leaseFinalDate' }
    ]},
    { title: 'Maintenance & Service', fields: [
      { label: 'Warranty Expiration', key: 'warrantyExpirationDate' },
      { label: 'Next Service Date', key: 'nextServiceDate' },
      { label: 'Last Service Date', key: 'lastServiceDate' }
    ]},
    { title: 'Status', fields: [
      { label: 'Current Status', key: 'status' }
    ]}
  ];

  const extraIncomeFields = [

    { title: 'Income Details', fields: [
      { label: 'Date', key: 'date' },
      { label: 'Description', key: 'description' },
      { label: 'Category', key: 'category' },
      { label: 'Amount', key: 'amount' },
      { label: 'Notes', key: 'note' }
    ]}
  ];

  const expenseFields = [
    { title: 'Expense Details', fields: [
      { label: 'Date', key: 'date' },
      { label: 'Description', key: 'description' },
      { label: 'Category', key: 'category' },
      { label: 'Amount', key: 'amount' },
      { label: 'Notes', key: 'note' }
    ]}
  ];

  const bookingFields = [
    { title: 'Customer Information', fields: [
      { label: 'Customer Name', key: 'clientName' },
      { label: 'Phone', key: 'clientPhone' },
      { label: 'NIC / Passport', key: 'clientNic' },
      { label: 'ID Front Side', key: 'customerIdFront', isImage: true },
      { label: 'ID Back Side', key: 'customerIdBack', isImage: true }
    ]},
    { title: 'Tools in this Booking', fields: [
      ...(data?.items?.length > 0 ? data.items.map((it, idx) => ({
        label: `Tool ${idx + 1}`,
        key: `tool_${idx}`,
        value: `${it.toolNumber} - ${it.model} (LKR ${Number(it.dailyRate).toLocaleString()}/day)`
      })) : [
        { label: 'Tool ID / Serial', key: 'tool' }
      ])
    ]},
    { title: 'Schedule Information', fields: [
      { label: 'Pickup Date', key: 'pickupDate' },
      { label: 'Return Date', key: 'returnDate' },
      { label: 'Total Days', key: 'totalDays' }
    ]},
    { title: 'Financial Summary', fields: [
      { label: 'Daily Rate', key: 'dailyRate' },
      { label: 'Base Amount', key: 'baseAmount' },
      { label: 'Discount', key: 'discount' },
      { label: 'Total Amount', key: 'totalAmount' },
      { label: 'Actual Return Date', key: 'actualReturnDate' },
      { label: 'Extra Late Charges', key: 'extraCharges' },
      { label: 'Net Total', key: 'totalAfterExtra' },
      { label: 'Advance Payment', key: 'advancePayment' },
      { label: 'Balance Due', key: 'balanceAmount' }
    ]},
    { title: 'Additional Info', fields: [
        { label: 'Rental Type', key: 'bookingType' },
        { label: 'Notes', key: 'notes' },
        { label: 'Status', key: 'status' }
    ]},
    ...(data?.accessories?.length > 0 ? [{
      title: 'Parts & Accessories',
      fields: data.accessories.map((a, i) => ({ 
        label: `${a.name} (x${a.quantity})`, 
        key: `acc_${i}`, 
        value: `LKR ${(a.price * a.quantity).toLocaleString()}` 
      }))
    }] : [])
  ];

  const sectionsMap = {
    'hire': hireFields,
    'booking': bookingFields,
    'payment': paymentFields,
    'invoice': invoiceFields,
    'quotation': quotationFields,
    'salary': salaryFields,
    'employee': employeeFields,
    'client': clientFields,
    'tool': toolFields,
    'extraIncome': extraIncomeFields,
    'expense': expenseFields
  };

  const sections = sectionsMap[type] || [];

  return (
    <div className="details-overlay">
      {(type === 'invoice' || type === 'quotation') && (
        <div className="detail-actions-header">
          <button 
            className="download-pdf-btn" 
            onClick={() => type === 'invoice' ? generateInvoicePDF(data) : generateQuotationPDF(data)}
          >
            <Download size={18} /> <span>Download Professional PDF</span>
          </button>
        </div>
      )}
      {sections.map((s, i) => <DetailSection key={i} title={s.title} fields={s.fields} />)}
      
      {/* Client Rental History */}
      {type === 'client' && (
        <div className="detail-section" style={{ marginTop: '20px' }}>
          <h4 className="detail-section-title">Rental History</h4>
          {loadingHistory ? (
            <p>Loading history...</p>
          ) : history.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Tool</th>
                    <th style={{ padding: '8px' }}>Total</th>
                    <th style={{ padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}>{new Date(h.pickupDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }}>{h.tool?.number || 'Tool'}</td>
                      <td style={{ padding: '8px' }}>LKR {(h.totalAmount || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>
                        <span className={`status-badge status-${h.status?.toLowerCase() || 'confirmed'}`} style={{ fontSize: '0.7rem' }}>
                          {h.status || 'Confirmed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No rental history found for this client.</p>
          )}
        </div>
      )}

      {/* Helper Shift Breakdown */}
      {type === 'salary' && (data.role === 'Helper' || data.rawData?.role === 'Helper') && (data.shifts || data.rawData?.shifts) && (
        <div className="detail-section" style={{ marginTop: '20px' }}>
          <h4 className="detail-section-title">Staff Shift Breakdown</h4>
          <div style={{ overflowX: 'auto', marginTop: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Shift</th>
                  <th style={{ padding: '8px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(data.shifts || data.rawData?.shifts).map((s, idx) => {
                  if (!s) return null;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px' }}>{s.date ? new Date(s.date).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem',
                          backgroundColor: s.shift === 'Morning' ? '#DBEAFE' : '#FEF3C7',
                          color: s.shift === 'Morning' ? '#1E40AF' : '#92400E'
                        }}>
                          {s.shift || 'Shift'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', fontWeight: '600' }}>LKR {(s.amount || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 'bold' }}>
                  <td colSpan="2" style={{ padding: '8px', textAlign: 'right' }}>Total Shift Earnings:</td>
                  <td style={{ padding: '8px' }}>LKR {(data.shifts || data.rawData?.shifts).reduce((sum, s) => sum + s.amount, 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordDetails;
