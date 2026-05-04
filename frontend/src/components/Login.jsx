import React, { useState } from 'react';
import api from '../services/api';
import { ArrowLeft, User, Lock, Loader2, ShieldCheck } from 'lucide-react';
import logo from '../logo.png';
import './Login.css';

const Login = ({ onLoginSuccess, roleContext, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data && res.data.token) {
        localStorage.setItem('raxwo_auth_token', res.data.token);
        localStorage.setItem('raxwo_user_role', res.data.user.role);
        localStorage.setItem('raxwo_user_name', res.data.user.name);
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-auth-layout">
      <div className="auth-visual-side">
        <div className="visual-overlay"></div>
        <div className="visual-content">
          <img src={logo} alt="RAXWO Logo" className="visual-logo" />
          <h1>Elevating Your <br /><span>Journey.</span></h1>
          <p>Premium Fleet Management & Rental Solutions for the modern era.</p>
        </div>
      </div>
      
      <div className="auth-form-side">
        <div className="auth-card">
          <button className="auth-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
          
          <div className="auth-header">
            <div className="role-pill">
              <ShieldCheck size={14} />
              <span>{roleContext} Access</span>
            </div>
            <h2>Welcome Back</h2>
            <p>Securely sign in to your {roleContext.toLowerCase()} portal.</p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            {error && <div className="auth-error-banner">{error}</div>}
            
            <div className="auth-input-group">
              <label>Username</label>
              <div className="auth-input-wrapper">
                <User size={20} className="auth-icon" />
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="Enter your username"
                  required 
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>Password</label>
              <div className="auth-input-wrapper">
                <Lock size={20} className="auth-icon" />
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="spinner" size={20} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to Portal</span>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>© 2026 RAXWO Rent A Car. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
