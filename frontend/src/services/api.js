import axios from 'axios';

const isLocal = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname === '[::1]' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.');

const localApiUrl = `http://${window.location.hostname}:5001/api`;
const rawApiUrl = import.meta.env.VITE_API_URL || (isLocal ? localApiUrl : ''); 

if (!rawApiUrl && !isLocal) {
  console.error("⚠️ VITE_API_URL is not set in production!");
}

const normalizeApiUrl = (url) => {
  let trimmed = (url || '').trim();
  if (!trimmed) return '';
  
  // Ensure it ends with /api/
  if (trimmed.toLowerCase().endsWith('/api')) {
    trimmed = trimmed + '/';
  } else if (!trimmed.toLowerCase().endsWith('/api/')) {
    // If it doesn't end with /api or /api/, append /api/ (unless it's just a root)
    trimmed = trimmed.replace(/\/+$/, '') + '/api/';
  }
  
  return trimmed;
};

const API_URL = normalizeApiUrl(rawApiUrl);
console.log('🚀 RAXWO API Initialized at:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to add auth token to headers and fix leading slashes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('raxwo_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Strip leading slash from url if baseURL is set
  if (config.url && config.url.startsWith('/') && config.baseURL) {
    config.url = config.url.substring(1);
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Fallback logic for LocalStorage
const getFallback = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setFallback = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// Global notification for data changes
const notifyUpdate = () => {
  window.dispatchEvent(new Event('raxwo_data_updated'));
};

const wrapAPI = (endpoint, storageKey) => {
  // Ensure endpoint doesn't start with slash to work with baseURL/
  const cleanPath = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  return {
    get: async () => {
      try {
        const res = await api.get(`${cleanPath}?t=${Date.now()}`);
        setFallback(storageKey, res.data);
        return res;
      } catch (err) {
        if (!err.response) {
          console.warn(`Backend offline for ${cleanPath}, using localStorage fallback.`);
          return { data: getFallback(storageKey) };
        }
        throw err;
      }
    },
    create: async (data) => {
      try {
        const res = await api.post(cleanPath, data);
        const current = getFallback(storageKey);
        setFallback(storageKey, [...current, res.data]);
        notifyUpdate();
        return res;
      } catch (err) {
        if (!err.response) {
          console.warn(`Backend offline for ${cleanPath}, saving to localStorage only.`);
          const newData = { ...data, _id: Date.now().toString(), createdAt: new Date().toISOString() };
          const current = getFallback(storageKey);
          setFallback(storageKey, [...current, newData]);
          return { data: newData };
        }
        throw err;
      }
    },
    update: async (id, data) => {
      try {
        const res = await api.put(`${cleanPath}/${id}`, data);
        const current = getFallback(storageKey);
        setFallback(storageKey, current.map(item => item._id === id ? res.data : item));
        notifyUpdate();
        return res;
      } catch (err) {
        if (!err.response) {
          console.warn(`Backend offline for update ${cleanPath}, updating localStorage.`);
          const current = getFallback(storageKey);
          const updated = current.map(item => item._id === id ? { ...item, ...data } : item);
          setFallback(storageKey, updated);
          return { data: { ...data, _id: id } };
        }
        throw err;
      }
    },
    delete: async (id) => {
      try {
        const res = await api.delete(`${cleanPath}/${id}`);
        const current = getFallback(storageKey);
        const filtered = current.filter(item => item._id !== id);
        setFallback(storageKey, filtered);
        notifyUpdate();
        return res;
      } catch (err) {
        if (!err.response) {
          console.warn(`Backend offline for delete ${cleanPath}, removing from localStorage.`);
          const current = getFallback(storageKey);
          const filtered = current.filter(item => item._id !== id);
          setFallback(storageKey, filtered);
          return { data: { success: true } };
        }
        throw err;
      }
    }
  };
};

export const accessoryAPI  = wrapAPI('accessories', 'raxwo_accessories');
export const hireAPI       = wrapAPI('hires',      'raxwo_hires');
export const salaryAPI     = wrapAPI('salaries',   'raxwo_salaries');
export const paymentAPI    = wrapAPI('payments',   'raxwo_payments');
export const clientAPI     = wrapAPI('clients',    'raxwo_clients');
export const toolAPI    = wrapAPI('tools',   'raxwo_tools');
export const vehicleAPI = toolAPI; // Alias for backward compatibility
export const markLeasePayment = async (toolId, year, month, paid) => {
  const res = await api.patch(
    `tools/${toolId}/lease-payment`,
    { year, month, paid }
  );
  const cached = JSON.parse(localStorage.getItem('raxwo_tools') || '[]');
  const updated = cached.map(t => t._id === toolId ? res.data : t);
  localStorage.setItem('raxwo_tools', JSON.stringify(updated));
  window.dispatchEvent(new Event('raxwo_lease_updated'));
  return res;
};
export const renewToolDocument = async (toolId, type, newExpirationDate, cost) => {
  const res = await api.patch(`tools/${toolId}/renew`, { type, newExpirationDate, cost });
  const cached = JSON.parse(localStorage.getItem('raxwo_tools') || '[]');
  const updated = cached.map(t => t._id === toolId ? res.data.tool : t);
  localStorage.setItem('raxwo_tools', JSON.stringify(updated));
  return res;
};
export const employeeAPI   = wrapAPI('employees',  'raxwo_employees');
export const invoiceAPI    = wrapAPI('invoices',   'raxwo_invoices');
export const quotationAPI  = wrapAPI('quotations', 'raxwo_quotations');
export const attendanceAPI = wrapAPI('attendance', 'raxwo_attendance');
export const advanceAPI    = wrapAPI('advances',   'raxwo_advances');
export const extraIncomeAPI = wrapAPI('extra-income', 'raxwo_extra_income');
export const expenseAPI     = wrapAPI('expenses', 'raxwo_expenses');
export const settingsAPI    = wrapAPI('settings', 'raxwo_settings');
export const bookingAPI     = {
  ...wrapAPI('bookings', 'raxwo_bookings'),
  checkAvailability: (pickupDate, returnDate, toolId) => 
    api.get(`bookings/check-availability`, { params: { pickupDate, returnDate, toolId } }),
  getAvailableTools: (pickupDate, returnDate) => 
    api.get(`bookings/available-tools`, { params: { pickupDate, returnDate } }),
  getCustomerHistory: (nic) => 
    api.get(`bookings/customer/${nic}`),
  getInsights: () => 
    api.get(`bookings/insights`),
  bulkCreate: (bookings) => 
    api.post(`bookings/bulk`, { bookings }),
  sendReminder: (id) =>
    api.post(`bookings/${id}/remind`)
};

export default api;

