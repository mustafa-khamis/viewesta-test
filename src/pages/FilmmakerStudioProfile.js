/**
 * Filmmaker Studio Profile — full profile page.
 * Backend: PUT /auth/profile (same as viewer) for name updates.
 * Fields: first_name, last_name, bio, studio_name, avatar (passed through
 *         and stored locally; backend accepts first_name + last_name confirmed).
 */
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaCamera, FaSave, FaTimes, FaEdit,
  FaFilm, FaUsers, FaDollarSign, FaCheckCircle,
  FaUpload, FaChartLine, FaSignOutAlt,
  FaQuestionCircle, FaEnvelope,
} from 'react-icons/fa';
import './FilmmakerStudioProfile.css';

const DEFAULT_AVATAR =
  'https://ui-avatars.com/api/?background=D06224&color=fff&size=128&name=';

export default function FilmmakerStudioProfile() {
  const { user, updateProfile, changePassword, logout, loading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  /* ── edit state ── */
  const [isEditing, setIsEditing]       = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName]   = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');


  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState('');

  /* ── derived values ── */
  const displayName =
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    'Filmmaker';

  const avatarSrc =
    user?.avatar ||
    `${DEFAULT_AVATAR}${encodeURIComponent(displayName)}`;

  const totalMovies    = user?.myMovies?.length ?? user?.myMovieIds?.length ?? 0;
  const followersCount = user?.followersCount ?? user?.followers_count ?? 0;
  const totalEarnings  = Number(user?.earnings?.total ?? user?.total_earnings ?? 0);
  const earningsCurrency = user?.earnings?.currency ?? 'USD';

  /* ── handlers ── */
  const handleEditStart = () => {
    setEditFirstName(user?.first_name || '');
    setEditLastName(user?.last_name || '');
    setEditAvatarUrl(user?.avatar || '');
    setAvatarPreview(user?.avatar || '');
    setCurrentPassword('');
    setNewPassword('');
    setSaveSuccess(false);
    setSaveError('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result);
      setEditAvatarUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      setSaveError('First name and last name cannot be empty.');
      return;
    }
    setSaving(true);
    setSaveError('');

    const updates = {
      first_name: editFirstName.trim(),
      last_name:  editLastName.trim(),
      avatar:     editAvatarUrl || avatarSrc,
    };

    const result = await updateProfile(updates);

    let pwSuccess = true;
    if (currentPassword && newPassword) {
      const pwResult = await changePassword(currentPassword, newPassword);
      if (!pwResult.success) {
        pwSuccess = false;
        setSaveError(pwResult.error || 'Failed to change password.');
      }
    }

    setSaving(false);

    if (result.success && pwSuccess) {
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3500);
    } else if (!result.success) {
      setSaveError(result.error || 'Failed to save changes.');
    }
  };

  const handleLogout = () => {
    logout();
    setTimeout(() => navigate('/login'), 0);
  };

  /* ── loading skeleton ── */
  if (loading) {
    return (
      <div className="fsp-page">
        <div className="fsp-skeleton">
          <div className="fsp-skel-avatar" />
          <div className="fsp-skel-line fsp-skel-line--wide" />
          <div className="fsp-skel-line" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fsp-page fsp-unauthenticated">
        <FaFilm className="fsp-unauth-icon" />
        <h2>Please log in to access your studio profile.</h2>
        <Link to="/login" className="fsp-btn fsp-btn--primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="fsp-page">

      {/* ── Success Banner ── */}
      {saveSuccess && (
        <div className="fsp-banner fsp-banner--success">
          <FaCheckCircle /> Profile updated successfully!
        </div>
      )}

      {/* ── Profile Header ── */}
      <div className="fsp-header">
        <div className="fsp-avatar-wrap">
          <img
            src={isEditing ? (avatarPreview || avatarSrc) : avatarSrc}
            alt={displayName}
            className="fsp-avatar-img"
            onError={(e) => {
              e.target.src = `${DEFAULT_AVATAR}${encodeURIComponent(displayName)}`;
            }}
          />
          {isEditing && (
            <button
              className="fsp-camera-btn"
              onClick={() => fileRef.current?.click()}
              title="Upload photo"
              type="button"
            >
              <FaCamera />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {/* Filmmaker badge */}
          <span className="fsp-role-badge">Filmmaker</span>
        </div>

        <div className="fsp-info">
          {isEditing ? (
            /* ── Edit Form ── */
            <div className="fsp-edit-form">
              <div className="fsp-edit-row">
                <div className="fsp-edit-field">
                  <label>First Name</label>
                  <input
                    className="fsp-input"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="fsp-edit-field">
                  <label>Last Name</label>
                  <input
                    className="fsp-input"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="fsp-edit-field">
                <label>Avatar URL</label>
                <input
                  className="fsp-input"
                  value={editAvatarUrl}
                  onChange={(e) => {
                    setEditAvatarUrl(e.target.value);
                    setAvatarPreview(e.target.value);
                  }}
                  placeholder="https://…"
                />
              </div>

              <div className="fsp-edit-row">
                <div className="fsp-edit-field">
                  <label>Current Password</label>
                  <input
                    type="password"
                    className="fsp-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="fsp-edit-field">
                  <label>New Password</label>
                  <input
                    type="password"
                    className="fsp-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              </div>

              {saveError && <p className="fsp-error">{saveError}</p>}

              <div className="fsp-edit-actions">
                <button
                  className="fsp-btn fsp-btn--primary"
                  onClick={handleSave}
                  disabled={saving}
                  type="button"
                >
                  <FaSave /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  className="fsp-btn fsp-btn--outline"
                  onClick={handleCancel}
                  type="button"
                >
                  <FaTimes /> Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── Display Mode ── */
            <>
              <h1 className="fsp-name">{displayName}</h1>
              {(user?.studio_name || user?.studioName) && (
                <p className="fsp-studio">{user.studio_name || user.studioName}</p>
              )}
              <p className="fsp-email">{user.email}</p>
              {user?.bio && <p className="fsp-bio">{user.bio}</p>}

              <button
                className="fsp-btn fsp-btn--outline fsp-edit-btn"
                onClick={handleEditStart}
                type="button"
              >
                <FaEdit /> Edit Profile
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="fsp-stats-bar">
        <div className="fsp-stat">
          <span className="fsp-stat-value">{totalMovies}</span>
          <span className="fsp-stat-label">Total Content</span>
        </div>
        <div className="fsp-stat-divider" />
        <div className="fsp-stat">
          <span className="fsp-stat-value" style={{ color: '#22c55e' }}>
            {earningsCurrency} {totalEarnings.toFixed(0)}
          </span>
          <span className="fsp-stat-label">Earnings</span>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="fsp-section">
        <h2 className="fsp-section-title">Studio</h2>
        <div className="fsp-actions-grid">
          <Link to="/filmmaker-studio" className="fsp-action-card">
            <FaChartLine className="fsp-action-icon" />
            <span>Dashboard</span>
          </Link>
          <Link to="/filmmaker-studio/movies" className="fsp-action-card">
            <FaFilm className="fsp-action-icon" />
            <span>My Studio</span>
          </Link>
          <Link to="/filmmaker-studio/upload" className="fsp-action-card fsp-action-card--highlight">
            <FaUpload className="fsp-action-icon" />
            <span>Upload</span>
          </Link>
          <Link to="/filmmaker-studio/earnings" className="fsp-action-card">
            <FaDollarSign className="fsp-action-icon" />
            <span>Earnings</span>
          </Link>
        </div>
      </div>

      {/* ── Account Links ── */}
      <div className="fsp-section">
        <h2 className="fsp-section-title">Account</h2>
        <ul className="fsp-menu-list">
          <li>
            <Link to="/help" className="fsp-menu-item">
              <FaQuestionCircle /> Help Center
            </Link>
          </li>
          <li>
            <Link to="/contact" className="fsp-menu-item">
              <FaEnvelope /> Contact Us
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="fsp-menu-item fsp-logout-btn"
              onClick={handleLogout}
            >
              <FaSignOutAlt /> Log Out
            </button>
          </li>
        </ul>
      </div>

      {/* ── Footer ── */}
      <p className="fsp-footer">Viewesta · Filmmaker Studio</p>
    </div>
  );
}
