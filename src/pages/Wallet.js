import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FaWallet,
  FaPlus,
  FaCreditCard,
  FaMobile,
  FaArrowUp,
  FaFilm,
  FaShieldAlt,
  FaBolt,
  FaCheckCircle,
  FaSpinner,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { getWallet, topUpWallet } from '../services/walletService';
import './Wallet.css';

const TxIcon = ({ type }) => (
  <div className={`tx-icon tx-icon--${type}`}>
    {type === 'topup' ? <FaArrowUp /> : <FaFilm />}
  </div>
);

const Wallet = () => {
  const { user } = useAuth();

  /* ── Wallet state (from backend) ── */
  const [walletData, setWalletData]     = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError]   = useState('');

  /* ── Top-up form state ── */
  const [topUpAmount, setTopUpAmount]   = useState(25);
  const [customValue, setCustomValue]   = useState('');
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [selectedProvider, setSelectedProvider] = useState('flutterwave');
  const [topping, setTopping]           = useState(false);
  const [topSuccess, setTopSuccess]     = useState(false);
  const [topError, setTopError]         = useState('');

  const topUpOptions     = [10, 25, 50, 100];
  const paymentMethods   = [
    { id: 'card',   name: 'Credit / Debit Card', icon: FaCreditCard },
    { id: 'mobile', name: 'Mobile Money',         icon: FaMobile    },
  ];

  const paymentProviders = [
    { id: 'flutterwave', name: 'Flutterwave' },
    { id: 'stripe', name: 'Stripe' },
  ];

  const finalAmount = customValue !== '' ? Number(customValue) : topUpAmount;

  /* ── Fetch wallet ── */
  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    setWalletError('');
    try {
      const data = await getWallet();
      setWalletData(data);
    } catch (err) {
      setWalletError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load wallet. Please try again.'
      );
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchWallet();
  }, [user, fetchWallet]);

  const handleTopUp = async () => {
    if (!finalAmount || finalAmount < 1) return;
    setTopping(true);
    setTopError('');
    setTopSuccess(false);
    try {
      const result = await topUpWallet({
        amount: finalAmount,
        payment_provider: selectedProvider,
        payment_method: selectedMethod,
      });
      // Update local wallet data with new balance returned by backend
      setWalletData((prev) => ({
        ...prev,
        balance: result?.balance ?? result?.wallet?.balance ?? (prev?.balance ?? 0) + finalAmount,
        transactions: result?.transaction
          ? [result.transaction, ...(prev?.transactions ?? [])]
          : (prev?.transactions ?? []),
      }));
      setTopSuccess(true);
      setCustomValue('');
      setTimeout(() => setTopSuccess(false), 3500);
    } catch (err) {
      console.error('Top-up API Error:', JSON.stringify(err.response?.data, null, 2) || err.message);
      
      let errorMsg = 'Top-up failed. Please try again.';
      if (err?.response?.data) {
        const data = err.response.data;
        if (data.error?.details) {
          errorMsg = JSON.stringify(data.error.details);
        } else if (data.error?.message) {
          errorMsg = data.error.message;
        } else if (data.error) {
          errorMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : data.error;
        } else if (data.message) {
          errorMsg = typeof data.message === 'object' ? JSON.stringify(data.message) : data.message;
        } else if (data.errors) {
          errorMsg = JSON.stringify(data.errors);
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      if (typeof errorMsg === 'object') {
        errorMsg = JSON.stringify(errorMsg);
      }
      
      setTopError(errorMsg);
    } finally {
      setTopping(false);
    }
  };

  /* ── Derive display values ── */
  const balance      = Number(walletData?.balance ?? 0);
  const transactions = walletData?.transactions ?? [];
  const currency     = walletData?.currency ?? 'USD';
  const spent        = transactions.filter((t) => !t.positive && t.amount < 0)
                                   .reduce((s, t) => s + Math.abs(t.amount), 0);
  const topped       = transactions.filter((t) => t.positive || t.amount > 0)
                                   .reduce((s, t) => s + Math.abs(t.amount), 0);

  if (!user) {
    return (
      <div className="wallet-not-found">
        <FaWallet className="wallet-nf-icon" />
        <h2>Sign in to view your wallet</h2>
        <p>Track your balance and transactions in one place.</p>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      <div className="wallet-container">

        {/* ── Header ── */}
        <div className="wallet-header">
          <h1 className="wallet-title"><FaWallet /> My Wallet</h1>
          <p className="wallet-subtitle">Manage your balance and payment methods</p>
        </div>

        <div className="wallet-content">

          {/* ── Balance Card ── */}
          <div className="balance-card">
            <div className="balance-card__shine" aria-hidden="true" />
            <div className="balance-info">
              <p className="balance-label">Current Balance</p>
              <div className="balance-amount">
                {walletLoading ? (
                  <span className="balance-loading"><FaSpinner className="spin-icon" /></span>
                ) : walletError ? (
                  <span className="balance-error-text">—</span>
                ) : (
                  <>
                    <span className="balance-currency">$</span>
                    <span className="balance-value">{balance.toFixed(2)}</span>
                  </>
                )}
              </div>
              <p className="balance-subtitle">
                {currency} · Available for purchases &amp; rentals
              </p>
            </div>
            <div className="balance-icon" aria-hidden="true"><FaWallet /></div>
          </div>

          {/* ── Wallet error ── */}
          {walletError && !walletLoading && (
            <div className="wallet-fetch-error">
              <FaExclamationTriangle /> {walletError}
              <button className="btn btn-ghost btn-small" onClick={fetchWallet}>Retry</button>
            </div>
          )}

          {/* ── Quick Stats ── */}
          {!walletLoading && !walletError && (
            <div className="quick-stats">
              <div className="stat-card">
                <span className="stat-label">Total Topped Up</span>
                <span className="stat-value stat-value--green">${topped.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Spent</span>
                <span className="stat-value stat-value--red">${spent.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Transactions</span>
                <span className="stat-value stat-value--neutral">{transactions.length}</span>
              </div>
            </div>
          )}

          {/* ── Top Up ── */}
          <div className="wallet-card">
            <h3 className="section-title">Top Up Wallet</h3>

            <div className="top-up-options">
              {topUpOptions.map((amt) => (
                <button
                  key={amt}
                  className={`top-up-option ${customValue === '' && topUpAmount === amt ? 'selected' : ''}`}
                  onClick={() => { setTopUpAmount(amt); setCustomValue(''); }}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="custom-amount">
              <label htmlFor="customAmount">Or enter a custom amount</label>
              <div className="amount-input">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  id="customAmount"
                  placeholder="0.00"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  min="1"
                  max="1000"
                />
              </div>
            </div>

            <div className="payment-methods">
              <h4 className="pm-label">Payment Provider</h4>
              <div className="method-options">
                {paymentProviders.map((provider) => (
                  <label
                    key={provider.id}
                    className={`method-option ${selectedProvider === provider.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentProvider"
                      value={provider.id}
                      checked={selectedProvider === provider.id}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                    />
                    <span className="method-name">{provider.name}</span>
                    {selectedProvider === provider.id && <FaCheckCircle className="method-check" />}
                  </label>
                ))}
              </div>
            </div>

            <div className="payment-methods" style={{ marginTop: '20px' }}>
              <h4 className="pm-label">Payment Method</h4>
              <div className="method-options">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <label
                      key={method.id}
                      className={`method-option ${selectedMethod === method.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={selectedMethod === method.id}
                        onChange={(e) => setSelectedMethod(e.target.value)}
                      />
                      <Icon className="method-icon" />
                      <span className="method-name">{method.name}</span>
                      {selectedMethod === method.id && <FaCheckCircle className="method-check" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {topSuccess && (
              <div className="topup-success">
                <FaCheckCircle /> ${finalAmount.toFixed(2)} added successfully!
              </div>
            )}

            {topError && (
              <div className="topup-error">
                <FaExclamationTriangle /> {topError}
              </div>
            )}

            <button
              className="btn btn-primary topup-btn"
              onClick={handleTopUp}
              disabled={topping || !finalAmount || finalAmount < 1}
            >
              {topping ? (
                <><FaSpinner className="btn-spin" /> Processing…</>
              ) : (
                <><FaPlus /> Add ${(finalAmount || 0).toFixed(2)} to Wallet</>
              )}
            </button>

            <p className="topup-note"><FaShieldAlt /> Secured with 256-bit encryption</p>
          </div>

          {/* ── Transactions ── */}
          <div className="wallet-card">
            <h3 className="section-title">Recent Transactions</h3>
            {walletLoading ? (
              <div className="tx-loading"><FaSpinner className="spin-icon" /> Loading transactions…</div>
            ) : transactions.length === 0 ? (
              <p className="tx-empty">No transactions yet. Top up to get started.</p>
            ) : (
              <div className="transaction-list">
                {transactions.map((tx, idx) => {
                  const isPositive = tx.positive ?? tx.amount > 0;
                  const type       = isPositive ? 'topup' : 'movie';
                  const label      = tx.label ?? tx.description ?? tx.type ?? 'Transaction';
                  const date       = tx.date  ?? tx.created_at
                    ? new Date(tx.date ?? tx.created_at).toLocaleString()
                    : '';
                  const amt        = Math.abs(tx.amount ?? 0);
                  return (
                    <div key={tx.id ?? idx} className="transaction-item">
                      <TxIcon type={type} />
                      <div className="transaction-info">
                        <span className="transaction-label">{label}</span>
                        {date && <span className="transaction-date">{date}</span>}
                      </div>
                      <span className={`transaction-amount ${isPositive ? 'tx--positive' : 'tx--negative'}`}>
                        {isPositive ? '+' : '-'}${amt.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── How It Works ── */}
          <div className="wallet-card">
            <h3 className="section-title">How It Works</h3>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-icon info-icon--orange"><FaBolt /></div>
                <h4>Flexible Spending</h4>
                <p>Pay only for content you watch — no forced subscriptions.</p>
              </div>
              <div className="info-item">
                <div className="info-icon info-icon--blue"><FaCreditCard /></div>
                <h4>Multiple Methods</h4>
                <p>Top up via credit card, debit card, or mobile money.</p>
              </div>
              <div className="info-item">
                <div className="info-icon info-icon--green"><FaShieldAlt /></div>
                <h4>Secure &amp; Safe</h4>
                <p>Your payment info is encrypted end-to-end at all times.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Wallet;
