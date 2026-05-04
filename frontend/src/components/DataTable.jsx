import React from 'react';
import './DataTable.css';

const DataTable = ({ columns, data, emptyMessage, loading, onRowClick }) => {
  return (
    <div className="table-wrapper">
      <div className="data-table-root">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th key={index}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="loading-cell">
                  <div className="shimmer-loader"></div>
                </td>
              </tr>
            ) : (data && data.length > 0) ? (
              data.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex} 
                    onClick={() => onRowClick && onRowClick(row)}
                    className={onRowClick ? 'clickable-row' : ''}
                  >
                  {columns.map((col, colIndex) => {
                    // Field mapping logic
                    const fieldMap = {
                      'DATE': 'date',
                      'CLIENT': 'clientName',
                      'COMPANY': 'clientName',
                      'CLIENT NAME': 'name',
                      'VEHICLE': 'vehicle',
                      'VEHICLE NUMBER': 'number',
                      'VEHICLE TYPE': 'vehicleType',
                      'LOCATION': 'location',
                      'CITY': 'city',
                      'ADDRESS': 'address',
                      'SITE': 'site',
                      'AMOUNT': 'amount',
                      'TOTAL': 'totalAmount_disp',
                      'TOTAL COST': 'totalCost',
                      'EST. TOTAL': 'total_disp',
                      'NET PAY': 'netPay',
                      'PAID': 'takenAmount',
                      'ACTION': 'action',
                      'STATUS': 'status_disp',
                      'BILL#': 'billNumber',
                      'INVOICE#': 'invoiceNo',
                      'INV#': 'invoiceNo',
                      'QUOTE#': 'quotationNo',
                      'QUOTATION#': 'quotationNo',
                      'VALIDITY': 'validity_disp',
                      'EMPLOYEE': 'name',
                      'DRIVER': 'driverName',
                      'HELPER': 'helperName',
                      'CONTACT': 'contact',
                      'ROLE': 'role',
                      'JOINED': 'joined',
                      'BASIC': 'basic',
                      'INCENTIVE': 'incentive',
                      'ADVANCE': 'advance',
                      'FUEL TYPE': 'fuelType_disp',
                      'LITERS': 'liters',
                      'PRICE/L': 'pricePerLiter_disp',
                      'ODOMETER': 'odometer',
                      'NOTE': 'note',
                      'HIRE AMT':    'hireAmount',
                      'PAID AMT':    'paidAmount',
                      'BALANCE':     'balance',
                      'COMMISSION':  'commission',
                      'DAY PAY':     'dayPayment',
                      'TAKEN':       'takenAmount',
                      'START':       'startTime',
                      'END':         'endTime',
                      'REST':        'restTime',
                      'TOTAL HRS':   'totalHours',
                      'MIN HRS':     'minimumHours',
                      'HRS IN BILL': 'hoursInBill',
                      'TOTAL HOURS': 'totalHours',
                      'HOURS IN BILL':'hoursInBill',
                      'TOTAL HIRES': 'totalHires',
                      'OUTSTANDING': 'outstanding',
                      'NAME':        'name',
                      'NIC':         'nic',
                      'HOURS':       'workingHours',
                      'HOURLY':      'hourlyEarnings',
                      'DAILY':       'dailyAllowance',
                      'BILL AMT':    'billAmount',
                      'RENEWAL DATE': 'renewalDate',
                      'DUE DATE':     'date',
                      'FINAL DATE':   'finalDate',
                      'MONTHLY PREMIUM': 'amount',
                      'DAILY RATE': 'dailyRate_disp',
                      'CATEGORY': 'category',
                      'MODEL': 'model'
                    };
                    
                    // Priority: Exact Column Key -> Explicit Map -> Lowercase Column Key
                    let keyToUse = col;
                    if (row[col] === undefined) {
                      keyToUse = fieldMap[col] || (row[col.toLowerCase()] !== undefined ? col.toLowerCase() : col);
                    }
                    let value = row[keyToUse];

                    // Smart Fallbacks for Client/Company fields
                    if ((col === 'CLIENT' || col === 'COMPANY') && (value === undefined || value === '—' || value === null)) {
                      value = row.clientName || row.client || row.name || '—';
                    }
                    // Smart Fallbacks for Status
                    if (col === 'STATUS' && (value === undefined || value === null)) {
                      value = row.status_disp || row.status || '—';
                    }
                    // Smart Fallbacks for Vehicle
                    if ((col === 'VEHICLE' || col === 'VEHICLE NUMBER') && (value === undefined || value === null || value === '—')) {
                      value = [row.vehicle, row.vehicleNo, row.number, row.vehicle_disp].find(v => v && v !== '—') || '—';
                      if (value && typeof value === 'object' && value.number) {
                        value = value.number;
                      }
                    }
                    if (col === 'LOCATION' && (value === undefined || value === '—' || value === null)) {
                      value = row.location || row.site || '—';
                    }
                    // Smart Fallbacks for Date
                    if (col === 'DATE') {
                      let rawDate = value;
                      if (rawDate === undefined || rawDate === null) {
                        rawDate = row.date_disp || row.date;
                      }
                      
                      if (typeof rawDate === 'string' && rawDate.match(/^\d{4}-\d{2}-\d{2}T/)) {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                          value = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        } else {
                          value = rawDate;
                        }
                      } else {
                        value = rawDate || '—';
                      }
                    }
                    if ((col === 'DRIVER' || col === 'EMPLOYEE') && (value === undefined || value === '—' || value === null)) {
                      value = row.driverName || row.employee || row.name || '—';
                    }
                    if (col === 'DAILY RATE' && (value === undefined || value === null || value === '—')) {
                      const dr = row.dailyRate || row.rawData?.dailyRate;
                      value = dr ? `LKR ${Number(dr).toLocaleString()}` : '—';
                    }
                    
                    return (
                      <td key={colIndex}>
                        {value !== undefined && value !== null ? value : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty-row">
                  <div className="empty-content">
                    <div className="empty-icon">📂</div>
                    <p>{emptyMessage || 'No records found.'}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
