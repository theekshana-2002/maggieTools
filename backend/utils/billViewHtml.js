const { buildItemsBreakdown, fmtMoney, getCompanyName } = require('./smsTemplate');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBillViewHtml(booking, invoice, settings) {
  const companyName = getCompanyName(settings);
  const itemsBreakdown = buildItemsBreakdown(booking);
  const itemLines = itemsBreakdown
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const clean = line.replace(/^•\s*/, '');
      const [name, price] = clean.split(':').map((part) => part.trim());
      return `<tr><td>${escapeHtml(name)}</td><td style="text-align:right;font-weight:700;">${escapeHtml(price)}</td></tr>`;
    })
    .join('');

  const optionalRows = [];
  const transport = Number(booking.transportCharge) || 0;
  const extra = Number(booking.extraCharges) || 0;
  const deposit = Number(booking.securityDeposit ?? booking.deposit) || 0;
  const discount = Number(booking.discount) || 0;

  if (transport > 0) optionalRows.push(['Transport', fmtMoney(transport)]);
  if (extra > 0) optionalRows.push(['Other Charges', fmtMoney(extra)]);
  if (deposit > 0) optionalRows.push(['Deposit', fmtMoney(deposit)]);
  if (discount > 0) optionalRows.push(['Discount', fmtMoney(discount)]);

  const optionalHtml = optionalRows
    .map(([label, amount]) => `<tr><td>${escapeHtml(label)}</td><td style="text-align:right;">${escapeHtml(amount)}</td></tr>`)
    .join('');

  const pickupDate = booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString() : '-';
  const returnDate = booking.returnDate ? new Date(booking.returnDate).toLocaleDateString() : '-';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(companyName)} Bill</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 16px; }
    .card { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
    h1 { margin: 0 0 4px; font-size: 1.4rem; }
    .muted { color: #64748b; font-size: 0.92rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.95rem; }
    th { text-align: left; color: #475569; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .totals td { font-weight: 700; }
    .footer { margin-top: 18px; font-size: 0.92rem; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(companyName)}</h1>
    <div class="muted">Booking Bill${invoice?.invoiceNo ? ` · ${escapeHtml(invoice.invoiceNo)}` : ''}</div>
    <p><strong>Customer:</strong> ${escapeHtml(booking.clientName || 'Customer')}<br/>
    <strong>Phone:</strong> ${escapeHtml(booking.clientPhone || '-')}<br/>
    <strong>Date:</strong> ${escapeHtml(pickupDate)} to ${escapeHtml(returnDate)}</p>
    <table>
      <thead><tr><th>Item</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${itemLines}${optionalHtml}</tbody>
      <tfoot class="totals">
        <tr><td>Total</td><td style="text-align:right;color:#4f46e5;">${escapeHtml(fmtMoney(booking.totalAmount))}</td></tr>
        <tr><td>Paid</td><td style="text-align:right;color:#059669;">${escapeHtml(fmtMoney(booking.advancePayment))}</td></tr>
        <tr><td>Balance Due</td><td style="text-align:right;color:#dc2626;">${escapeHtml(fmtMoney(booking.balanceAmount))}</td></tr>
      </tfoot>
    </table>
    <div class="footer">Contact Us: 0777778845</div>
  </div>
</body>
</html>`;
}

module.exports = { renderBillViewHtml };
