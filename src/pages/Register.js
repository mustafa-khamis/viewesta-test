import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaGoogle, FaFacebook, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { generateUsername } from '../utils/usernameUtils';
import './Register.css';

// here I added the firsname and lastname instead of name to be applicable with the backend 
const Register = () => {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: '',
    user_type: 'viewer',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, socialLogin } = useAuth();
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Automatically generate a unique username from the email
      const generatedUsername = generateUsername(formData.email);
      console.log('Registering with generated username:', generatedUsername);

      // FIX: send correct backend payload including username
      const result = await register({
        first_name: formData.firstname,
        last_name: formData.lastname,
        email: formData.email,
        username: generatedUsername,
        password: formData.password,
        user_type: formData.user_type || 'viewer',
      });

      if (result.success) {
        const isFilmmaker =
          (result.user?.role || result.user?.user_type || '').toLowerCase() === 'filmmaker';

        navigate(isFilmmaker ? '/filmmaker-studio' : '/');
      } else {
        console.error('Registration failed:', result.error);
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    setError('');
    try {
      const result = await socialLogin(provider);
      if (result.success) {
        const isFilmmaker =
          (result.user?.role || result.user?.user_type || '').toLowerCase() === 'filmmaker';

        navigate(isFilmmaker ? '/filmmaker-studio' : '/');
      } else {
        setError(result.error || 'Social login failed');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-brand">
        <div className="register-brand-content">
          <h1 className="register-brand-title">Viewesta</h1>
          <p className="register-brand-tagline">
            African cinema on demand. Join as a viewer or filmmaker — stream, subscribe, or upload.
          </p>
        </div>
      </div>

      <div className="register-form-section">
        <div className="register-form-wrap">
          <div className="register-header">
            <h1 className="register-title">Create account</h1>
            <p className="register-subtitle">Sign up to start streaming or uploading</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <div className='name-input'>
                <div>
                  <label htmlFor='firstname' className='form-label'>First name</label>
                  <input
                    type="text"
                    id="firstname"
                    name="firstname"
                    value={formData.firstname}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Your first name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="lastname" className="form-label">Last name</label>
                  <input
                    type="text"
                    id="lastname"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Your last name"
                    required
                  />
                </div>
              </div>
            </div>

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
              <label className="form-label">I am a</label>
              <div className="role-options">
                <label className="role-option">
                  <input
                    type="radio"
                    name="user_type"
                    value="viewer"
                    checked={formData.user_type === 'viewer'}
                    onChange={handleChange}
                  />
                  <span>Viewer</span>
                </label>
                <label className="role-option">
                  <input
                    type="radio"
                    name="user_type"
                    value="filmmaker"
                    checked={formData.user_type === 'filmmaker'}
                    onChange={handleChange}
                  />
                  <span>Filmmaker</span>
                </label>
              </div>

              <p className="form-hint">
                Viewers watch and subscribe. Filmmakers upload and earn.
              </p>
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

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
              <div className="password-input">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>
                  I agree to the <Link to="/terms" className="link">Terms</Link> and{' '}
                  <Link to="/privacy" className="link">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="divider">
            <span>Or continue with</span>
          </div>

          <div className="social-login">
            <button
              type="button"
              className="social-button google"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
            >
              <FaGoogle />
              Google
            </button>
            <button
              type="button"
              className="social-button facebook"
              onClick={() => handleSocialLogin('facebook')}
              disabled={loading}
            >
              <FaFacebook />
              Facebook
            </button>
          </div>

          <div className="register-footer">
            <p>
              Already have an account? <Link to="/login" className="link">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
