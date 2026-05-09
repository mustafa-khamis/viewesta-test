import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import './EditProfile.css';

export default function EditProfile() {
  const { user, updateProfile } = useAuth();
  const { t } = useLocale();
  const [formData, setFormData] = useState({
    name: user?.name || '',
  });
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await updateProfile(formData);
    setSaved(result?.success ?? false);
  };

  if (!user) {
    return (
      <div className="edit-profile-page layout-container">
        <p>Please sign in to edit your profile.</p>
        <Link to="/login" className="btn btn-primary">{t('signIn')}</Link>
      </div>
    );
  }

  return (
    <div className="edit-profile-page layout-container">
      <h1>{t('editProfile')}</h1>
      {saved && <p className="edit-profile-success">Profile updated.</p>}
      <form onSubmit={handleSubmit} className="edit-profile-form">
        <div className="form-group">
          <label htmlFor="edit-name">{t('auth.name')}</label>
          <input
            id="edit-name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">Save changes</button>
      </form>
      <p className="edit-profile-back">
        <Link to="/profile">← Back to profile</Link>
      </p>
    </div>
  );
}
