import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Image as ImageIcon, Phone, MapPin, Mail, Hash, Globe } from 'lucide-react';
import '../styles/books.css';

const Settings = ({ onSettingsUpdate }) => {
  const [settings, setSettings] = useState({
    companyName: '',
    address: '',
    phones: [],
    email: '',
    regNo: '',
    logo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('settings');
      setSettings(res.data);
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('settings', settings);
      if (onSettingsUpdate) onSettingsUpdate();
      alert('Settings updated successfully!');
    } catch (err) {
      alert('Failed to update settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const addPhone = () => {
    if (phoneInput.trim()) {
      setSettings({ ...settings, phones: [...settings.phones, phoneInput.trim()] });
      setPhoneInput('');
    }
  };

  const removePhone = (index) => {
    const newPhones = settings.phones.filter((_, i) => i !== index);
    setSettings({ ...settings, phones: newPhones });
  };

  if (loading) return <div className="loading-container">Loading Settings...</div>;

  return (
    <div className="book-container">
      <div className="book-header">
        <div className="header-title">
          <SettingsIcon size={24} />
          <h2>System Configuration</h2>
        </div>
        <p className="header-subtitle">Manage your company branding and administrative details</p>
      </div>

      <div className="premium-card">
        <form onSubmit={handleSave} className="hire-form">
          <div className="settings-section">
            <h3 className="section-title"><MapPin size={18} /> Basic Information</h3>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Company Name</label>
                <input 
                  type="text" 
                  className="premium-input"
                  value={settings.companyName} 
                  onChange={e => setSettings({ ...settings, companyName: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Registration Number</label>
                <input 
                  type="text" 
                  className="premium-input"
                  value={settings.regNo} 
                  onChange={e => setSettings({ ...settings, regNo: e.target.value })} 
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title"><ImageIcon size={18} /> Visual Identity</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
              <div className="logo-preview-box">
                {settings.logo ? (
                  <img src={settings.logo} alt="Logo" />
                ) : (
                  <ImageIcon size={40} color="var(--text-dim)" />
                )}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} id="logo-upload" />
                <label htmlFor="logo-upload" className="upload-label btn-glow">
                  <ImageIcon size={18} /> Change Company Logo
                </label>
                <p className="upload-hint">Recommended: Square PNG or JPG (Min. 400x400)</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title"><Globe size={18} /> Location & Contact</h3>
            <div className="form-group">
              <label>Business Address</label>
              <textarea 
                className="premium-input"
                rows="3" 
                value={settings.address} 
                onChange={e => setSettings({ ...settings, address: e.target.value })}
                required
              />
            </div>

            <div className="form-grid-2" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Official Email</label>
                <input 
                  type="email" 
                  className="premium-input"
                  value={settings.email} 
                  onChange={e => setSettings({ ...settings, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Contact Numbers</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    className="premium-input"
                    value={phoneInput} 
                    onChange={e => setPhoneInput(e.target.value)} 
                    placeholder="+94 ..." 
                  />
                  <button type="button" className="add-btn btn-glow" onClick={addPhone}>Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
                  {settings.phones.map((p, i) => (
                    <div key={i} className="phone-tag">
                      <Phone size={14} />
                      <span>{p}</span>
                      <button type="button" onClick={() => removePhone(i)} className="remove-tag">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="submit-btn btn-glow" disabled={saving} style={{ padding: '16px 40px', fontSize: '1rem', background: 'linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)' }}>
              <Save size={20} /> {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
