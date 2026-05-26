/** Shared booking price calculations (tools × qty × days + accessories + transport − discount) */

export function calculateBookingCosts(formData, totalDays = 1) {
  const days = Math.max(1, Number(totalDays) || 1);

  const items = formData.items || [];
  const accessories = formData.bookingAccessories || formData.accessories || [];

  const toolsTotal = items.reduce(
    (sum, item) =>
      sum + (Number(item.dailyRate) || 0) * (Number(item.quantity) || 1) * days,
    0
  );

  const accessoriesTotal = accessories.reduce(
    (sum, acc) => sum + (Number(acc.price) || 0) * (Number(acc.quantity) || 1),
    0
  );

  const transport = Number(formData.transportCharge) || 0;
  const discount = Number(formData.discount) || 0;
  const advance = Number(formData.advancePayment) || 0;

  const subtotal = toolsTotal + accessoriesTotal + transport;
  const totalAmount = Math.max(0, subtotal - discount);
  const balanceAmount = Math.max(0, totalAmount - advance);

  return {
    toolsTotal,
    accessoriesTotal,
    subtotal,
    baseAmount: subtotal,
    totalAmount,
    balanceAmount,
    totalDays: days
  };
}

export function buildSmsBuilderFromRecord(record) {
  if (!record) {
    return {
      transport: '',
      otherCharges: '',
      discount: '',
      deposit: '',
      advancePaid: '',
      totalPrice: '',
      balanceDue: ''
    };
  }
  return {
    transport: record.transportCharge ?? '',
    otherCharges: record.extraCharges ?? '',
    discount: record.discount ?? '',
    deposit: record.securityDeposit ?? record.deposit ?? '',
    advancePaid: record.advancePayment ?? '',
    totalPrice: record.totalAmount ?? '',
    balanceDue: record.balanceAmount ?? ''
  };
}

export function formatSmsFromBuilder(builder, record) {
  if (!record) return '';

  const itemsList = Array.isArray(record.items) ? record.items : [];
  const accList = Array.isArray(record.accessories) ? record.accessories : [];
  const toolNo =
    itemsList.map((it) => it.toolNumber).filter(Boolean).join(' / ') ||
    accList.map((a) => a.name).filter(Boolean).join(' / ') ||
    'Rental';
  const accStr = accList.map((a) => `${a.name} (x${a.quantity})`).join(', ');

  const f = (val) => (val !== '' && val != null ? `LKR ${Number(val).toLocaleString()}` : '-');

  return `--- MAGGI TOOLS BOOKING BILL ---
Customer: ${record.clientName || 'Customer'}
Phone: ${record.clientPhone || 'N/A'}
NIC: ${record.clientNic || 'N/A'}
Pickup: ${record.pickupLocation || 'N/A'}
Return: ${record.returnLocation || 'N/A'}
Date: ${new Date(record.pickupDate || new Date()).toLocaleDateString()} to ${new Date(record.returnDate || new Date()).toLocaleDateString()}
${record.notes ? `Notes: ${record.notes}` : ''}

Items Booked:
${toolNo}
${accStr ? `Accessories: ${accStr}` : ''}

Transport: ${f(builder.transport)}
Other Charges: ${f(builder.otherCharges)}
Deposit: ${f(builder.deposit)}
Discount: ${f(builder.discount)}
--------------------
Total Price: ${f(builder.totalPrice)}
Paid: ${f(builder.advancePaid)}
Balance Due: ${f(builder.balanceDue)}

${builder.policies || 'Thank you for choosing MAGGI TOOLS RENTALS!'}`.trim();
}
