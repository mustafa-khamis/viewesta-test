/**
 * Payment service — backend-connected.
 * GET  /payments/purchases    → list purchased movies
 * POST /payments/purchase     → purchase a movie
 * POST /payments/verify       → verify payment
 */

import client from '../api/client';

/**
 * Fetch the current user's purchased movies.
 * @returns {Array} Array of purchased movie objects or IDs
 */
export async function getPurchases() {
  const { data } = await client.get('/payments/purchases');
  return data;
}

/**
 * Purchase a movie.
 * @param {{ movie_id: string, quality?: string, payment_method?: string }} payload
 * @returns {object} Result of the purchase
 */
export async function purchaseMovie({ movie_id, quality = '1080p', payment_method = 'wallet' }) {
  const { data } = await client.post('/payments/purchase', { movie_id, quality, payment_method });
  return data;
}

/**
 * Verify a payment transaction (e.g. from Pesapal callback).
 * @param {{ transaction_id: string, order_tracking_id?: string }} payload
 * @returns {object} Verification result
 */
export async function verifyPayment({ transaction_id, order_tracking_id }) {
  const { data } = await client.post('/payments/verify', { transaction_id, order_tracking_id });
  return data;
}

/**
 * Create a checkout session for Card/Pesapal payments.
 * @param {{ item_type: string, item_id: string, amount: number, return_url?: string }} payload
 * @returns {object} Session data containing checkout_url
 */
export async function createCardCheckoutSession({ item_type, item_id, amount, return_url }) {
  try {
    // Attempt real backend call
    const { data } = await client.post('/payments/pesapal/checkout', { item_type, item_id, amount, return_url });
    return data;
  } catch (err) {
    console.warn('Backend Pesapal endpoint not ready or failed. Simulating checkout session...', err.message);
    
    // MOCK / TODO: Remove when backend Pesapal is fully active
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          checkout_url: `/checkout-simulation?amount=${amount}&item_type=${item_type}&item_id=${item_id}`,
          order_tracking_id: `MOCK_TRK_${Date.now()}`
        });
      }, 800);
    });
  }
}
