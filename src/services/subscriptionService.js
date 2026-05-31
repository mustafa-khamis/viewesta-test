/**
 * Subscription service — backend-connected.
 * GET  /subscriptions/plans    → list all available plans
 * POST /subscriptions/subscribe → subscribe to a plan
 */

import client from '../api/client';

/**
 * Fetch available subscription plans from backend.
 * @returns {Array<{ id, name, price, currency, interval, features, ... }>}
 */
export async function getSubscriptionPlans() {
  const { data } = await client.get('/subscriptions/plans');

  let rawPlans = [];
  if (Array.isArray(data)) rawPlans = data;
  else if (Array.isArray(data?.data)) rawPlans = data.data;
  else if (Array.isArray(data?.plans)) rawPlans = data.plans;
  else if (Array.isArray(data?.data?.plans)) rawPlans = data.data.plans;
  else {
    const candidates = [
      data?.result,
      data?.results,
      data?.subscriptions,
      data?.items,
    ];
    rawPlans = candidates.find((c) => Array.isArray(c)) || [];
  }

  return rawPlans.map(plan => {
    let interval = plan.interval || plan.period;
    if (!interval && plan.duration_days) {
      if (plan.duration_days === 30 || plan.duration_days === 31) interval = 'month';
      else if (plan.duration_days === 365) interval = 'year';
      else interval = `${plan.duration_days} days`;
    }

    return {
      ...plan,
      id: plan.id || plan.type,
      interval,
    };
  });
}

/**
 * Subscribe the current user to a plan.
 * @param {{ plan_id: string, payment_method?: string }} payload
 * @returns {{ subscription: object, message: string }}
 */
export async function subscribe({ plan_id, payment_method = 'wallet' }) {
  const { data } = await client.post('/subscriptions/subscribe', { plan_id, payment_method });
  return data;
}

/**
 * Fetch the current user's active subscription.
 * @returns {object} Subscription data
 */
export async function getMySubscription() {
  const { data } = await client.get('/subscriptions/me');
  return data;
}
