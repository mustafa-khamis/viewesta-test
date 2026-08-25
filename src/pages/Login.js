import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        const isFilmmaker = (result.user?.role || result.user?.user_type || '').toLowerCase() === 'filmmaker';
        navigate(isFilmmaker ? '/filmmaker-studio' : '/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-content">
          <h1 className="login-brand-title">Viewesta</h1>
          <p className="login-brand-tagline">
            African cinema on demand. Stream the best of Nollywood and beyond — subscribe or pay per view.
          </p>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-wrap">
          <div className="login-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to your account to continue</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading" aria-hidden />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>


          <div className="login-footer">
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="link">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
