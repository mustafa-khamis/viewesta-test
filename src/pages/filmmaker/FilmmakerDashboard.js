import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMovies } from '../../context/MovieContext';
import { useLocale } from '../../context/LocaleContext';
import { FaFilm, FaDollarSign, FaPlus, FaFileContract, FaCheckCircle, FaExclamationCircle, FaTimesCircle } from 'react-icons/fa';
import './FilmmakerDashboard.css';

/**
 * Filmmaker dashboard — integrated with translations and updated states.
 */
function FilmmakerDashboard() {
  const { user } = useAuth();
  const { getMovieById } = useMovies();
  const { t } = useLocale();

  const myMovieIds = user?.myMovieIds || user?.myMovies || [];
  const myMovies = myMovieIds.map((id) => getMovieById(id)).filter(Boolean);
  const earnings = user?.earnings || { total: 0, pending: 0, currency: 'USD' };

  // Mock Contract Data — from backend it should map to these 3 statuses
  const contract = {
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-01-01'),
    status: 'valid', // valid, terminated, expired
  };

  const getContractStatus = () => {
    switch (contract.status) {
      case 'expired':
        return { label: t('contractExpired'), color: 'red', icon: <FaExclamationCircle /> };
      case 'terminated':
        return { label: t('contractTerminated'), color: 'red', icon: <FaTimesCircle /> };
      case 'valid':
      default:
        return { label: t('contractValid'), color: 'green', icon: <FaCheckCircle /> };
    }
  };

  const status = getContractStatus();

  return (
    <div className="filmmaker-dashboard page-container">
      <div className="filmmaker-dashboard-header">
        <h1>{t('dashboard')}</h1>
        <p className="subtitle">Welcome back, {user?.name || 'Filmmaker'}</p>
      </div>

      {/* Contract Status Section */}
      <div className="contract-status-card" style={{ borderLeft: `4px solid ${status.color === 'green' ? '#22c55e' : '#ef4444'}` }}>
        <div className="contract-header">
          <FaFileContract className="contract-icon" />
          <h3>{t('contractAgreement')}</h3>
          <span className={`contract-badge badge-${status.color}`}>
            {status.icon} {status.label}
          </span>
        </div>
        <div className="contract-dates">
          <div className="date-item">
            <span className="date-label">{t('contractStartDate')}</span>
            <span className="date-value">{contract.startDate.toLocaleDateString()}</span>
          </div>
          <div className="date-item">
            <span className="date-label">{t('contractEndDate')}</span>
            <span className="date-value">{contract.endDate.toLocaleDateString()}</span>
          </div>
          <div className="date-item">
             <span className="date-label">{t('contractDuration')}</span>
             <span className="date-value">1 Year</span>
          </div>
        </div>
      </div>

      <div className="filmmaker-stats">
        <div className="stat-card">
          <FaFilm className="stat-icon" />
          <div>
            <span className="stat-value">{myMovies.length}</span>
            <span className="stat-label">{t('myStudio')}</span>
          </div>
          <Link to="/filmmaker-studio/movies" className="stat-link">{t('seeAll')}</Link>
        </div>
        <div className="stat-card">
          <FaDollarSign className="stat-icon" />
          <div>
            <span className="stat-value">{earnings.currency} {Number(earnings.total).toFixed(2)}</span>
            <span className="stat-label">{t('totalEarnings')}</span>
          </div>
          <Link to="/filmmaker-studio/earnings" className="stat-link">{t('earningsDetail')}</Link>
        </div>
      </div>

      <div className="filmmaker-actions">
        <Link to="/filmmaker-studio/upload" className="action-card action-upload">
          <FaPlus />
          <span>{t('uploadNewMovie')}</span>
        </Link>
      </div>
    </div>
  );
}

export default FilmmakerDashboard;
