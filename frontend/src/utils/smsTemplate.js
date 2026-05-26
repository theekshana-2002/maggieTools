export const DEFAULT_SMS_BOOKING_TEMPLATE = `--- {companyName} BOOKING BILL ---
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

export const SMS_PLACEHOLDER_GROUPS = [
  {
    title: 'Customer',
    keys: ['{clientName}', '{clientPhone}', '{clientNic}']
  },
  {
    title: 'Rental',
    keys: ['{pickupLocation}', '{returnLocation}', '{pickupDate}', '{returnDate}', '{notesLine}']
  },
  {
    title: 'Items',
    keys: ['{toolNo}', '{accessoriesLine}']
  },
  {
    title: 'Amounts',
    keys: ['{transport}', '{otherCharges}', '{deposit}', '{discount}', '{totalAmount}', '{advancePayment}', '{balanceAmount}']
  },
  {
    title: 'Other',
    keys: ['{companyName}']
  }
];

const SAMPLE_BOOKING = {
  clientName: 'Sample Customer',
  clientPhone: '0771234567',
  clientNic: '200012345678',
  pickupLocation: 'Colombo',
  returnLocation: 'Colombo',
  pickupDate: new Date().toISOString(),
  returnDate: new Date(Date.now() + 2 * 86400000).toISOString(),
  notes: 'Sample booking',
  transportCharge: 1500,
  extraCharges: 0,
  securityDeposit: 5000,
  discount: 500,
  totalAmount: 12500,
  advancePayment: 5000,
  balanceAmount: 7500,
  items: [{ toolNumber: 'CP-003', quantity: 1 }],
  accessories: [{ name: 'Drill Bit', quantity: 2 }]
};

function fmtMoney(v) {
  return v != null && v !== '' ? `LKR ${Number(v).toLocaleString()}` : '-';
}

export function isLegacyShortTemplate(template) {
  if (!template || typeof template !== 'string') return true;
  const t = template.trim();
  if (!t) return true;
  if (t.includes('BOOKING BILL') || t.includes('{transport}')) return false;
  return t.length < 120 && t.includes('Dear {clientName}');
}

export function resolveBookingTemplate(stored, companyName = 'MAGGI TOOLS RENTALS') {
  if (isLegacyShortTemplate(stored)) {
    return DEFAULT_SMS_BOOKING_TEMPLATE.replace(/\{companyName\}/g, companyName);
  }
  return stored.trim();
}

export function previewSmsTemplate(template, companyName = 'MAGGI TOOLS RENTALS') {
  const booking = { ...SAMPLE_BOOKING };
  const itemsList = booking.items || [];
  const accList = booking.accessories || [];
  const toolNo = itemsList.map((it) => it.toolNumber).join(' / ');
  const accStr = accList.map((a) => `${a.name} (x${a.quantity})`).join(', ');

  const replacements = {
    '{clientName}': booking.clientName,
    '{clientPhone}': booking.clientPhone,
    '{clientNic}': booking.clientNic,
    '{pickupLocation}': booking.pickupLocation,
    '{returnLocation}': booking.returnLocation,
    '{pickupDate}': new Date(booking.pickupDate).toLocaleDateString(),
    '{returnDate}': new Date(booking.returnDate).toLocaleDateString(),
    '{toolNo}': toolNo,
    '{accessoriesLine}': accStr ? `Accessories: ${accStr}` : '',
    '{notesLine}': booking.notes ? `Notes: ${booking.notes}` : '',
    '{transport}': fmtMoney(booking.transportCharge),
    '{otherCharges}': fmtMoney(booking.extraCharges),
    '{deposit}': fmtMoney(booking.securityDeposit),
    '{discount}': fmtMoney(booking.discount),
    '{totalAmount}': fmtMoney(booking.totalAmount),
    '{advancePayment}': fmtMoney(booking.advancePayment),
    '{balanceAmount}': fmtMoney(booking.balanceAmount),
    '{companyName}': companyName
  };

  let result = template || '';
  Object.entries(replacements).forEach(([key, val]) => {
    result = result.split(key).join(val);
  });
  return result.replace(/\n{3,}/g, '\n\n').trim();
}
