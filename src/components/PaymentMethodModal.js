import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaWallet, FaCreditCard, FaMobileAlt, FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import { getWallet } from '../services/walletService';
import './PaymentMethodModal.css';

const PaymentMethodModal = ({ isOpen, onClose, onContinue, amount, title = "Choose Payment Method" }) => {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');

  // Fetch wallet balance when wallet is selected
  useEffect(() => {
    if (selectedMethod === 'wallet') {
      let isMounted = true;
      setWalletLoading(true);
      setWalletError('');
      
      getWallet()
        .then(data => {
          if (isMounted) {
            setWalletBalance(Number(data?.balance ?? 0));
            setWalletLoading(false);
          }
        })
        .catch(err => {
          if (isMounted) {
            setWalletError('Failed to fetch wallet balance.');
            setWalletLoading(false);
          }
        });

      return () => { isMounted = false; };
    }
  }, [selectedMethod]);

  if (!isOpen) return null;

  const isWalletInsufficient = selectedMethod === 'wallet' && !walletLoading && !walletError && walletBalance < amount;
  
  const canContinue = 
    selectedMethod === 'card' || 
    (selectedMethod === 'wallet' && !isWalletInsufficient && !walletLoading && !walletError);

  const handleContinue = () => {
    if (canContinue) {
      onContinue(selectedMethod);
    }
  };

  const handleTopUp = () => {
    onClose();
    navigate('/wallet');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="purchase-modal payment-method-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="pm-amount-display">
            <div className="pm-amount-label">Amount to Pay</div>
            <div className="pm-amount-value">${Number(amount).toFixed(2)}</div>
          </div>

          <div className="pm-options">
            {/* Wallet Option */}
            <div 
              className={`pm-option ${selectedMethod === 'wallet' ? 'active' : ''}`}
              onClick={() => setSelectedMethod('wallet')}
            >
              <div className="pm-option-info">
                <div className="pm-option-icon">
                  <FaWallet />
                </div>
                <div className="pm-option-text">
                  <span className="pm-option-title">Wallet Balance</span>
                  <span className="pm-option-desc">Pay instantly from your Viewesta wallet</span>
                </div>
              </div>
            </div>

            {/* Wallet Details (Visible only when selected) */}
            {selectedMethod === 'wallet' && (
              <div className="pm-wallet-details">
                <div className="pm-wallet-balance">
                  <span className="pm-wallet-balance-label">Current Balance:</span>
                  <span className="pm-wallet-balance-value">
                    {walletLoading ? <FaSpinner className="fa-spin" /> : `$${walletBalance.toFixed(2)}`}
                  </span>
                </div>
                
                {walletError && (
                  <div className="pm-wallet-warning">
                    <FaExclamationCircle /> {walletError}
                  </div>
                )}

                {isWalletInsufficient && (
                  <>
                    <div className="pm-wallet-warning">
                      <FaExclamationCircle /> Insufficient Wallet Balance
                    </div>
                    <button className="btn btn-outline pm-wallet-topup-btn" onClick={handleTopUp}>
                      Top Up Wallet
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Card Option */}
            <div 
              className={`pm-option ${selectedMethod === 'card' ? 'active' : ''}`}
              onClick={() => setSelectedMethod('card')}
            >
              <div className="pm-option-info">
                <div className="pm-option-icon">
                  <FaCreditCard />
                </div>
                <div className="pm-option-text">
                  <span className="pm-option-title">Credit / Debit Card</span>
                  <span className="pm-option-desc">Secure payment via Pesapal</span>
                </div>
              </div>
            </div>

            {/* Mobile Money Option (Disabled) */}
            <div className="pm-option disabled">
              <div className="pm-option-info">
                <div className="pm-option-icon">
                  <FaMobileAlt />
                </div>
                <div className="pm-option-text">
                  <span className="pm-option-title">Mobile Money</span>
                  <span className="pm-option-desc">Pay with MTN, Airtel, M-Pesa</span>
                </div>
              </div>
              <div className="pm-coming-soon">Coming Soon</div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal;
