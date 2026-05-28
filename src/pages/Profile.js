import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMovies } from '../context/MovieContext';
import {
  FaWallet,
  FaCog,
  FaHeart,
  FaHistory,
  FaStar,
  FaEdit,
  FaCamera,
  FaSave,
  FaTimes,
  FaUser,
  FaCheckCircle,
  FaBell,
  FaBellSlash,
} from 'react-icons/fa';
import MovieCard from '../components/MovieCard';
import './Profile.css';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=D06224&color=fff&size=128&name=';

const Profile = () => {
  const { user, updateProfile, changePassword, loading, uploadAvatar } = useAuth();
  const { watchlist, getMovieById } = useMovies();

  const [isEditing, setIsEditing] = useState(false);

  // backend style split fields
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');

  // const [editBio, setEditBio] = useState(''); // BIO DISABLED (backend doesn't support it)

  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [qualityPref, setQualityPref] = useState('');
  const [notifPref, setNotifPref] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const fileRef = useRef(null);

  const watchlistMovies = watchlist.map((id) => getMovieById(id)).filter(Boolean);
  const watchHistory = (user?.watchHistory || []).slice(0, 6);
  const historyMovies = watchHistory.map((h) => getMovieById(h.movieId)).filter(Boolean);

  const avatarSrc =
    user?.avatar ||
    `${DEFAULT_AVATAR}${encodeURIComponent(user?.first_name || 'U')}`;

  const handleEditStart = () => {
    setEditFirstName(user?.first_name || '');
    setEditLastName(user?.last_name || '');

    // setEditBio(user?.bio || ''); // BIO DISABLED

    setEditAvatarUrl(user?.avatar || '');
    setAvatarPreview(user?.avatar || '');
    setCurrentPassword('');
    setNewPassword('');
    setQualityPref(user?.preferences?.quality || '1080p');
    setNotifPref(user?.preferences?.notifications ?? true);
    setSaveSuccess(false);
    setSaveError('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError('');
    setAvatarFile(null);
  };

  const handleAvatarUrlChange = (e) => {
    setEditAvatarUrl(e.target.value);
    setAvatarPreview(e.target.value);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result);
      setEditAvatarUrl('');
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
    
    let avatarSuccess = true;
    let currentAvatar = editAvatarUrl || avatarSrc;

    if (avatarFile) {
      const avatarRes = await uploadAvatar(avatarFile);
      if (avatarRes.success) {
        currentAvatar = avatarRes.user?.avatar || currentAvatar;
      } else {
        avatarSuccess = false;
        setSaveError(avatarRes.error || 'Failed to upload avatar.');
      }
    }

    const updates = {
      first_name: editFirstName.trim(),
      last_name: editLastName.trim(),
      avatar: currentAvatar,
      preferences: { quality: qualityPref, notifications: notifPref },
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
    if (result.success && pwSuccess && avatarSuccess) {
      setSaveSuccess(true);
      setIsEditing(false);
      setAvatarFile(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else if (!result.success) {
      setSaveError(result.error || 'Failed to save changes.');
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container layout-container">
          <div className="profile-header skeleton">
             <div className="skeleton-avatar" style={{width: 128, height: 128, borderRadius: '50%', backgroundColor: '#222'}}></div>
             <div className="skeleton-info" style={{marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10}}>
                <div style={{width: 200, height: 32, backgroundColor: '#222'}}></div>
                <div style={{width: 150, height: 20, backgroundColor: '#222'}}></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-not-found">
        <div className="profile-nf-icon"><FaUser /></div>
        <h2>Please log in to view your profile</h2>
        <p>Sign in to access your wishlist, wallet, and settings.</p>
        <Link to="/login" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container layout-container">

        {/* ── Success Banner ── */}
        {saveSuccess && (
          <div className="profile-success-banner">
            <FaCheckCircle /> Profile updated successfully!
          </div>
        )}

        {/* ── Profile Header ── */}
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <img
              src={isEditing ? (avatarPreview || avatarSrc) : avatarSrc}
              alt={user.first_name}
              className="profile-avatar-img"
              onError={(e) => {
                e.target.src =
                  `${DEFAULT_AVATAR}${encodeURIComponent(user.first_name || 'U')}`;
              }}
            />
            {isEditing && (
              <button
                className="avatar-camera-btn"
                onClick={() => fileRef.current?.click()}
                title="Upload photo"
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
          </div>

          <div className="profile-info">
            {isEditing ? (
              <div className="profile-edit-form">
                <div className="edit-row">
                  <div className="edit-field">
                    <label>First Name</label>
                    <input
                      className="profile-edit-input"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                    />
                  </div>
                  <div className="edit-field">
                    <label>Last Name</label>
                    <input
                      className="profile-edit-input"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="edit-field">
                  <label>Username (Permanent)</label>
                  <input
                    className="profile-edit-input"
                    value={`@${user.username}`}
                    disabled
                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                  />
                </div>





                <div className="edit-row">
                  <div className="edit-field">
                    <label>Current Password</label>
                    <input
                      type="password"
                      className="profile-edit-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                  <div className="edit-field">
                    <label>New Password</label>
                    <input
                      type="password"
                      className="profile-edit-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                </div>

                {/* BIO FIELD (DISABLED - BACKEND NOT SUPPORTED)
                <div className="edit-field">
                  <label>Bio</label>
                  <textarea
                    className="profile-edit-input profile-edit-textarea"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us a little about yourself…"
                    rows={2}
                  />
                </div>
                */}
                {saveError && <p className="profile-save-error">{saveError}</p>}
                <div className="edit-actions">
                  <button
                    className="btn btn-primary edit-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <FaSave /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>

                  <button
                    className="btn btn-outline edit-cancel-btn"
                    onClick={handleCancel}
                  >
                    <FaTimes /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="profile-name">
                  {user.first_name} {user.last_name}
                </h1>

                <p className="profile-username">@{user.username}</p>

                <p className="profile-email">{user.email}</p>

                {/* <p className="profile-bio">{user.bio}</p> */}

                <button
                  className="btn btn-outline edit-profile-btn"
                  onClick={handleEditStart}
                >
                  <FaEdit /> Edit Profile
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="profile-stats-bar">
          <div className="pstat">
            <span className="pstat-value">{watchlistMovies.length}</span>
            <span className="pstat-label">Wishlist</span>
          </div>
          <div className="pstat-divider" />
          <div className="pstat">
            <span className="pstat-value">{historyMovies.length}</span>
            <span className="pstat-label">Watched</span>
          </div>
          <div className="pstat-divider" />
          <div className="pstat">
            <span className="pstat-value" style={{ color: '#22c55e' }}>
              ${Number(user.wallet?.balance ?? 0).toFixed(0)}
            </span>
            <span className="pstat-label">Balance</span>
          </div>
        </div>

        <div className="profile-content">

          {/* ── Wallet ── */}
          <div className="profile-section">
            <h2 className="section-title"><FaWallet /> Wallet</h2>
            <div className="wallet-info">
              <div className="balance">
                <span className="amount" style={{ color: '#22c55e' }}>
                  ${Number(user.wallet?.balance ?? 0).toFixed(2)}
                </span>
                <span className="currency">{user.wallet?.currency || 'USD'}</span>
              </div>
              <Link to="/wallet" className="btn btn-primary">Top Up</Link>
            </div>
          </div>

          {/* ── Subscription ── */}
          <div className="profile-section">
            <h2 className="section-title"><FaStar /> Subscription</h2>
            <div className="subscription-info">
              <div className="subscription-status">
                <span className={`status ${user.subscription?.active ? 'active' : 'inactive'}`}>
                  {user.subscription?.active ? 'Active' : 'Inactive'}
                </span>
                <span className="type">{user.subscription?.type || 'Free'}</span>
              </div>
              {user.subscription?.active && user.subscription?.expiresAt && (
                <p className="expires">
                  Expires: {new Date(user.subscription.expiresAt).toLocaleDateString()}
                </p>
              )}
              {!user.subscription?.active && (
                <p className="expires">Upgrade to enjoy unlimited streaming.</p>
              )}
              <Link to="/subscription" className="btn btn-outline btn-small">Manage Plan</Link>
            </div>
          </div>

          {/* ── Wishlist ── */}
          <div className="profile-section">
            <h2 className="section-title"><FaHeart /> Wishlist</h2>
            <p className="section-desc">Titles you saved to watch later.</p>
            {watchlistMovies.length > 0 ? (
              <div className="profile-movie-row">
                {watchlistMovies.slice(0, 6).map((m) => (
                  <MovieCard key={m.id} movie={m} showWatchlist />
                ))}
              </div>
            ) : (
              <div className="profile-empty-state">
                <FaHeart className="empty-icon" />
                <p>Your wishlist is empty. Start adding titles!</p>
                <Link to="/movies" className="btn btn-outline btn-small">Browse Movies</Link>
              </div>
            )}
            {watchlistMovies.length > 0 && (
              <Link to="/watchlist" className="btn btn-outline">View full wishlist</Link>
            )}
          </div>

          {/* ── Watch History ── */}
          <div className="profile-section">
            <h2 className="section-title"><FaHistory /> Watch History</h2>
            <p className="section-desc">Recently watched titles.</p>
            {historyMovies.length > 0 ? (
              <div className="profile-movie-row">
                {historyMovies.map((m) => (
                  <MovieCard key={m.id} movie={m} showWatchlist={false} />
                ))}
              </div>
            ) : (
              <div className="profile-empty-state">
                <FaHistory className="empty-icon" />
                <p>No watch history yet. Start watching!</p>
                <Link to="/movies" className="btn btn-outline btn-small">Explore</Link>
              </div>
            )}
          </div>

          {/* ── Account Settings ── */}
          <div className="profile-section">
            <h2 className="section-title"><FaCog /> Account Settings</h2>
            <div className="settings-grid">
              <div className="setting-item">
                <label>Preferred Quality</label>
                <select
                  value={isEditing ? qualityPref : (user.preferences?.quality || '1080p')}
                  onChange={(e) => setQualityPref(e.target.value)}
                  disabled={!isEditing}
                >
                  <option value="480p">480p — SD</option>
                  <option value="720p">720p — HD</option>
                  <option value="1080p">1080p — Full HD</option>
                  <option value="4K">4K — Ultra HD</option>
                </select>
              </div>
              <div className="setting-item notif-item">
                <label>Push Notifications</label>
                <button
                  className={`notif-toggle ${(isEditing ? notifPref : (user.preferences?.notifications ?? true)) ? 'notif-on' : 'notif-off'}`}
                  onClick={() => isEditing && setNotifPref((v) => !v)}
                  type="button"
                >
                  {(isEditing ? notifPref : (user.preferences?.notifications ?? true))
                    ? <><FaBell /> Enabled</>
                    : <><FaBellSlash /> Disabled</>}
                </button>
                {!isEditing && <p className="setting-hint">Click Edit Profile to change</p>}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
