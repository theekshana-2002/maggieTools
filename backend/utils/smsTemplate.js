const DEFAULT_SMS_BOOKING_TEMPLATE = `--- {companyName} BOOKING BILL ---
Customer: {clientName}
Phone: {clientPhone}
NIC: {clientNic}
Pickup: {pickupLocation}
Return: {returnLocation}
Date: {pickupDate} to {returnDate}
{notesLine}
Items Booked:
{toolNo}
{accessoriesLine}
Transport: {transport}
Other Charges: {otherCharges}
Deposit: {deposit}
Discount: {discount}
--------------------
Total Price: {totalAmount}
Paid: {advancePayment}
Balance Due: {balanceAmount}

Thank you for choosing {companyName}!`;

const SMS_PLACEHOLDERS = [
  '{clientName}', '{clientPhone}', '{clientNic}',
  '{pickupLocation}', '{returnLocation}', '{pickupDate}', '{returnDate}',
  '{toolNo}', '{accessoriesLine}', '{notesLine}',
  '{transport}', '{otherCharges}', '{deposit}', '{discount}',
  '{totalAmount}', '{advancePayment}', '{balanceAmount}', '{companyName}',
  '{detailedBill}'
];

function fmtMoney(v) {
  return v != null && v !== '' ? `LKR ${Number(v).toLocaleString()}` : '-';
}

function isLegacyShortTemplate(template) {
  if (!template || typeof template !== 'string') return true;
  const t = template.trim();
  if (!t) return true;
  if (t.includes('BOOKING BILL') || t.includes('{transport}')) return false;
  return t.length < 120 && t.includes('Dear {clientName}');
}

function buildDetailedBillMessage(bookingData, settings) {
  const itemsList = Array.isArray(bookingData.items) ? bookingData.items : [];
  const accList = Array.isArray(bookingData.accessories) ? bookingData.accessories : [];
  const toolNo =
    itemsList.map((it) => it.toolNumber).filter(Boolean).join(' / ') ||
    accList.map((a) => a.name).filter(Boolean).join(' / ') ||
    'Rental';
  const accStr = accList.map((a) => `${a.name} (x${a.quantity})`).join(', ');

  return applySmsTemplate(
    DEFAULT_SMS_BOOKING_TEMPLATE,
    bookingData,
    settings,
    { toolNo, accStr }
  );
}

function applySmsTemplate(template, bookingData, settings, precomputed = {}) {
  const itemsList = Array.isArray(bookingData.items) ? bookingData.items : [];
  const accList = Array.isArray(bookingData.accessories) ? bookingData.accessories : [];
  const toolNo =
    precomputed.toolNo ??
    (itemsList.map((it) => it.toolNumber).filter(Boolean).join(' / ') ||
      accList.map((a) => a.name).filter(Boolean).join(' / ') ||
      'Rental');
  const accStr =
    precomputed.accStr ??
    accList.map((a) => `${a.name} (x${a.quantity})`).join(', ');

  const companyName = settings?.companyName || 'MAGGI TOOLS RENTALS';
  const pickupDate = bookingData.pickupDate
    ? new Date(bookingData.pickupDate).toLocaleDateString()
    : '-';
  const returnDate = bookingData.returnDate
    ? new Date(bookingData.returnDate).toLocaleDateString()
    : '-';

  const replacements = {
    '{clientName}': bookingData.clientName || 'Customer',
    '{clientPhone}': bookingData.clientPhone || 'N/A',
    '{clientNic}': bookingData.clientNic || 'N/A',
    '{pickupLocation}': bookingData.pickupLocation || 'N/A',
    '{returnLocation}': bookingData.returnLocation || 'N/A',
    '{pickupDate}': pickupDate,
    '{returnDate}': returnDate,
    '{toolNo}': toolNo,
    '{accessoriesLine}': accStr ? `Accessories: ${accStr}` : '',
    '{notesLine}': bookingData.notes ? `Notes: ${bookingData.notes}` : '',
    '{transport}': fmtMoney(bookingData.transportCharge),
    '{otherCharges}': fmtMoney(bookingData.extraCharges),
    '{deposit}': fmtMoney(bookingData.securityDeposit ?? bookingData.deposit),
    '{discount}': fmtMoney(bookingData.discount),
    '{totalAmount}': fmtMoney(bookingData.totalAmount),
    '{advancePayment}': fmtMoney(bookingData.advancePayment),
    '{balanceAmount}': fmtMoney(bookingData.balanceAmount),
    '{companyName}': companyName
  };

  let result = template;
  if (!result.includes('{detailedBill}') && !result.includes('{balanceAmount}') && !result.includes('BOOKING BILL')) {
    result = result + '\n\n{detailedBill}';
  }

  Object.entries(replacements).forEach(([key, val]) => {
    result = result.split(key).join(val);
  });

  if (result.includes('{detailedBill}')) {
    const bill = buildDetailedBillMessage(bookingData, settings);
    result = result.replace(/\{detailedBill\}/g, bill);
  }

  return result.replace(/LKR\s+LKR/gi, 'LKR').replace(/\n{3,}/g, '\n\n').trim();
}

function resolveBookingTemplate(settings) {
  const raw = settings?.smsBookingTemplate;
  if (isLegacyShortTemplate(raw)) {
    return DEFAULT_SMS_BOOKING_TEMPLATE;
  }
  return raw.trim();
}

module.exports = {
  DEFAULT_SMS_BOOKING_TEMPLATE,
  SMS_PLACEHOLDERS,
  isLegacyShortTemplate,
  buildDetailedBillMessage,
  applySmsTemplate,
  resolveBookingTemplate,
  fmtMoney
};
