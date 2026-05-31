const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

function generateBillViewToken(bookingId) {
  if (!bookingId) return null;
  return jwt.sign(
    { bookingId: String(bookingId), type: 'bill' },
    JWT_SECRET,
    { expiresIn: '90d' }
  );
}

function getPublicFrontendBase() {
  return (
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    'https://maggitools.netlify.app'
  ).replace(/\/$/, '');
}

function generateBillViewUrl(bookingId) {
  const token = generateBillViewToken(bookingId);
  if (!token) return '';
  return `${getPublicFrontendBase()}/bill/${encodeURIComponent(token)}`;
}

function verifyBillViewToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== 'bill' || !decoded.bookingId) {
    throw new Error('Invalid bill token');
  }
  return decoded;
}

module.exports = {
  generateBillViewUrl,
  verifyBillViewToken,
  getPublicFrontendBase
};
