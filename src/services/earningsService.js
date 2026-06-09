import client from '../api/client';

/**
 * Fetch the filmmaker's current payout balance.
 * GET /filmmaker/payouts/balance
 * Expected response: { balance: number, currency: string, ... }
 */
export async function getPayoutBalance() {
  try {
    const response = await client.get('/filmmaker/payouts/balance');
    return response.data?.data || null;
  } catch (err) {
    console.error('Failed to fetch payout balance:', err);
    return null;
  }
}

/**
 * Fetch the filmmaker's payout history / monthly earnings.
 * GET /filmmaker/payouts
 */
export async function getPayouts() {
  try {
    const response = await client.get('/filmmaker/payouts');
    return response.data?.data || [];
  } catch (err) {
    console.error('Failed to fetch payouts:', err);
    return [];
  }
}

/**
 * Fetch the filmmaker's contract details (revenue split, minimum guarantee).
 * GET /filmmaker/me/contract
 */
export async function getContract() {
  try {
    const response = await client.get('/filmmaker/me/contract');
    return response.data?.data || null;
  } catch (err) {
    console.error('Failed to fetch contract:', err);
    return null;
  }
}
