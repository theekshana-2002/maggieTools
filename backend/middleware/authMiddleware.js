const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

// Role-based protection helper
const authorizeRoles = (...roles) => {
  return function roleGuard(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
    return next();
  };
};

module.exports = { authMiddleware, authorizeRoles };
