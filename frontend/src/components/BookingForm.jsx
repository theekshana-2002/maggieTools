import React, { useState, useEffect } from 'react';
import { vehicleAPI, bookingAPI, employeeAPI, clientAPI } from '../services/api';
import { Calendar, Car, MapPin, Hash, Info, User, Phone, Wallet, ShieldCheck, RefreshCw, TrendingUp } from 'lucide-react';
import '../styles/forms.css';

const BookingForm = ({ onSubmit, onCancel, initialData }) => {
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  
  const [customerHistory, setCustomerHistory] = useState(null);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const defaults = {
    clientName: '',
    clientPhone: '',
    clientNic: '',
    driverName: '',
    vehicle: '',
    pickupDate: new Date().toISOString().split('T')[0],
    returnDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    pickupLocation: 'Office',
    returnLocation: 'Office',
    startKm: 0,
    endKm: 0,
    dailyRate: 0,
    kmLimit: 0,
    extraKmRate: 0,
    hasDriver: false,
    driverFee: 1500,
    advancePayment: 0,
    discount: 0,
    notes: '',
    status: 'Confirmed',
    bookingType: 'General',
    drivingLicenseNo: '',
    securityDeposit: 0,
    fuelLevel: 'Full',
    totalAmount: 0,
    balanceAmount: 0,
    customerIdFront: '',
    customerIdBack: ''
  };

  const [formData, setFormData] = useState({ ...defaults, ...initialData });

  useEffect(() => {
    if (initialData) {
      const formattedData = { ...defaults, ...initialData };
      if (formattedData.pickupDate) formattedData.pickupDate = new Date(formattedData.pickupDate).toISOString().split('T')[0];
      if (formattedData.returnDate) formattedData.returnDate = new Date(formattedData.returnDate).toISOString().split('T')[0];
      setFormData(formattedData);
    } else {
      setFormData(defaults);
    }
  }, [initialData]);

  const [totalDays, setTotalDays] = useState(1);
  const [costs, setCosts] = useState({ baseAmount: 0, driverTotal: 0, extraKmCharges: 0, totalAmount: 0, balanceAmount: 0 });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const [empRes, clientRes] = await Promise.all([employeeAPI.get(), clientAPI.get()]);
        setEmployees(empRes.data || []);
        setClients(clientRes.data || []);
      } catch (err) { console.error(err); }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (formData.clientName) {
        const found = clients.find(c => c.name.toLowerCase() === formData.clientName.toLowerCase());
        setSelectedClient(found || null);
    } else {
        setSelectedClient(null);
    }
  }, [formData.clientName, clients]);

  useEffect(() => {
    const start = new Date(formData.pickupDate);
    const end = new Date(formData.returnDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    setTotalDays(diffDays);
  }, [formData.pickupDate, formData.returnDate]);

  useEffect(() => {
    const fetchAvailable = async () => {
      setLoadingVehicles(true);
      try {
        const res = await bookingAPI.getAvailableVehicles(formData.pickupDate, formData.returnDate);
        setAvailableVehicles(Array.isArray(res.data) ? res.data : []);
        
        // If editing and current vehicle is not in available list (because it's already booked by this booking), add it back
        if (initialData && initialData.vehicle) {
            const currentVeh = initialData.vehicle;
            if (!res.data.find(v => v._id === currentVeh._id)) {
                setAvailableVehicles(prev => [currentVeh, ...prev]);
            }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingVehicles(false);
      }
    };
    if (formData.pickupDate && formData.returnDate) {
      fetchAvailable();
    }
  }, [formData.pickupDate, formData.returnDate, initialData]);

  // Customer History Lookup by NIC
  useEffect(() => {
    const nic = (formData.clientNic || '').trim();
    // Allow lookup after 3 characters to be more flexible (standard NICs are 10/12, but some use short IDs)
    if (nic && nic.length >= 3) {
      const fetchHistory = async () => {
        setFetchingHistory(true);
        console.log('RAXWO Debug: Fetching history for NIC:', nic);
        try {
          const res = await bookingAPI.getCustomerHistory(nic);
          if (res.data && res.data.details) {
            console.log('RAXWO Debug: Customer match found for:', res.data.details.name);
            console.log('RAXWO Debug: Details received:', Object.keys(res.data.details));
            console.log('RAXWO Debug: Photo lengths:', {
              front: res.data.details.customerIdFront?.length || 0,
              back: res.data.details.customerIdBack?.length || 0
            });
            setCustomerHistory(res.data.history || []);
            
            // Auto-fill details (Overwrite with latest record for this NIC)
            setFormData(prev => {
              const updated = {
                ...prev,
                clientNic: res.data.details.nic,
                clientName: res.data.details.name,
                clientPhone: res.data.details.phone,
                drivingLicenseNo: res.data.details.drivingLicenseNo,
                customerIdFront: res.data.details.customerIdFront,
                customerIdBack: res.data.details.customerIdBack
              };
              console.log('RAXWO Debug: FINAL Updated Photos:', {
                front: updated.customerIdFront ? 'Exists' : 'Empty',
                back: updated.customerIdBack ? 'Exists' : 'Empty'
              });
              return updated;
            });
          } else {
            setCustomerHistory(null);
          }
        } catch (err) {
          console.log('RAXWO Debug: No record found for NIC:', nic);
          setCustomerHistory(null);
        } finally {
          setFetchingHistory(false);
        }
      };
      
      const timeoutId = setTimeout(fetchHistory, 600); // 600ms debounce
      return () => clearTimeout(timeoutId);
    } else {
        setCustomerHistory(null);
    }
  }, [formData.clientNic]);

  useEffect(() => {
    const base = (formData.dailyRate || 0) * totalDays;
    const driverTotal = formData.hasDriver ? (formData.driverFee || 0) * totalDays : 0;
    
    // Extra KM calculation if endKm is provided
    let extraKmCharge = 0;
    if (formData.endKm > formData.startKm) {
        const totalKm = formData.endKm - formData.startKm;
        const limit = (formData.kmLimit || 0) * totalDays;
        const extraKm = Math.max(0, totalKm - limit);
        extraKmCharge = extraKm * (formData.extraKmRate || 0);
    }

    const totalAmount = base + driverTotal + extraKmCharge - (formData.discount || 0);
    const balanceAmount = totalAmount - (formData.advancePayment || 0);
    
    setCosts({ 
        baseAmount: base, 
        driverTotal, 
        extraKmCharges: extraKmCharge, 
        totalAmount, 
        balanceAmount 
    });
  }, [formData.dailyRate, totalDays, formData.startKm, formData.endKm, formData.kmLimit, formData.extraKmRate, formData.advancePayment, formData.discount, formData.hasDriver, formData.driverFee]);

  const handleVehicleChange = (e) => {
    const vehId = e.target.value;
    const veh = availableVehicles.find(v => v._id === vehId);
    if (veh) {
      setFormData({
        ...formData,
        vehicle: vehId,
        dailyRate: veh.dailyRate || 0,
        kmLimit: veh.kmLimitPerDay || 100,
        extraKmRate: veh.extraKmRate || 50,
        startKm: veh.lastEndKm || 0 // Assuming we might track this later
      });
    } else {
      setFormData({ ...formData, vehicle: vehId });
    }
  };

  const handleIdPhotoChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size too large. Please select an image under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [field]: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submissionData = { ...formData, totalDays, ...costs };
    console.log('RAXWO Debug: Submitting Booking Data:', submissionData);
    onSubmit(submissionData);
  };

  return (
    <div className="booking-form-wrapper" style={{ display: 'flex', gap: '20px', background: 'var(--bg-main)', height: '100%', overflow: 'hidden' }}>
      <form onSubmit={handleSubmit} className="hire-form" style={{ flex: 1, minWidth: 0 }}>
        <div className="hire-form-scroll">
          
          <div className="form-section">
            <p className="form-section-title"><User size={16} /> Customer Information</p>
            <div className="form-grid-3">
              <div className="form-group">
                <label>NIC / Passport Number</label>
                <div style={{ position: 'relative' }}>
                    <input 
                        type="text" 
                        value={formData.clientNic} 
                        onChange={e => setFormData({...formData, clientNic: e.target.value.toUpperCase()})}
                        placeholder="e.g. 1999xxxxxxV"
                        className={fetchingHistory ? 'loading-input' : ''}
                        autoComplete="off"
                    />
                    {fetchingHistory && <RefreshCw size={14} className="spinner" style={{ position: 'absolute', right: '10px', top: '12px', opacity: 0.5 }} />}
                    {!fetchingHistory && customerHistory && (
                        <div style={{ position: 'absolute', right: '10px', top: '12px', color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                <ShieldCheck size={14} /> FOUND
                            </div>
                            {formData.customerIdFront ? (
                                <span style={{ fontSize: '0.6rem', opacity: 0.9, color: 'var(--success)', fontWeight: 700 }}>+ Photos Auto-filled</span>
                            ) : (
                                <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>No Photos in History</span>
                            )}
                        </div>
                    )}
                </div>
              </div>
              <div className="form-group">
                <label>Customer Name *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.clientName} 
                  onChange={e => setFormData({...formData, clientName: e.target.value})}
                  placeholder="Full Name"
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  value={formData.clientPhone} 
                  onChange={e => setFormData({...formData, clientPhone: e.target.value})}
                  placeholder="07x xxxxxxx"
                />
              </div>
              <div className="form-group">
                <label>Driving License No</label>
                <input 
                  type="text" 
                  value={formData.drivingLicenseNo} 
                  onChange={e => setFormData({...formData, drivingLicenseNo: e.target.value.toUpperCase()})}
                  placeholder="e.g. B1234567"
                />
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: '16px' }}>
              <div className="form-group">
                  <label>Customer ID Front Side</label>
                  <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => handleIdPhotoChange(e, 'customerIdFront')}
                      style={{ border: 'none', padding: '8px 0' }}
                  />
                  {formData.customerIdFront && (
                    <div style={{ marginTop: '8px', position: 'relative' }}>
                      <img 
                        src={formData.customerIdFront} 
                        alt="ID Front Preview" 
                        style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, customerIdFront: ''})}
                        style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                      >✕</button>
                    </div>
                  )}
              </div>
              <div className="form-group">
                  <label>Customer ID Back Side</label>
                  <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => handleIdPhotoChange(e, 'customerIdBack')}
                      style={{ border: 'none', padding: '8px 0' }}
                  />
                  {formData.customerIdBack && (
                    <div style={{ marginTop: '8px', position: 'relative' }}>
                      <img 
                        src={formData.customerIdBack} 
                        alt="ID Back Preview" 
                        style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, customerIdBack: ''})}
                        style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                      >✕</button>
                    </div>
                  )}
              </div>
            </div>
          </div>
  
          <div className="form-section">
            <p className="form-section-title"><Info size={16} /> Booking Type</p>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Booking Category</label>
                <select 
                  value={formData.bookingType} 
                  onChange={e => setFormData({...formData, bookingType: e.target.value})}
                  style={{ border: formData.bookingType === 'Wedding' ? '2px solid #EC4899' : '1px solid var(--border)' }}
                >
                  <option value="General">General Rental</option>
                  <option value="Wedding">Wedding Booking</option>
                </select>
              </div>
              {formData.bookingType === 'Wedding' && (
                <div className="form-group">
                  <label>Wedding Decoration Info</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Flower colors, Ribbon types"
                    value={formData.weddingDetails || ''}
                    onChange={e => setFormData({...formData, weddingDetails: e.target.value})}
                  />
                </div>
              )}
            </div>
          </div>
  
          <div className="form-section">
            <p className="form-section-title"><Calendar size={16} /> Schedule & Vehicle</p>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Pickup Date *</label>
                <input 
                  type="date" 
                  required 
                  value={formData.pickupDate} 
                  onChange={e => setFormData({...formData, pickupDate: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Return Date *</label>
                <input 
                  type="date" 
                  required 
                  value={formData.returnDate} 
                  onChange={e => setFormData({...formData, returnDate: e.target.value})}
                />
              </div>
            </div>
  
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Select Available Vehicle * {loadingVehicles && ' (Checking...)'}</label>
              <div className="select-wrapper">
                  <Car className="input-icon-left" size={18} />
                  <select 
                      required 
                      value={typeof formData.vehicle === 'object' ? formData.vehicle._id : formData.vehicle} 
                      onChange={handleVehicleChange}
                      style={{ paddingLeft: '40px' }}
                  >
                      <option value="">-- Choose a Car --</option>
                      {availableVehicles.map(v => (
                          <option key={v._id} value={v._id}>
                              [{v.category}] {v.number} - {v.model} (LKR {v.dailyRate}/day)
                          </option>
                      ))}
                  </select>
              </div>
              {availableVehicles.length === 0 && !loadingVehicles && (
                  <small style={{ color: '#EF4444' }}>No vehicles available for these dates.</small>
              )}
            </div>
          </div>
  
          <div className="form-section">
              <p className="form-section-title"><Info size={16} /> Locations & KM Tracking</p>
              <div className="form-grid-2">
                  <div className="form-group">
                      <label>Pickup Location</label>
                      <input type="text" value={formData.pickupLocation} onChange={e => setFormData({...formData, pickupLocation: e.target.value})} />
                  </div>
                  <div className="form-group">
                      <label>Return Location</label>
                      <input type="text" value={formData.returnLocation} onChange={e => setFormData({...formData, returnLocation: e.target.value})} />
                  </div>
              </div>
              <div className="form-grid-3" style={{ marginTop: '16px' }}>
                  <div className="form-group">
                      <label>Start KM</label>
                      <input type="number" value={formData.startKm} onChange={e => setFormData({...formData, startKm: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                      <label>Fuel Level (Pickup)</label>
                      <select value={formData.fuelLevel} onChange={e => setFormData({...formData, fuelLevel: e.target.value})}>
                          <option value="Full">Full</option>
                          <option value="3/4">3/4 Tank</option>
                          <option value="1/2">1/2 Tank</option>
                          <option value="1/4">1/4 Tank</option>
                          <option value="Empty">Empty</option>
                      </select>
                  </div>
                  <div className="form-group">
                      <label>End KM (Return)</label>
                      <input type="number" value={formData.endKm} onChange={e => setFormData({...formData, endKm: Number(e.target.value)})} />
                  </div>
              </div>
          </div>
  
          <div className="form-section" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}>
              <p className="form-section-title" style={{ color: 'var(--accent)' }}><Hash size={16} /> Pricing & Payment</p>
              <div className="form-grid-3">
                  <div className="form-group">
                      <label>Daily Rate (LKR)</label>
                      <input type="number" value={formData.dailyRate} onChange={e => setFormData({...formData, dailyRate: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                      <label>KM Limit / Day</label>
                      <input type="number" value={formData.kmLimit} onChange={e => setFormData({...formData, kmLimit: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                      <label>Extra KM Rate</label>
                      <input type="number" value={formData.extraKmRate} onChange={e => setFormData({...formData, extraKmRate: Number(e.target.value)})} />
                  </div>
              </div>
              
              <div className="form-grid-3" style={{ marginTop: '16px' }}>
                  <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input 
                              type="checkbox" 
                              checked={formData.hasDriver} 
                              onChange={e => setFormData({...formData, hasDriver: e.target.checked})} 
                          />
                          Include Driver
                      </label>
                  </div>
                  {formData.hasDriver && (
                      <>
                      <div className="form-group">
                          <label>Driver Fee (LKR/Day)</label>
                          <input type="number" value={formData.driverFee} onChange={e => setFormData({...formData, driverFee: Number(e.target.value)})} />
                      </div>
                      <div className="form-group">
                          <label>Assign Driver</label>
                          <select value={formData.driverName} onChange={e => setFormData({...formData, driverName: e.target.value})}>
                              <option value="">-- No Driver Assigned --</option>
                              {employees.filter(e => e.role === 'Driver').map(e => (
                                  <option key={e._id} value={e.name}>{e.name}</option>
                              ))}
                          </select>
                      </div>
                      </>
                  )}
              </div>
  
              <div className="form-grid-3" style={{ marginTop: '16px' }}>
                  <div className="form-group">
                      <label>Refundable Deposit (LKR)</label>
                      <input type="number" value={formData.securityDeposit} onChange={e => setFormData({...formData, securityDeposit: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                      <label>Advance Payment (LKR)</label>
                      <input type="number" value={formData.advancePayment} onChange={e => setFormData({...formData, advancePayment: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                      <label>Discount (LKR)</label>
                      <input type="number" value={formData.discount} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} />
                  </div>
              </div>
  
              <div className="pricing-breakdown" style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px dashed var(--accent-glow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Base Rent ({totalDays} days x LKR {formData.dailyRate})</span>
                      <span>LKR {costs.baseAmount.toLocaleString()}</span>
                  </div>
                  {formData.hasDriver && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#6366F1' }}>
                          <span>Driver Service ({totalDays} days)</span>
                          <span>+ LKR {costs.driverTotal.toLocaleString()}</span>
                      </div>
                  )}
                  {costs.extraKmCharges > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#EF4444' }}>
                          <span>Extra KM Charges</span>
                          <span>+ LKR {costs.extraKmCharges.toLocaleString()}</span>
                      </div>
                  )}
                  {formData.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#10B981' }}>
                          <span>Discount</span>
                          <span>- LKR {formData.discount.toLocaleString()}</span>
                      </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.1rem', marginTop: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                      <span>NET TOTAL</span>
                      <span style={{ color: 'var(--accent)' }}>LKR {costs.totalAmount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginTop: '5px' }}>
                      <span>NEW BOOKING BALANCE</span>
                      <span style={{ color: costs.balanceAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {costs.balanceAmount.toLocaleString()}</span>
                  </div>
                  {selectedClient && selectedClient.outstanding > 0 && (
                      <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid var(--danger)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: 'var(--danger)' }}>
                              <span>PREVIOUS OUTSTANDING</span>
                              <span>LKR {selectedClient.outstanding.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', marginTop: '5px', fontSize: '1.2rem', color: 'var(--danger)' }}>
                              <span>TOTAL SETTLEMENT</span>
                              <span>LKR {(costs.balanceAmount + selectedClient.outstanding).toLocaleString()}</span>
                          </div>
                      </div>
                  )}
              </div>
          </div>
  
          <div className="form-group" style={{ marginTop: '20px' }}>
              <label>Notes / Special Requirements</label>
              <textarea 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="e.g. Baby seat needed, Wedding decoration, etc."
                  rows="3"
              />
          </div>
  
          <div className="form-group">
              <label>Booking Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Active">Active (Car Picked Up)</option>
                  <option value="Completed">Completed (Car Returned)</option>
                  <option value="Cancelled">Cancelled</option>
              </select>
          </div>
  
        </div>
  
        <div className="hire-form-footer">
          <div className="total-display">
            <span>{totalDays} Day(s) Booking</span>
            <strong>LKR {costs.totalAmount.toLocaleString()}</strong>
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="submit-btn" disabled={!formData.vehicle}>
              {initialData ? 'Update Booking' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Customer History Side Panel ── */}
      {(customerHistory || fetchingHistory) && (
        <div className="history-panel" style={{ 
            width: '320px', 
            background: 'var(--bg-side)', 
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.4s ease'
        }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={18} className={fetchingHistory ? 'spinner' : ''} style={{ color: 'var(--accent)' }} />
                    Customer History
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Previous rentals for this NIC</p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {fetchingHistory ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                        <RefreshCw size={32} className="spinner" style={{ marginBottom: '12px', opacity: 0.2 }} />
                        <p>Fetching records...</p>
                    </div>
                ) : customerHistory && customerHistory.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {customerHistory.map((h, i) => (
                            <div key={i} style={{ 
                                background: 'var(--bg-card)', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        {new Date(h.date).toLocaleDateString()}
                                    </span>
                                    <span style={{ 
                                        fontSize: '0.7rem', 
                                        padding: '2px 8px', 
                                        borderRadius: '10px',
                                        background: h.status === 'Completed' ? 'var(--success-soft)' : 'var(--accent-soft)',
                                        color: h.status === 'Completed' ? 'var(--success)' : 'var(--accent)',
                                        fontWeight: 700
                                    }}>
                                        {h.status}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <Car size={14} style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{h.vehicle}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TrendingUp size={14} style={{ color: 'var(--success)' }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>LKR {h.price?.toLocaleString()}</span>
                                    </div>
                                    {h.dailyRate && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                                            Rate: {h.dailyRate.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                        <Info size={32} style={{ marginBottom: '12px', opacity: 0.1 }} />
                        <p>No previous records found.</p>
                    </div>
                )}
            </div>
            
            <div style={{ padding: '20px', background: 'var(--accent-soft)', borderTop: '1px solid var(--accent-glow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)' }}>
                    <ShieldCheck size={20} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Returning Customer</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--accent)', opacity: 0.8 }}>
                    Details have been auto-filled based on the latest record.
                </p>
            </div>
        </div>
      )}
    </div>
  );
};

export default BookingForm;
