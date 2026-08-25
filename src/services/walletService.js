/**
 * Wallet service — backend-connected.
 * GET  /wallet          → fetch balance + transactions
 * POST /wallet/topup    → add funds to wallet
 */

import client from '../api/client';

function normalizeWalletPayload(payload) {
  const root = payload?.data ?? payload ?? {};
  const balance = Number(root.balance ?? root.wallet_balance ?? root.available_balance ?? 0);
  const currency = root.currency || root.currency_code || 'USD';
  const transactions = Array.isArray(root.transactions)
    ? root.transactions
    : Array.isArray(root.items)
      ? root.items
      : [];

  return {
    ...root,
    balance,
    currency,
    transactions,
  };
}

/**
 * Fetch the current user's wallet (balance + transactions).
 * @returns {{ balance: number, currency: string, transactions: Array }}
 */
export async function getWallet() {
  const { data } = await client.get('/wallet');
  return normalizeWalletPayload(data);
}

/**
 * Top up the wallet.
 * @param {{ amount: number, payment_method?: string }} payload
 * @returns {{ balance: number, transaction: object }}
 */
export async function topUpWallet({ amount, payment_provider = 'pesapal', payment_method = 'card' }) {
  const { data } = await client.post('/wallet/topup', { amount, payment_provider, payment_method });
  return data;
}
