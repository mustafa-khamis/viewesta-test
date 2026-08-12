import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyPayment } from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import './PaymentCallback.css';

const PaymentCallback = () => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('Verifying your payment...');
  const [returnTo, setReturnTo] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth(); // Assume we will add a real backend refetch to refreshProfile

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderTrackingId = params.get('requestID') || params.get('requestId') || params.get('OrderTrackingId') || params.get('order_tracking_id');
    const merchantReference = params.get('merchant_reference') || params.get('OrderMerchantReference');
    
    // Fallback to session storage if return_to is not in URL (e.g. from Pesapal redirect)
    let returnUrl = params.get('return_to');
    const sessionReturnTo = sessionStorage.getItem('vw_payment_return_to');
    if (!returnUrl && sessionReturnTo) {
      returnUrl = sessionReturnTo;
    }
    if (returnUrl) {
      setReturnTo(returnUrl);
    }
    
    // Clean up session storage
    if (sessionReturnTo) {
      sessionStorage.removeItem('vw_payment_return_to');
    }

    if (!orderTrackingId && !merchantReference) {
      setStatus('error');
      setMessage('Invalid payment callback: Missing tracking ID.');
      return;
    }

    let isMounted = true;

    const verify = async () => {
      try {
        await verifyPayment({ 
          order_tracking_id: orderTrackingId, 
          merchant_reference: merchantReference 
        });

        if (!isMounted) return;

        // Ensure we refresh the auth context so wallet/purchases/subscriptions update
        if (refreshProfile) {
          await refreshProfile();
        }

        setStatus('success');
        setMessage('Payment successful! Redirecting...');

        setTimeout(() => {
          if (returnUrl) {
            navigate(decodeURIComponent(returnUrl));
          } else {
            navigate('/wallet'); // fallback
          }
        }, 3000);

      } catch (error) {
        if (!isMounted) return;
        setStatus('error');
        setMessage(error?.response?.data?.message || 'Payment verification failed. Please contact support.');
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [location.search, navigate, refreshProfile]);

  return (
    <div className="payment-callback-page">
      <div className="payment-callback-card">
        {status === 'verifying' && (
          <>
            <FaSpinner className="callback-icon spin" />
            <h2>Verifying Payment</h2>
            <p>{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <FaCheckCircle className="callback-icon success" />
            <h2>Success</h2>
            <p>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <FaExclamationTriangle className="callback-icon error" />
            <h2>Verification Failed</h2>
            <p>{message}</p>
            <button className="btn btn-primary" onClick={() => navigate(returnTo ? decodeURIComponent(returnTo) : '/wallet')}>
              {returnTo ? 'Return' : 'Return to Wallet'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
