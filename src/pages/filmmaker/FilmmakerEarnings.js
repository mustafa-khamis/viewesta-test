import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getFilmmakerMovies } from '../../services/movieService';
import { getContract, getPayoutBalance, getPayouts } from '../../services/earningsService';
import { FaArrowLeft } from 'react-icons/fa';
// Reuse existing styles where possible. We'll rely on the existing layout.
import '../EarningsDetail.css'; 

function fmt(amount, currency = 'USD') {
  if (amount === undefined || amount === null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

export default function FilmmakerEarnings() {
  const { user } = useAuth();

  const [movies, setMovies] = useState([]);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState(null);
  const [payouts, setPayouts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [moviesData, contractData, balanceData, payoutsData] = await Promise.all([
        getFilmmakerMovies(),
        getContract(),
        getPayoutBalance(),
        getPayouts(),
      ]);

      setMovies(moviesData || []);
      setContract(contractData);
      setBalance(balanceData);
      setPayouts(payoutsData || []);
    } catch (err) {
      setError('Unable to load your earnings data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Extract variables
  const currency = contract?.currency || balance?.currency || user?.wallet?.currency || 'USD';

  // Revenue Split Calculation
  const hasSplit = contract?.filmmaker_split !== undefined || contract?.split_percentage !== undefined;
  const filmmakerSplitPct = contract?.filmmaker_split || contract?.split_percentage; // e.g. 70
  const platformSplitPct = filmmakerSplitPct ? (100 - filmmakerSplitPct) : null;

  // Earnings/Balance
  const totalEarnings = balance?.total_earnings;
  const totalRevenue = balance?.total_revenue; // If backend tracks gross revenue

  const totalViews = movies.reduce((acc, m) => {
    const v = Number(m?.raw?.view_count ?? m?.raw?.views ?? m?.raw?.total_views ?? 0);
    return acc + v;
  }, 0);

  // Minimum Guarantee
  const mgAmount = contract?.minimum_guarantee;
  const hasMG = mgAmount !== undefined && mgAmount !== null;
  const mgRecouped = balance?.mg_recouped; // Boolean or amount
  const mgRemaining = balance?.mg_remaining;

  return (
    <div className="earnings-page layout-container">
      {/* Breadcrumb */}
      <div className="earnings-breadcrumb">
        <Link to="/filmmaker-studio" className="btn btn-ghost btn-small">
          <FaArrowLeft style={{ marginRight: 8 }} /> Dashboard
        </Link>
      </div>

      <div className="earnings-header">
        <h1>My Earnings</h1>
        <p className="earnings-subtitle">Revenue from your published content on Viewesta</p>
      </div>

      {loading ? (
        <div className="earnings-loading">
          {[1, 2, 3].map((i) => <div key={i} className="earnings-skeleton" />)}
        </div>
      ) : error ? (
        <div className="earnings-error">
          <p>{error}</p>
          <button className="btn btn-primary btn-small" onClick={fetchData}>Try Again</button>
        </div>
      ) : (
        <>
          {/* Revenue split card */}
          <div className="earnings-split-card" style={{ marginBottom: 24 }}>
            <div className="earnings-split-label">Revenue Split</div>
            {hasSplit ? (
              <>
                <div className="earnings-split-bar">
                  <div className="earnings-split-filmmaker" style={{ width: `${filmmakerSplitPct}%` }}>
                    <span>You — {filmmakerSplitPct}%</span>
                  </div>
                  <div className="earnings-split-platform" style={{ width: `${platformSplitPct}%` }}>
                    <span>Platform — {platformSplitPct}%</span>
                  </div>
                </div>
                <p className="earnings-split-note">
                  Based on your contract, your revenue split is {filmmakerSplitPct}% / {platformSplitPct}%.
                </p>
              </>
            ) : (
              <p style={{ color: '#888', marginTop: 12 }}>Not available from backend yet.</p>
            )}
          </div>

          {/* Minimum Guarantee Card */}
          <div className="earnings-split-card" style={{ marginBottom: 32 }}>
             <div className="earnings-split-label">Minimum Guarantee</div>
             {hasMG ? (
                <div style={{ marginTop: 12 }}>
                  <p><strong>Total Guarantee:</strong> {fmt(mgAmount, currency)}</p>
                  {mgRemaining !== undefined && <p><strong>Remaining:</strong> {fmt(mgRemaining, currency)}</p>}
                  <p><strong>Status:</strong> {mgRecouped ? 'Recouped' : 'Remaining'}</p>
                </div>
             ) : (
                <p style={{ color: '#888', marginTop: 12 }}>Not available from backend yet.</p>
             )}
          </div>

          {/* Summary cards */}
          <div className="earnings-summary-grid">
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Total Earnings</div>
              <div className="earnings-card-value earnings-card-value--highlight">
                {totalEarnings !== undefined ? fmt(totalEarnings, currency) : <span style={{fontSize: 16, color: '#888'}}>Not available from backend yet</span>}
              </div>
            </div>
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Gross Revenue</div>
              <div className="earnings-card-value">
                {totalRevenue !== undefined ? fmt(totalRevenue, currency) : <span style={{fontSize: 16, color: '#888'}}>Not available</span>}
              </div>
            </div>
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Total Views</div>
              <div className="earnings-card-value">{totalViews.toLocaleString()}</div>
              <div className="earnings-card-sub">across {movies.length} film{movies.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="earnings-tabs">
            {['overview', 'per-film', 'monthly'].map((tab) => (
              <button
                key={tab}
                className={`earnings-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' ? 'Overview' : tab === 'per-film' ? 'Per Film' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* Per-film tab */}
          {activeTab === 'per-film' && (
            <div className="earnings-films-table">
              <div className="earnings-table-header">
                <span>Film</span>
                <span>Views</span>
                <span>Gross Revenue</span>
                <span>Your Earnings</span>
              </div>
              {movies.map((movie) => {
                const views = Number(movie?.raw?.view_count ?? movie?.raw?.views ?? movie?.raw?.total_views ?? 0);
                const backendGross = movie?.raw?.gross_revenue;
                const backendEarnings = movie?.raw?.filmmaker_earnings;
                
                return (
                  <div key={movie.id} className="earnings-table-row">
                    <div className="earnings-film-cell">
                      <img src={movie.poster} alt={movie.title} className="earnings-film-poster" />
                      <div>
                        <div className="earnings-film-title">{movie.title}</div>
                        <div className="earnings-film-status">{movie.status || movie.approval_status || 'pending'}</div>
                      </div>
                    </div>
                    <div className="earnings-table-cell">{views.toLocaleString()}</div>
                    <div className="earnings-table-cell">
                      {backendGross !== undefined ? fmt(backendGross, currency) : <span style={{color: '#888', fontSize: 12}}>Not available</span>}
                    </div>
                    <div className="earnings-table-cell earnings-amount-highlight">
                      {backendEarnings !== undefined ? fmt(backendEarnings, currency) : <span style={{color: '#888', fontSize: 12}}>Not available from backend yet</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monthly tab */}
          {activeTab === 'monthly' && (
            <div className="earnings-monthly">
              <h3 className="earnings-section-title">Monthly Breakdown</h3>
              {payouts.length > 0 ? (
                payouts.map((payout, idx) => (
                  <div key={idx} className="earnings-month-row">
                    <div className="earnings-month-label">{payout.month || payout.period || new Date(payout.created_at).toLocaleString('default', { month: 'short', year: 'numeric' })}</div>
                    <div className="earnings-month-amount">
                      {fmt(payout.amount || payout.earnings, currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="earnings-monthly-note" style={{ color: '#888' }}>
                  Not available from backend yet.
                  {/* TODO: Integrate historical monthly earnings data when backend is ready */}
                </div>
              )}
            </div>
          )}

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="earnings-overview">
              <div className="earnings-chart-card">
                <h3 className="earnings-section-title">Recent Activity</h3>
                <p style={{ color: '#888' }}>Not available from backend yet. (Charts will appear when historical payout data is available)</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
