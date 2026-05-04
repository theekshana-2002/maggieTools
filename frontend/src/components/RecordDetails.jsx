import React from 'react';
import { Download } from 'lucide-react';
import { generateInvoicePDF, generateQuotationPDF } from '../utils/billingGenerator';
import './RecordDetails.css';

const RecordDetails = ({ data, type }) => {
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
                const val = data[f.key] !== undefined && data[f.key] !== null ? data[f.key] : data[f.key === 'vehicle' ? 'vehicleNo' : f.key === 'vehicleNo' ? 'vehicle' : ''];
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

                const isCurrency = (f.key.toLowerCase().includes('salary') || f.key.toLowerCase().includes('premium') || f.key.toLowerCase().includes('rate') || f.key.toLowerCase().includes('amount') || f.key.toLowerCase().includes('fee') || f.key.toLowerCase().includes('earnings') || f.key.toLowerCase().includes('allowance') || f.key.toLowerCase().includes('pay') || f.key.toLowerCase().includes('incentive') || f.key.toLowerCase().includes('advance') || f.key.toLowerCase().includes('total') || f.key.toLowerCase().includes('cost')) && 
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
      { label: 'Company Name', key: 'client' },
      { label: 'Vehicle Number', key: 'vehicle' },
      { label: 'Service Address', key: 'address' },
      { label: 'City', key: 'city' }
    ]},
    { title: 'Personnel', fields: [
      { label: 'Driver Name', key: 'driverName' },
      { label: 'Helper Name', key: 'helperName' }
    ]},
    { title: 'Time Tracking', fields: [
      { label: 'Start Time', key: 'startTime' },
      { label: 'End Time', key: 'endTime' },
      { label: 'Rest (min)', key: 'restTime' },
      { label: 'Working Hours', key: 'workingHours' }
    ]},
    { title: 'Financial Breakdown', fields: [
      { label: 'Min Hours', key: 'minimumHours' },
      { label: 'One Hour Fee', key: 'oneHourFee' },
      { label: 'Extra Hours', key: 'extraHours' },
      { label: 'Extra Hour Fee', key: 'extraHourFee' },
      { label: 'Transport Fee', key: 'transportFee' },
      { label: 'Fuel Cost', key: 'dieselCost' },
      { label: 'Commission', key: 'commission' },
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
      { label: 'Company',       key: 'client' },
      { label: 'Vehicle No',    key: 'vehicle' },
      { label: 'City',          key: 'city' },
      { label: 'Address',       key: 'address' },
    ]},
    { title: 'Rental Details', fields: [
      { label: 'Rental Duration (Days)', key: 'days' },
      { label: 'Start KM',         key: 'startKm' },
      { label: 'End KM',           key: 'endKm' },
      { label: 'Extra KM Charges', key: 'extraKmCharges' },
    ]},
    { title: 'Financial Breakdown', fields: [
      { label: 'Hire Amount',    key: 'hireAmount' },
      { label: 'Commission',     key: 'commission' },
      { label: 'Day Payment',    key: 'dayPayment' },
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
      { label: 'Vehicle', key: 'vehicleNo' }
    ]},
    { title: 'Job Information', fields: [
      { label: 'Description', key: 'jobDescription' }
    ]},
    { title: 'Pricing Breakdown', fields: [
      { label: 'Total Units (Hours)', key: 'totalUnits' },
      { label: 'Rate / Unit', key: 'ratePerUnit' },
      { label: 'Transport Charge', key: 'transportCharge' },
      { label: 'Other Charges', key: 'otherCharges' },
      { label: 'Grand Total', key: 'totalAmount' },
      { label: 'Status', key: 'status' }
    ]}
  ];

  const quotationFields = [
    { title: 'Quotation Basics', fields: [
      { label: 'Quote Number', key: 'quotationNo' },
      { label: 'Date', key: 'date' },
      { label: 'Client Name', key: 'clientName' },
      { label: 'Validity', key: 'validityDays' }
    ]},
    { title: 'Vehicle Specifications', fields: [
      { label: 'Vehicle Type', key: 'vehicleType' },
      { label: 'Vehicle No', key: 'vehicleNo' },
      { label: 'Refundable Deposit', key: 'refundableDeposit' }
    ]},
    { title: 'Pricing Offer', fields: [
      { label: 'Min Charge', key: 'mandatoryCharge' },
      { label: 'Transport', key: 'transportCharge' },
      { label: 'Extra Hr Rate', key: 'extraHourRate' },
      { label: 'Estimated Total', key: 'estimatedTotal' },
      { label: 'Status', key: 'status' }
    ]},
    { title: 'Terms & Conditions', fields: [
      { label: 'Terms', key: 'termsAndConditions' }
    ]}
  ];

  const dieselFields = [
    { title: 'Fueling Details', fields: [
      { label: 'Date', key: 'date' },
      { label: 'Vehicle', key: 'vehicle' },
      { label: 'Driver / Staff', key: 'employee' }
    ]},
    { title: 'Consumption', fields: [
      { label: 'Liters', key: 'liters' },
      { label: 'Price / L', key: 'pricePerLiter' },
      { label: 'Total Cost', key: 'total' },
      { label: 'Odometer', key: 'odometer' }
    ]},
    { title: 'Management', fields: [
      { label: 'Notes', key: 'note' },
      { label: 'Status', key: 'status' }
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
      { label: 'Hourly Rate (Hires)', key: 'hourlyRate' }
    ]},
    { title: 'System Access', fields: [
      { label: 'Username', key: 'username' }
    ]}
  ];

  const clientFields = [
    { title: 'Client Information', fields: [
      { label: 'Client Name', key: 'name' },
      { label: 'Contact Number', key: 'contact' },
      { label: 'Email', key: 'email' },
      { label: 'Address', key: 'address' }
    ]},
    { title: 'Financial Summary', fields: [
      { label: 'Total Hires', key: 'totalHires' },
      { label: 'Outstanding Balance', key: 'outstanding' },
      { label: 'Status', key: 'status' }
    ]}
  ];

  const vehicleFields = [
    { title: 'Vehicle Information', fields: [
      { label: 'Vehicle Number', key: 'number' },
      { label: 'Category', key: 'category' },
      { label: 'Model', key: 'model' },
      { label: 'Fuel Type', key: 'fuelType' },
    ]},
    { title: 'Leasing & Finance', fields: [
      { label: 'Leasing Status', key: 'hasLeasing' },
      { label: 'Leasing Company', key: 'leasingCompany' },
      { label: 'Monthly Premium', key: 'monthlyPremium' },
      { label: 'Payment Due Day', key: 'leaseDueDate' },
      { label: 'Final Payment Date', key: 'leaseFinalDate' }
    ]},
    { title: 'Compliance & Renewals', fields: [
      { label: 'Insurance Expiration', key: 'insuranceExpirationDate' },
      { label: 'License Expiration', key: 'licenseExpirationDate' },
      { label: 'Safety Certificate Expiry', key: 'safetyExpirationDate' }
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
    { title: 'Vehicle & Schedule', fields: [
      { label: 'Vehicle Number', key: 'vehicle' },
      { label: 'Pickup Date', key: 'pickupDate' },
      { label: 'Return Date', key: 'returnDate' },
      { label: 'Total Days', key: 'totalDays' },
      { label: 'Driver Assigned', key: 'driverName' },
      { label: 'Helper Assigned', key: 'helperName' }
    ]},
    { title: 'Financial Summary', fields: [
      { label: 'Daily Rate', key: 'dailyRate' },
      { label: 'Base Amount', key: 'baseAmount' },
      { label: 'Driver Included', key: 'hasDriver' },
      { label: 'Driver Fee (Total)', key: 'driverFee' },
      { label: 'Extra KM Charges', key: 'extraKmCharges' },
      { label: 'Discount', key: 'discount' },
      { label: 'Total Amount', key: 'totalAmount' },
      { label: 'Advance Payment', key: 'advancePayment' },
      { label: 'Balance Due', key: 'balanceAmount' }
    ]},
    { title: 'Additional Info', fields: [
        { label: 'Booking Type', key: 'bookingType' },
        { label: 'Wedding Details', key: 'weddingDetails' },
        { label: 'Notes', key: 'notes' },
        { label: 'Status', key: 'status' }
    ]}
  ];

  const sectionsMap = {
    'hire': hireFields,
    'booking': bookingFields,
    'payment': paymentFields,
    'diesel': dieselFields,
    'invoice': invoiceFields,
    'quotation': quotationFields,
    'salary': salaryFields,
    'employee': employeeFields,
    'client': clientFields,
    'vehicle': vehicleFields,
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
      
      {/* Helper Shift Breakdown */}
      {type === 'salary' && (data.role === 'Helper' || data.rawData?.role === 'Helper') && (data.shifts || data.rawData?.shifts) && (
        <div className="detail-section" style={{ marginTop: '20px' }}>
          <h4 className="detail-section-title">Helper Shift Breakdown (One by One)</h4>
          <div style={{ overflowX: 'auto', marginTop: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #E2E8F0', color: '#64748B' }}>
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
