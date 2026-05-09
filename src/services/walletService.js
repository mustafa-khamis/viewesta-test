/**
 * Wallet service — backend-connected.
 * GET  /wallet          → fetch balance + transactions
 * POST /wallet/topup    → add funds to wallet
 */

import client from '../api/client';

/**
 * Fetch the current user's wallet (balance + transactions).
 * @returns {{ balance: number, currency: string, transactions: Array }}
 */
export async function getWallet() {
  const { data } = await client.get('/wallet');
  return data;
}

/**
 * Top up the wallet.
 * @param {{ amount: number, payment_method?: string }} payload
 * @returns {{ balance: number, transaction: object }}
 */
export async function topUpWallet({ amount, payment_provider = 'flutterwave', payment_method = 'card' }) {
  const { data } = await client.post('/wallet/topup', { amount, payment_provider, payment_method });
  return data;
}
