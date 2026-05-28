import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { getFilmmakerMovies } from '../services/movieService';
import './EarningsDetail.css';

// ─── Revenue constants ─────────────────────────────────────────────────────────
const FILMMAKER_SHARE = 0.70;   // 70%
const PLATFORM_SHARE  = 0.30;   // 30%
const ESTIMATED_RATE_PER_VIEW = 0.025; // $0.025 per view — baseline estimate

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcFilmEarnings(movie) {
  const views = Number(movie?.raw?.view_count ?? movie?.raw?.views ?? movie?.raw?.total_views ?? 0);
  const baseRevenue = views * ESTIMATED_RATE_PER_VIEW;
  const filmmakerEarnings = baseRevenue * FILMMAKER_SHARE;
  const platformFee = baseRevenue * PLATFORM_SHARE;
  return { views, baseRevenue, filmmakerEarnings, platformFee };
}

function getMonthBuckets(movies, count = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      earnings: 0,
    });
  }

  for (const movie of movies) {
    const createdAt = movie?.raw?.created_at || movie?.raw?.published_at;
    if (!createdAt) continue;
    const mDate = new Date(createdAt);
    const mKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find((b) => b.key === mKey);
    if (bucket) {
      const { filmmakerEarnings } = calcFilmEarnings(movie);
      bucket.earnings += filmmakerEarnings;
    }
  }
  return buckets;
}

function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount || 0);
}

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, width = 200, height = 48, color = '#e50914' }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.earnings);
  const max = Math.max(...values, 0.01);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - (v / max) * height;
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function EarningsDetail() {
  const { user } = useAuth();
  const { t } = useLocale();

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'per-film' | 'monthly'
  const [currency] = useState(user?.wallet?.currency || 'USD');

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFilmmakerMovies();
      setMovies(data || []);
    } catch (err) {
      setError('Unable to load your earnings data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMovies(); }, [fetchMovies]);

  // ─── Computed totals ────────────────────────────────────────────────────────
  const filmBreakdown = movies.map((m) => ({
    movie: m,
    ...calcFilmEarnings(m),
  })).sort((a, b) => b.filmmakerEarnings - a.filmmakerEarnings);

  const totalRevenue = filmBreakdown.reduce((s, r) => s + r.baseRevenue, 0);
  const totalEarnings = filmBreakdown.reduce((s, r) => s + r.filmmakerEarnings, 0);
  const totalPlatformFee = filmBreakdown.reduce((s, r) => s + r.platformFee, 0);
  const totalViews = filmBreakdown.reduce((s, r) => s + r.views, 0);

  const monthlyBuckets = getMonthBuckets(movies, 6);
  const maxMonthEarnings = Math.max(...monthlyBuckets.map((b) => b.earnings), 0.01);

  return (
    <div className="earnings-page layout-container">
      {/* Breadcrumb */}
      <div className="earnings-breadcrumb">
        <Link to="/filmmaker-studio" className="btn btn-ghost btn-small">
          ← {t('dashboard') || 'Dashboard'}
        </Link>
      </div>

      <div className="earnings-header">
        <h1>{t('earningsDetail') || 'My Earnings'}</h1>
        <p className="earnings-subtitle">Revenue from your published content on Viewesta</p>
      </div>

      {/* Revenue split card */}
      <div className="earnings-split-card">
        <div className="earnings-split-label">Revenue Split</div>
        <div className="earnings-split-bar">
          <div className="earnings-split-filmmaker" style={{ width: '70%' }}>
            <span>You — 70%</span>
          </div>
          <div className="earnings-split-platform" style={{ width: '30%' }}>
            <span>Platform — 30%</span>
          </div>
        </div>
        <p className="earnings-split-note">
          For every $1 generated by your content, you receive <strong>$0.70</strong> and Viewesta retains <strong>$0.30</strong>.
        </p>
      </div>

      {loading ? (
        <div className="earnings-loading">
          {[1, 2, 3].map((i) => <div key={i} className="earnings-skeleton" />)}
        </div>
      ) : error ? (
        <div className="earnings-error">
          <p>{error}</p>
          <button className="btn btn-primary btn-small" onClick={fetchMovies}>Try Again</button>
        </div>
      ) : movies.length === 0 ? (
        <div className="earnings-empty">
          <div className="earnings-empty-icon">🎬</div>
          <p>You haven't published any content yet.</p>
          <Link to="/filmmaker-studio/upload" className="btn btn-primary">Upload Your First Film</Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="earnings-summary-grid">
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Total Earnings (Your 70%)</div>
              <div className="earnings-card-value earnings-card-value--highlight">{fmt(totalEarnings, currency)}</div>
              <div className="earnings-card-sub">of {fmt(totalRevenue, currency)} total revenue</div>
            </div>
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Total Views</div>
              <div className="earnings-card-value">{totalViews.toLocaleString()}</div>
              <div className="earnings-card-sub">across {movies.length} film{movies.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Platform Fee (30%)</div>
              <div className="earnings-card-value earnings-card-value--muted">{fmt(totalPlatformFee, currency)}</div>
              <div className="earnings-card-sub">retained by Viewesta</div>
            </div>
            <div className="earnings-summary-card">
              <div className="earnings-card-label">Est. Rate per View</div>
              <div className="earnings-card-value">{fmt(ESTIMATED_RATE_PER_VIEW * FILMMAKER_SHARE, currency)}</div>
              <div className="earnings-card-sub">filmmaker share</div>
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

          {/* Overview tab — sparkline + top films */}
          {activeTab === 'overview' && (
            <div className="earnings-overview">
              <div className="earnings-chart-card">
                <div className="earnings-chart-title">6-Month Earnings Trend</div>
                <div className="earnings-chart-labels">
                  {monthlyBuckets.map((b) => (
                    <span key={b.key} style={{ fontSize: 11, color: '#666', textAlign: 'center' }}>{b.label}</span>
                  ))}
                </div>
                <Sparkline data={monthlyBuckets} width={500} height={72} />
                <div className="earnings-chart-values">
                  {monthlyBuckets.map((b) => (
                    <span key={b.key} style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
                      {b.earnings > 0 ? fmt(b.earnings, currency) : '—'}
                    </span>
                  ))}
                </div>
              </div>

              {filmBreakdown.slice(0, 3).length > 0 && (
                <div>
                  <h3 className="earnings-section-title">Top Performing Films</h3>
                  {filmBreakdown.slice(0, 3).map(({ movie, views, filmmakerEarnings, baseRevenue }) => (
                    <div key={movie.id} className="earnings-film-row earnings-film-row--compact">
                      <img src={movie.poster} alt={movie.title} className="earnings-film-poster" />
                      <div className="earnings-film-info">
                        <div className="earnings-film-title">{movie.title}</div>
                        <div className="earnings-film-meta">{views.toLocaleString()} views · {fmt(baseRevenue, currency)} revenue</div>
                      </div>
                      <div className="earnings-film-amount">{fmt(filmmakerEarnings, currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-film tab */}
          {activeTab === 'per-film' && (
            <div className="earnings-films-table">
              <div className="earnings-table-header">
                <span>Film</span>
                <span>Views</span>
                <span>Revenue</span>
                <span>Your Earnings (70%)</span>
              </div>
              {filmBreakdown.map(({ movie, views, baseRevenue, filmmakerEarnings, platformFee }) => (
                <div key={movie.id} className="earnings-table-row">
                  <div className="earnings-film-cell">
                    <img src={movie.poster} alt={movie.title} className="earnings-film-poster" />
                    <div>
                      <div className="earnings-film-title">{movie.title}</div>
                      <div className="earnings-film-status">{movie.status || movie.approval_status || 'pending'}</div>
                    </div>
                  </div>
                  <div className="earnings-table-cell">{views.toLocaleString()}</div>
                  <div className="earnings-table-cell">{fmt(baseRevenue, currency)}</div>
                  <div className="earnings-table-cell earnings-amount-highlight">
                    {fmt(filmmakerEarnings, currency)}
                    <div className="earnings-table-sub">platform: {fmt(platformFee, currency)}</div>
                  </div>
                </div>
              ))}
              <div className="earnings-table-total">
                <span>Total</span>
                <span>{totalViews.toLocaleString()}</span>
                <span>{fmt(totalRevenue, currency)}</span>
                <span className="earnings-amount-highlight">{fmt(totalEarnings, currency)}</span>
              </div>
            </div>
          )}

          {/* Monthly tab */}
          {activeTab === 'monthly' && (
            <div className="earnings-monthly">
              <h3 className="earnings-section-title">Monthly Breakdown (Last 6 Months)</h3>
              {monthlyBuckets.map((bucket) => {
                const pct = maxMonthEarnings > 0 ? (bucket.earnings / maxMonthEarnings) * 100 : 0;
                return (
                  <div key={bucket.key} className="earnings-month-row">
                    <div className="earnings-month-label">{bucket.label}</div>
                    <div className="earnings-month-bar-wrap">
                      <div className="earnings-month-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="earnings-month-amount">
                      {bucket.earnings > 0 ? fmt(bucket.earnings, currency) : <span style={{ color: '#555' }}>—</span>}
                    </div>
                  </div>
                );
              })}
              <div className="earnings-monthly-note">
                ℹ️ Monthly earnings reflect content published during that month using an estimated view rate.
                Final payouts are calculated at the end of each billing cycle.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
