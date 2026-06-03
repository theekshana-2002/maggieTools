/** Shared booking price calculations (tools × qty × days + accessories + transport − discount) */

export function calculateBookingCosts(formData, totalDays = 1) {
  const days = Math.max(1, Number(totalDays) || 1);
  const items = formData.items || [];
  const accessories = formData.bookingAccessories || formData.accessories || [];
  const pickup = formData.pickupDate ? new Date(formData.pickupDate) : new Date();

  const getCost = (item, rate) => {
    let cost = 0;
    const totalQty = Number(item.quantity) || 1;
    let returnedQty = 0;
    
    if (item.returnDates && Array.isArray(item.returnDates)) {
      item.returnDates.forEach(rd => {
        const qty = Number(rd.quantity) || 0;
        returnedQty += qty;
        const rdDate = new Date(rd.date);
        let diffDays = Math.floor((rdDate - pickup) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) diffDays = 0;
        else diffDays += 1;
        cost += rate * qty * diffDays;
      });
    }
    
    const unreturned = Math.max(0, totalQty - returnedQty);
    if (unreturned > 0) {
      let daysForUnreturned = days;
      if (formData.actualReturnDate) {
         const actDate = new Date(formData.actualReturnDate);
         daysForUnreturned = Math.floor((actDate - pickup) / (1000 * 60 * 60 * 24)) + 1;
         if (daysForUnreturned < 1) daysForUnreturned = 1;
      }
      cost += rate * unreturned * daysForUnreturned;
    }
    return cost;
  };

  const toolsTotal = items.reduce(
    (sum, item) => sum + getCost(item, Number(item.dailyRate) || 0),
    0
  );

  const accessoriesTotal = accessories.reduce(
    (sum, acc) => sum + getCost(acc, Number(acc.price) || 0),
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
  const days = record.totalDays || 1;
  const toolNo =
    itemsList.map((it) => `${it.toolNumber} (x${it.quantity || 1}) for ${days} days`).join('\n') ||
    accList.map((a) => `${a.name} (x${a.quantity || 1}) for ${days} days`).join('\n') ||
    'Rental';
  const accStr = accList.map((a) => `${a.name} (x${a.quantity || 1}) for ${days} days`).join(', ');

  const f = (val) => (val !== '' && val != null ? `LKR ${Number(val).toLocaleString()}` : '-');

  return `--- MAGGI TOOL RENTALS BOOKING BILL ---
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

${builder.policies || 'Thank you for choosing MAGGI TOOL RENTALS!'}`.trim();
}
