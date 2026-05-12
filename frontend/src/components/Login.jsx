import React, { useState } from 'react';
import api from '../services/api';
import { ArrowLeft, User, Lock, Loader2, ShieldCheck } from 'lucide-react';
import logo from '../logo.png';
import './Login.css';

const Login = ({ onLoginSuccess, roleContext, onBack, appSettings }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { username, password });
        if (res.data && res.data.token) {
          localStorage.setItem('raxwo_auth_token', res.data.token);
          localStorage.setItem('raxwo_user_role', res.data.user.role);
          localStorage.setItem('raxwo_user_name', res.data.user.name);
          onLoginSuccess();
        }
      } else {
        await api.post('/auth/register', { username, password, name, role: roleContext });
        setSuccess('Account created successfully! You can now sign in.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-auth-layout">
      <div className="auth-visual-side" style={{ 
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.5)), url('https://images.unsplash.com/photo-1572916118970-fb5c8a1cb3d1?q=80&w=1974&auto=format&fit=crop')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        <div className="visual-overlay" style={{ display: 'none' }}></div>
        <div className="visual-content">
          <img src={appSettings?.logo || logo} alt={appSettings?.companyName || 'Logo'} className="visual-logo" />
          <h1>{appSettings?.companyName || 'Professional'} <br /><span>Inventory.</span></h1>
          <p>Professional Tool Rental & Management Solutions for modern industries.</p>
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
            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p>{isLogin ? `Securely sign in to your ${roleContext.toLowerCase()} portal.` : `Join the ${appSettings?.companyName || 'RAXWO'} ${roleContext.toLowerCase()} team.`}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error-banner">{error}</div>}
            {success && <div className="auth-success-banner">{success}</div>}
            
            {!isLogin && (
              <div className="auth-input-group">
                <label>Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={20} className="auth-icon" />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Enter your full name"
                    required 
                  />
                </div>
              </div>
            )}

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
                  <span>{isLogin ? 'Authenticating...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign In to Portal' : 'Register Account'}</span>
              )}
            </button>
          </form>

          <div className="auth-mode-toggle" style={{ marginTop: '24px', textAlign: 'center' }}>
             <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, marginLeft: '8px', cursor: 'pointer' }}
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
             </p>
          </div>

          <div className="auth-footer">
            <p>© 2026 {appSettings?.companyName || 'RAXWO Tool Rentals'}. Professional Equipment Ecosystem.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
