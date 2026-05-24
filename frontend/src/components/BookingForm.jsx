import React, { useState, useEffect } from 'react';
import { toolAPI, bookingAPI, employeeAPI, clientAPI, accessoryAPI, accountAPI } from '../services/api';
import { Calendar, Package, MapPin, Hash, Info, User, Phone, Wallet, ShieldCheck, RefreshCw, TrendingUp, Plus, Trash2, FileText } from 'lucide-react';
import Autocomplete from './Autocomplete';
import '../styles/forms.css';

const BookingForm = ({ onSubmit, onCancel, initialData }) => {
  const [availableTools, setAvailableTools] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [allAccessories, setAllAccessories] = useState([]);
  const [accSearch, setAccSearch] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [loadingTools, setLoadingTools] = useState(false);

  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contact: '', nic: '' });

  const [customerHistory, setCustomerHistory] = useState(null);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const defaults = {
    clientNic: '',
    clientName: '',
    clientPhone: '',
    pickupLocation: '',
    returnLocation: '',
    conditionOnPickup: '',
    notes: '',
    status: 'Confirmed',
    bookingType: 'General',
    items: [], // [{ tool, toolNumber, model, category, dailyRate }]
    bookingAccessories: [], // { accessoryId, name, quantity, price }
    discount: 0,
    advancePayment: 0,
    transportCharge: 0,
    paymentMethod: 'Cash',
    customerIdFront: '',
    customerIdBack: '',
    accountId: ''
  };

  const [formData, setFormData] = useState({ ...defaults, ...initialData });

  useEffect(() => {
    if (initialData) {
      const formattedData = { ...defaults, ...initialData };

      // Handle legacy single-tool bookings vs new multi-item bookings
      if (!formattedData.items || formattedData.items.length === 0) {
        if (formattedData.tool) {
          const tObj = typeof formattedData.tool === 'object' ? formattedData.tool : null;
          formattedData.items = [{
            tool: tObj ? tObj._id : formattedData.tool,
            toolNumber: tObj ? tObj.number : (formattedData.toolNo || '—'),
            model: tObj ? tObj.model : '',
            category: tObj ? tObj.category : '',
            dailyRate: formattedData.dailyRate || 0
          }];
        } else {
          formattedData.items = [];
        }
      }

      // Map database accessories to UI bookingAccessories
      if (formattedData.accessories && Array.isArray(formattedData.accessories)) {
        formattedData.bookingAccessories = formattedData.accessories.map(a => ({
          accessoryId: a.accessory || a._id,
          name: a.name,
          quantity: a.quantity || 1,
          price: a.price || 0
        }));
      }

      if (formattedData.pickupDate) formattedData.pickupDate = new Date(formattedData.pickupDate).toISOString().split('T')[0];
      if (formattedData.returnDate) formattedData.returnDate = new Date(formattedData.returnDate).toISOString().split('T')[0];

      setFormData(formattedData);
    } else {
      setFormData(defaults);
    }
  }, [initialData]);

  const [totalDays, setTotalDays] = useState(1);
  const [costs, setCosts] = useState({ baseAmount: 0, totalAmount: 0, balanceAmount: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, clientRes, accRes, accountRes] = await Promise.all([
          employeeAPI.get(), clientAPI.get(), accessoryAPI.get(), accountAPI.get()
        ]);
        setEmployees(empRes.data || []);
        setClients(clientRes.data || []);
        setAllAccessories(accRes.data || []);
        setAccounts(accountRes.data || []);
      } catch (err) { console.error(err); }
    };
    fetchData();
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
    if (isNaN(start) || isNaN(end)) return;

    const diffTime = end - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    setTotalDays(diffDays > 0 ? diffDays : 1);
  }, [formData.pickupDate, formData.returnDate]);

  useEffect(() => {
    const fetchAvailable = async () => {
      setLoadingTools(true);
      try {
        console.log('DEBUG: Fetching tools for suggestions...');
        const res = await (formData.pickupDate && formData.returnDate
          ? bookingAPI.getAvailableTools(formData.pickupDate, formData.returnDate)
          : toolAPI.get());

        let tools = Array.isArray(res.data) ? res.data : (res.data.tools || []);

        // Fallback to local storage if API returns empty but we have local data
        if (tools.length === 0) {
          const local = localStorage.getItem('raxwo_tools');
          if (local) {
            console.log('DEBUG: Using local storage fallback for tools');
            tools = JSON.parse(local);
          }
        }

        console.log(`DEBUG: Found ${tools.length} tools for suggestions`);
        setAvailableTools(tools);

        if (initialData && initialData.tool) {
          const currentTool = initialData.tool;
          if (!tools.find(t => t._id === currentTool._id)) {
            setAvailableTools(prev => [currentTool, ...prev]);
          }
        }
      } catch (err) {
        console.error('RAXWO: Tool fetch failed', err);
        // Emergency fallback
        const local = localStorage.getItem('raxwo_tools');
        if (local) setAvailableTools(JSON.parse(local));
      } finally {
        setLoadingTools(false);
      }
    };

    fetchAvailable();
  }, [formData.pickupDate, formData.returnDate, initialData]);

  useEffect(() => {
    const nic = (formData.clientNic || '').trim();
    if (nic && nic.length >= 3) {
      const fetchHistory = async () => {
        setFetchingHistory(true);
        try {
          const res = await bookingAPI.getCustomerHistory(nic);
          if (res.data && res.data.details) {
            setCustomerHistory(res.data.history || []);
            setFormData(prev => ({
              ...prev,
              clientNic: res.data.details.nic || prev.clientNic,
              clientName: res.data.details.name || prev.clientName,
              clientPhone: res.data.details.phone || prev.clientPhone,
              customerIdFront: res.data.details.customerIdFront || prev.customerIdFront,
              customerIdBack: res.data.details.customerIdBack || prev.customerIdBack
            }));
          } else {
            setCustomerHistory(null);
          }
        } catch (err) {
          setCustomerHistory(null);
        } finally {
          setFetchingHistory(false);
        }
      };

      const timeoutId = setTimeout(fetchHistory, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setCustomerHistory(null);
    }
  }, [formData.clientNic]);

  useEffect(() => {
    const toolsTotal = formData.items.reduce((sum, item) => sum + (item.dailyRate * totalDays), 0);
    const accTotal = formData.bookingAccessories.reduce((sum, acc) => sum + (acc.price * acc.quantity), 0);
    const transport = Number(formData.transportCharge || 0);
    const totalAmount = (toolsTotal + accTotal + transport) - (formData.discount || 0);
    const balanceAmount = totalAmount - (formData.advancePayment || 0);

    setCosts({
      baseAmount: (toolsTotal + accTotal + transport),
      totalAmount,
      balanceAmount
    });
  }, [formData.items, formData.bookingAccessories, totalDays, formData.advancePayment, formData.discount, formData.transportCharge]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addTool = (toolNum) => {
    const tool = availableTools.find(t => t.number === toolNum);
    if (!tool) return;

    // Check if already added
    if (formData.items.some(item => item.tool === tool._id)) return;

    const newItem = {
      tool: tool._id,
      toolNumber: tool.number,
      model: tool.model,
      category: tool.category,
      dailyRate: tool.dailyRate || 0
    };

    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    });
    setToolSearch('');
  };

  const removeItem = (index) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const addAccessory = (accName) => {
    const acc = allAccessories.find(a => a.name === accName);
    if (!acc) return;
    const existing = formData.bookingAccessories.find(a => a.accessoryId === acc._id);
    if (existing) {
      setFormData({
        ...formData,
        bookingAccessories: formData.bookingAccessories.map(a => a.accessoryId === acc._id ? { ...a, quantity: a.quantity + 1 } : a)
      });
    } else {
      setFormData({
        ...formData,
        bookingAccessories: [...formData.bookingAccessories, { accessoryId: acc._id, name: acc.name, quantity: 1, price: acc.price }]
      });
    }
    setAccSearch(''); // Clear search after adding
  };

  const removeAccessory = (index) => {
    setFormData({
      ...formData,
      bookingAccessories: formData.bookingAccessories.filter((_, i) => i !== index)
    });
  };

  const handleAccQtyChange = (index, qty) => {
    const newAccs = [...formData.bookingAccessories];
    newAccs[index].quantity = Math.max(1, qty);
    setFormData({ ...formData, bookingAccessories: newAccs });
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
        setFormData(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickAddClient = async () => {
    if (!newClient.name) return alert('Name is required');
    try {
      const res = await clientAPI.create({ ...newClient, status: 'Active' });
      setClients([...clients, res.data]);
      setFormData(prev => ({
        ...prev,
        clientName: res.data.name,
        clientPhone: res.data.contact,
        clientNic: res.data.nic
      }));
      setShowAddClient(false);
      setNewClient({ name: '', contact: '', nic: '' });
      alert('New customer saved successfully!');
    } catch (err) {
      alert('Failed to save customer');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.items.length === 0) {
        alert('Please select at least one tool.');
        return;
      }

      // Create one consolidated booking object
      const finalBooking = {
        ...formData,
        tool: formData.items[0]?.tool, // Add top-level tool for backend availability check & legacy support
        totalAmount: costs.totalAmount,
        balanceAmount: costs.balanceAmount,
        totalDays: totalDays,
        // Map UI accessories to backend schema
        accessories: formData.bookingAccessories.map(a => ({
          accessory: a.accessoryId,
          name: a.name,
          quantity: Number(a.quantity),
          price: Number(a.price)
        })),
        // Ensure items array is preserved
        items: formData.items.map(it => ({
          tool: it.tool,
          toolNumber: it.toolNumber,
          model: it.model,
          dailyRate: it.dailyRate
        }))
      };

      // Sanitize ObjectIds to prevent BSON casting errors
      if (!finalBooking.accountId) delete finalBooking.accountId;

      // Notify parent - parent will handle the API call
      if (onSubmit) {
        await onSubmit(finalBooking);
      }
    } catch (err) {
      console.error('Submission Preparation Error:', err);
      alert('Error preparing booking data.');
    }
  };

  return (
    <div className="booking-form-wrapper form-flex form-bg-side">
      <form onSubmit={handleSubmit} className="hire-form form-flex-1">
        <div className="hire-form-scroll">

          <div className="form-section">
            <p className="form-section-title"><Calendar size={16} /> Rental Schedule</p>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Pickup Date *</label>
                <input
                  type="date"
                  required
                  value={formData.pickupDate || ''}
                  onChange={e => setFormData(prev => ({ ...prev, pickupDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Return Date *</label>
                <input
                  type="date"
                  required
                  value={formData.returnDate || ''}
                  onChange={e => setFormData(prev => ({ ...prev, returnDate: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title"><User size={16} /> Customer Information</p>
            <div className="form-grid-3">
              <div className="form-group">
                <label>NIC / Passport Number</label>
                <div style={{ position: 'relative' }}>
                  <Autocomplete
                    name="clientNic"
                    value={formData.clientNic}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setFormData(prev => ({ ...prev, clientNic: val }));
                    }}
                    options={clients.map(c => c.nic).filter(Boolean)}
                    placeholder="Enter NIC to lookup..."
                    className={fetchingHistory ? 'lookup-loading' : ''}
                  />
                  {fetchingHistory && <RefreshCw size={14} className="spinner" style={{ position: 'absolute', right: '10px', top: '12px', opacity: 0.8, color: 'var(--accent)' }} />}
                  {!fetchingHistory && customerHistory && (
                    <div style={{ position: 'absolute', right: '10px', top: '12px', color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                        <ShieldCheck size={14} /> CUSTOMER FOUND
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Customer Name *</span>
                  <button
                    type="button"
                    onClick={() => setShowAddClient(!showAddClient)}
                    className="add-btn"
                    style={{ height: '34px', padding: '0 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Plus size={14} /> New
                  </button>
                </label>
                <Autocomplete
                  name="clientName"
                  value={formData.clientName}
                  required
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, clientName: val }));
                    const found = clients.find(c => c.name.toLowerCase() === val.toLowerCase());
                    if (found) {
                      setFormData(prev => ({
                        ...prev,
                        clientPhone: found.contact || prev.clientPhone,
                        clientNic: found.nic || prev.clientNic,
                        customerIdFront: found.customerIdFront || prev.customerIdFront,
                        customerIdBack: found.customerIdBack || prev.customerIdBack
                      }));
                    }
                  }}
                  options={clients.map(c => c.name)}
                  placeholder="Type customer name to search..."
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  name="clientPhone"
                  value={formData.clientPhone || ''}
                  onChange={e => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                  placeholder="07x xxxxxxx"
                  autoComplete="off"
                  data-lpignore="true"
                />
              </div>
            </div>

            {showAddClient && (
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                  <label>New Name</label>
                  <input type="text" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                  <label>New Contact</label>
                  <input type="text" value={newClient.contact} onChange={e => setNewClient({ ...newClient, contact: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                  <label>New NIC</label>
                  <input type="text" value={newClient.nic} onChange={e => setNewClient({ ...newClient, nic: e.target.value })} />
                </div>
                <button type="button" onClick={handleQuickAddClient} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, height: '40px' }}>
                  Save Customer
                </button>
              </div>
            )}

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
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* ///////////////////////////////////////////////////////////////select */}
          <div className="form-section">
            <p className="form-section-title">
              <Package size={16} /> Selected Tools & Pricing
            </p>

            <div
              className="tool-selector"
              style={{ marginBottom: "16px", position: "relative" }}
            >
              <Autocomplete
                name="toolSearch"
                value={toolSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setToolSearch(val);

                  // Check if the value matches any tool's full description
                  const found = availableTools.find(
                    (t) =>
                      `${t.number} - ${t.model} (${t.status || "Available"})` === val ||
                      t.number === val
                  );

                  if (found) {
                    if (
                      found.status &&
                      found.status !== "Available" &&
                      found.status !== "Active" &&
                      !initialData
                    ) {
                      alert(
                        `Warning: This tool is currently ${found.status}. Please check availability dates.`
                      );
                    }

                    addTool(found.number);
                    setToolSearch("");
                  }
                }}
                options={availableTools.map(
                  (t) => `${t.number} - ${t.model} (${t.status || "Available"})`
                )}
                placeholder="Search by Tool ID, Model or Category..."
                className="full-width-autocomplete"
              />

              {/* Clear Search Button */}
              {toolSearch && (
                <button
                  type="button"
                  onClick={() => setToolSearch("")}
                  title="Clear Search"
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "#f3f4f6",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#666",
                    fontSize: "14px",
                    fontWeight: "bold",
                    zIndex: 10,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Clear All Selected Tools */}
            {formData.items.length > 0 && (
              <div style={{ marginBottom: "16px", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      items: [],
                    })
                  }
                  style={{
                    background: "#fee2e2",
                    color: "#dc2626",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Clear All Tools
                </button>
              </div>
            )}

            {formData.items.map((item, index) => (
              <div key={index} className="tool-item-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tool Info</label>
                  <div
                    style={{
                      padding: "10px",
                      background: "var(--bg-main)",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    {item.toolNumber} - {item.model}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Daily Rate</label>
                  <input
                    type="number"
                    value={item.dailyRate}
                    onChange={(e) =>
                      handleItemChange(index, "dailyRate", Number(e.target.value))
                    }
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Subtotal</label>
                  <input
                    type="text"
                    value={`LKR ${(item.dailyRate * totalDays).toLocaleString()}`}
                    readOnly
                    className="input-highlight-blue"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    paddingBottom: "4px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{
                      background: "var(--danger-soft)",
                      color: "var(--danger)",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px",
                      cursor: "pointer",
                    }}
                  >
                    <TrendingUp
                      style={{ transform: "rotate(45deg)" }}
                      size={18}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* <div className="form-section">
            <p className="form-section-title"><Package size={16} /> Selected Tools & Pricing</p>
            
            <div className="tool-selector" style={{ marginBottom: '16px' }}>
                <Autocomplete 
                  name="toolSearch"
                  value={toolSearch}
                  onChange={e => {
                    const val = e.target.value;
                    setToolSearch(val);
                    // Check if the value matches any tool's full description
                    const found = availableTools.find(t => 
                      `${t.number} - ${t.model} (${t.status || 'Available'})` === val || t.number === val
                    );
                    if (found) {
                      if (found.status && found.status !== 'Available' && found.status !== 'Active' && !initialData) {
                        alert(`Warning: This tool is currently ${found.status}. Please check availability dates.`);
                      }
                      addTool(found.number);
                      setToolSearch('');
                    }
                  }}
                  options={availableTools.map(t => `${t.number} - ${t.model} (${t.status || 'Available'})`)}
                  placeholder="Search by Tool ID, Model or Category..."
                  className="full-width-autocomplete"
                />
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className="tool-item-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tool Info</label>
                  <div style={{ padding: '10px', background: 'var(--bg-main)', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600 }}>
                    {item.toolNumber} - {item.model}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Daily Rate</label>
                  <input
                    type="number"
                    value={item.dailyRate}
                    onChange={e => handleItemChange(index, 'dailyRate', Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Subtotal</label>
                  <input
                    type="text"
                    value={`LKR ${(item.dailyRate * totalDays).toLocaleString()}`}
                    readOnly
                    className="input-highlight-blue"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}
                  >
                    <TrendingUp style={{ transform: 'rotate(45deg)' }} size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div> */}
          {/* ///////////////////////////////////////////////////////////////select////////////////// */}
          <div className="form-section">
            <p className="form-section-title"><Package size={16} /> Parts & Accessories</p>
            <div className="accessory-selector" style={{ marginBottom: '16px' }}>
              <Autocomplete
                name="accSearch"
                value={accSearch}
                onChange={e => {
                  const val = e.target.value;
                  setAccSearch(val);
                  if (allAccessories.some(a => a.name === val)) {
                    addAccessory(val);
                  }
                }}
                options={allAccessories.map(a => a.name)}
                placeholder="Type to search parts/accessories..."
                className="full-width-autocomplete"
              />
            </div>

            {allAccessories.length > 0 ? (
              <div className="quick-acc-grid" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '20px',
                maxHeight: '140px',
                overflowY: 'auto',
                padding: '12px',
                background: 'var(--bg-side)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <span style={{ width: '100%', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Quick Add:</span>
                {allAccessories.map(a => (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => addAccessory(a.name)}
                    className="quick-add-badge"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--accent-glow)',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                      boxShadow: '0 2px 4px var(--accent-glow)'
                    }}
                  >
                    <Plus size={14} strokeWidth={3} /> {a.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-parts-state" style={{
                textAlign: 'center',
                padding: '24px',
                background: 'var(--bg-side)',
                borderRadius: '16px',
                marginBottom: '20px',
                border: '1px dashed var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Package size={32} style={{ opacity: 0.1, marginBottom: '4px' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>No parts or accessories available.</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>Add them in the <strong>"Parts & Accessories"</strong> inventory tab.</p>
              </div>
            )}

            {formData.bookingAccessories.length > 0 && (
              <div className="selected-accessories-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formData.bookingAccessories.map((acc, index) => (
                  <div key={index} className="accessory-item-row" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <div className="accessory-info" style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{acc.name}</strong>
                      <div className="accessory-price" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>LKR {acc.price.toLocaleString()} / unit</div>
                    </div>
                    <div className="accessory-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="qty-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-side)', padding: '4px 8px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)' }}>QTY:</span>
                        <input
                          type="number"
                          value={acc.quantity}
                          onChange={e => handleAccQtyChange(index, Number(e.target.value))}
                          style={{
                            width: '45px',
                            border: 'none',
                            background: 'none',
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            color: 'var(--text-main)',
                            textAlign: 'center',
                            padding: 0
                          }}
                          min="1"
                        />
                      </div>
                      <div className="accessory-subtotal" style={{ minWidth: '100px', textAlign: 'right', fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent)' }}>
                        LKR {(acc.price * acc.quantity).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAccessory(index)}
                        className="action-icon-btn btn-delete"
                        title="Remove Accessory"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          <div className="form-section">
            <p className="form-section-title"><Info size={16} /> Locations & Condition</p>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Pickup Store / Location</label>
                <input type="text" value={formData.pickupLocation || ''} onChange={e => setFormData(prev => ({ ...prev, pickupLocation: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Return Store / Location</label>
                <input type="text" value={formData.returnLocation || ''} onChange={e => setFormData(prev => ({ ...prev, returnLocation: e.target.value }))} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Condition on Pickup</label>
              <input type="text" value={formData.conditionOnPickup || ''} onChange={e => setFormData(prev => ({ ...prev, conditionOnPickup: e.target.value }))} placeholder="e.g. Good, Scratch on handle" />
            </div>
          </div>
          {/* ///////////////////////////////////////////////////////Payment//////////////////////////////////////////// */}
          {/* <div className="form-section" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}>
            <p className="form-section-title" style={{ color: 'var(--accent)' }}><Hash size={16} /> Pricing & Payment</p>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Advance Payment (LKR)</label>
                <input type="number" value={formData.advancePayment || 0} onChange={e => setFormData(prev => ({ ...prev, advancePayment: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Discount (LKR)</label>
                <input type="number" value={formData.discount || 0} onChange={e => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>Transport Charges (LKR)</label>
                <input type="number" value={formData.transportCharge || 0} onChange={e => setFormData(prev => ({ ...prev, transportCharge: Number(e.target.value) }))} />
              </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {formData.paymentMethod === 'Bank Transfer' && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Target Bank Account *</label>
                  <select required value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })}>
                    <option value="">Select Account</option>
                    {accounts.map(acc => <option key={acc._id} value={acc._id}>{acc.accountName} (LKR {acc.balance.toLocaleString()})</option>)}
                  </select>
                </div>
              )}

            <div className="pricing-breakdown" style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px dashed var(--accent-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Tool Rentals ({totalDays} days)</span>
                <span>LKR {formData.items.reduce((sum, item) => sum + (item.dailyRate * totalDays), 0).toLocaleString()}</span>
              </div>
              {formData.bookingAccessories.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Parts & Accessories</span>
                  <span>LKR {formData.bookingAccessories.reduce((sum, acc) => sum + (acc.price * acc.quantity), 0).toLocaleString()}</span>
                </div>
              )}
              {formData.transportCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Transport Charges</span>
                  <span>LKR {formData.transportCharge.toLocaleString()}</span>
                </div>
              )}
              {formData.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--success)' }}>
                  <span>Discount</span>
                  <span>- LKR {formData.discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.1rem', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span>NET TOTAL</span>
                <span style={{ color: 'var(--accent)' }}>LKR {costs.totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginTop: '5px' }}>
                <span>BOOKING BALANCE</span>
                <span style={{ color: costs.balanceAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>LKR {costs.balanceAmount.toLocaleString()}</span>
              </div>
            </div>
          </div> */}
          <div
            className="form-section"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-glow)",
            }}
          >
            <p className="form-section-title" style={{ color: "var(--accent)" }}>
              <Hash size={16} /> Pricing & Payment
            </p>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Advance Payment (LKR)</label>
                <input
                  type="number"
                  value={formData.advancePayment || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      advancePayment: Number(e.target.value),
                    }))
                  }
                />
              </div>

              {/* ✅ NEW: Deposit */}
              <div className="form-group">
                <label>Deposit (LKR)</label>
                <input
                  type="number"
                  value={formData.deposit || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deposit: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: "16px" }}>
              <div className="form-group">
                <label>Discount (LKR)</label>
                <input
                  type="number"
                  value={formData.discount || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      discount: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label>Transport Charges (LKR)</label>
                <input
                  type="number"
                  value={formData.transportCharge || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      transportCharge: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: "16px" }}>
              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value,
                    }))
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            {formData.paymentMethod === "Bank Transfer" && (
              <div className="form-group" style={{ marginTop: "16px" }}>
                <label>Target Bank Account *</label>
                <select
                  required
                  value={formData.accountId}
                  onChange={(e) =>
                    setFormData({ ...formData, accountId: e.target.value })
                  }
                >
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.accountName} (LKR {acc.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* pricing breakdown stays same */}
            <div
              className="pricing-breakdown"
              style={{
                marginTop: "20px",
                padding: "15px",
                background: "var(--bg-card)",
                borderRadius: "10px",
                border: "1px dashed var(--accent-glow)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>Tool Rentals ({totalDays} days)</span>
                <span>
                  LKR{" "}
                  {formData.items
                    .reduce((sum, item) => sum + item.dailyRate * totalDays, 0)
                    .toLocaleString()}
                </span>
              </div>

              {formData.bookingAccessories.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Parts & Accessories</span>
                  <span>
                    LKR{" "}
                    {formData.bookingAccessories
                      .reduce((sum, acc) => sum + acc.price * acc.quantity, 0)
                      .toLocaleString()}
                  </span>
                </div>
              )}

              {formData.transportCharge > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Transport Charges</span>
                  <span>LKR {formData.transportCharge.toLocaleString()}</span>
                </div>
              )}

              {/* optional: show deposit in breakdown */}
              {formData.deposit > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Deposit</span>
                  <span>LKR {formData.deposit.toLocaleString()}</span>
                </div>
              )}

              {formData.discount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    color: "var(--success)",
                  }}
                >
                  <span>Discount</span>
                  <span>- LKR {formData.discount.toLocaleString()}</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "800",
                  fontSize: "1.1rem",
                  marginTop: "10px",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "10px",
                }}
              >
                <span>NET TOTAL</span>
                <span style={{ color: "var(--accent)" }}>
                  LKR {costs.totalAmount.toLocaleString()}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "700",
                  marginTop: "5px",
                }}
              >
                <span>BOOKING BALANCE</span>
                <span
                  style={{
                    color: costs.balanceAmount > 0 ? "var(--danger)" : "var(--success)",
                  }}
                >
                  LKR {costs.balanceAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          {/* //////////////////////////////////////Payment////////////////////////////////////// */}

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label>Notes / Special Requirements</label>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Needs extra cable, Handle with care, etc."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Booking Status</label>
            <select value={formData.status} onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}>
              <option value="Confirmed">Confirmed</option>
              <option value="Active">Active (Tool Picked Up)</option>
              <option value="Returned">Returned (Completed)</option>
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
            <button type="submit" className="submit-btn" disabled={formData.items.length === 0 || formData.items.some(it => !it.tool)}>
              {initialData ? 'Update Booking' : 'Confirm Multi-Tool Booking'}
            </button>
          </div>
        </div>
      </form>

      {(customerHistory || fetchingHistory) && (
        <div className="history-panel form-history-panel">
          <div className="history-panel-header">
            <h3 className="history-panel-title form-flex form-align-center form-gap-sm">
              <RefreshCw size={18} className={fetchingHistory ? 'spinner' : ''} />
              Customer History
            </h3>
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
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)' }}>
                        {new Date(h.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Package size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{h.tool}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>LKR {h.price?.toLocaleString()}</span>
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
        </div>
      )}
    </div>
  );
};

export default BookingForm;
