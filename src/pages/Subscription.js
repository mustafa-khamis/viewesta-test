import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaCheck, FaCrown, FaStar, FaFilm, FaDownload,
  FaBan, FaHeadset, FaShieldAlt, FaBolt, FaGem, FaSpinner,
} from 'react-icons/fa';
import { getSubscriptionPlans, subscribe } from '../services/subscriptionService';
import './Subscription.css';

/* ── Static plan display helpers (icons / tags by id / interval) ── */
const planMeta = {
  monthly: { icon: <FaBolt />, tag: null,       popular: false },
  yearly:  { icon: <FaGem />,  tag: 'Save 17%', popular: true  },
  premium: { icon: <FaCrown />,tag: 'Best',      popular: false },
};

const fallbackIcon = <FaStar />;

const trustItems = [
  { icon: <FaFilm />,     title: 'Unlimited Content',  desc: 'Access thousands of African films and series anytime.' },
  { icon: <FaDownload />, title: 'Offline Downloads',   desc: 'Save your favourites and watch without internet.' },
  { icon: <FaBan />,      title: 'Zero Ads',            desc: 'Uninterrupted viewing from start to finish.' },
  { icon: <FaHeadset />,  title: 'Priority Support',    desc: 'Real humans ready to help whenever you need.' },
];

const Subscription = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const returnTo = searchParams.get('return_to');
  const movieId = searchParams.get('movie_id');

  const [plans, setPlans]               = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError]     = useState('');

  const [subscribing, setSubscribing]   = useState(null);   // planId currently being processed
  const [subSuccess, setSubSuccess]     = useState('');
  const [subError, setSubError]         = useState('');

  /* ── fetch plans ── */
  useEffect(() => {
    let cancelled = false;
    setPlansLoading(true);
    setPlansError('');
    getSubscriptionPlans()
      .then((list) => { if (!cancelled) setPlans(Array.isArray(list) ? list : []); })
      .catch((err) => {
        if (!cancelled)
          setPlansError(
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load subscription plans. Please try again.'
          );
      })
      .finally(() => { if (!cancelled) setPlansLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* ── subscribe handler ── */
  const handleSubscribe = async (planId) => {
    if (!user) return;
    setSubscribing(planId);
    setSubSuccess('');
    setSubError('');
    try {
      // TODO: Replace mock payment success with real backend subscription activation response
      await subscribe({ plan_id: planId });
      setSubSuccess(`You're now subscribed to the ${planId} plan!`);
      
      // MOCK: If we arrived here from MovieDetail, simulate success and navigate to Watch.js
      if (returnTo && movieId) {
        sessionStorage.setItem(`playback_auth_${movieId}`, 'true');
        setTimeout(() => {
          navigate(decodeURIComponent(returnTo));
        }, 1500); // short delay to show success message
      } else {
        setTimeout(() => setSubSuccess(''), 4000);
      }
    } catch (err) {
      setSubError(
        err?.response?.data?.message ||
        err?.message ||
        'Subscription failed. Please try again.'
      );
    } finally {
      setSubscribing(null);
    }
  };

  if (!user) {
    return (
      <div className="subscription-not-found">
        <h2>Please log in to view subscription options</h2>
      </div>
    );
  }

  return (
    <div className="subscription-page">

      {/* ── Hero ── */}
      <div className="sub-hero">
        <div className="sub-hero-glow" />
        <FaCrown className="sub-hero-crown" />
        <h1 className="sub-hero-title">Unlimited African Cinema</h1>
        <p className="sub-hero-subtitle">
          Stream the best Nollywood, Afrobeats docs, and pan-African originals —
          in stunning 4K, with no interruptions.
        </p>
        <div className="sub-hero-badges">
          <span><FaShieldAlt /> Secure payments</span>
          <span><FaBan /> No ads, ever</span>
          <span><FaCheck /> Cancel anytime</span>
        </div>
      </div>

      <div className="subscription-container layout-container">

        {/* ── Feedback banners ── */}
        {subSuccess && (
          <div className="sub-feedback sub-feedback--success">
            <FaCheck /> {subSuccess}
          </div>
        )}
        {subError && (
          <div className="sub-feedback sub-feedback--error">
            ⚠ {subError}
          </div>
        )}

        {/* ── Plan Cards ── */}
        {plansLoading ? (
          <div className="sub-loading">
            <FaSpinner className="sub-spinner" /> Loading plans…
          </div>
        ) : plansError ? (
          <div className="sub-error-msg">
            ⚠ {plansError}
          </div>
        ) : (
          <div className="plans-grid">
            {plans.map((plan) => {
              const meta    = planMeta[plan.id] || {};
              const icon    = meta.icon    ?? fallbackIcon;
              const tag     = meta.tag     ?? plan.tag     ?? null;
              const popular = meta.popular ?? plan.popular ?? false;
              const feats   = Array.isArray(plan.features) ? plan.features : [];
              const isBusy  = subscribing === plan.id;

              return (
                <div key={plan.id} className={`plan-card ${popular ? 'popular' : ''}`}>
                  {popular && (
                    <div className="popular-badge">
                      <FaStar /> Most Popular
                    </div>
                  )}

                  <div className="plan-icon">{icon}</div>

                  <div className="plan-header">
                    <h3 className="plan-name">{plan.name}</h3>
                    {tag && <span className="plan-tag">{tag}</span>}
                    <div className="plan-price">
                      <span className="price">
                        {plan.currency === 'USD' || !plan.currency ? '$' : ''}{plan.price ?? plan.amount ?? '—'}
                      </span>
                      <span className="period">/{plan.interval ?? plan.period ?? 'month'}</span>
                    </div>
                    {plan.originalPrice && (
                      <div className="original-price">was ${plan.originalPrice}</div>
                    )}
                  </div>

                  {feats.length > 0 && (
                    <ul className="plan-features">
                      {feats.map((feature, i) => (
                        <li key={i} className="feature-item">
                          <FaCheck className="check-icon" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    className={`btn ${popular ? 'btn-primary' : 'btn-outline'} btn-full sub-btn`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isBusy}
                  >
                    {isBusy
                      ? <><FaSpinner className="btn-spinner" /> Processing…</>
                      : user.subscription?.active
                        ? 'Change Plan'
                        : 'Get Started'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Trust Grid ── */}
        <div className="trust-section">
          <h2 className="trust-title">Why Viewesta?</h2>
          <div className="trust-grid">
            {trustItems.map((item, i) => (
              <div key={i} className="trust-item">
                <div className="trust-icon">{item.icon}</div>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Guarantee Strip ── */}
        <div className="guarantee-strip">
          <FaShieldAlt className="guarantee-icon" />
          <div>
            <strong>30-Day Money-Back Guarantee</strong>
            <p>Not satisfied? We'll refund you in full — no questions asked.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Subscription;
