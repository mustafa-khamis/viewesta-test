/**
 * Notification service — push/API integration.
 *
 * API path note: `client` baseURL is already `${API_BASE}/api/v1`, so all
 * paths here are relative (no leading /api/v1).
 *
 * Backend reference: PUSH_NOTIFICATIONS_FRONTEND_QA.md
 */

import client from '../api/client';
import { getToken, onMessage } from 'firebase/messaging';
import { initializeMessaging } from '../firebase/config';

// ─── Supported notification types (backend CHECK constraint) ──────────────────
export const NOTIFICATION_TYPES = {
  NEW_CONTENT: 'new_content',
  CONTENT_APPROVED: 'content_approved',
  CONTENT_REJECTED: 'content_rejected',
  PURCHASE_SUCCESS: 'purchase_success',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  NEW_EPISODE: 'new_episode',
  NEW_SEASON: 'new_season',
  FILMMAKER_EARNINGS: 'filmmaker_earnings',
  PAYOUT_PROCESSED: 'payout_processed',
  REVIEW_RECEIVED: 'review_received',
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  PROMOTIONAL: 'promotional',
};

// ─── Helper: resolve response data ───────────────────────────────────────────
// Backend wraps responses in { success, data: { ... } } or returns data directly.
const resolveData = (response) =>
  response?.data?.data ?? response?.data ?? {};

// ─── Notification CRUD ────────────────────────────────────────────────────────

/**
 * Fetch paginated notifications.
 * GET /notifications?limit=&offset=
 * Returns { notifications: [], unreadCount: number }
 */
export async function getNotifications(limit = 20, offset = 0) {
  try {
    const response = await client.get('/notifications', { params: { limit, offset } });
    const data = resolveData(response);
    return {
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
    };
  } catch (err) {
    console.warn('[NotificationService] getNotifications:', err?.message);
    throw err; // Re-throw so callers can show error state
  }
}

/**
 * Fetch unread notifications only.
 * GET /notifications/unread
 * Returns { notifications: [], count: number }
 */
export async function getUnreadNotifications() {
  try {
    const response = await client.get('/notifications/unread');
    const data = resolveData(response);
    return {
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      count: typeof data.count === 'number' ? data.count : 0,
    };
  } catch (err) {
    console.warn('[NotificationService] getUnreadNotifications:', err?.message);
    return { notifications: [], count: 0 };
  }
}

/**
 * Mark a single notification as read.
 * PUT /notifications/:id/read
 */
export async function markNotificationRead(id) {
  const response = await client.put(`/notifications/${id}/read`);
  return response.data;
}

/**
 * Mark all notifications as read.
 * PUT /notifications/read-all
 */
export async function markAllRead() {
  const response = await client.put('/notifications/read-all');
  return response.data;
}

/**
 * Delete a notification.
 * DELETE /notifications/:id
 */
export async function deleteNotification(id) {
  const response = await client.delete(`/notifications/${id}`);
  return response.data;
}

// ─── Notification Preferences ─────────────────────────────────────────────────

/**
 * Fetch user notification preferences.
 * GET /notifications/preferences
 */
export async function getNotificationPreferences() {
  try {
    const response = await client.get('/notifications/preferences');
    return resolveData(response);
  } catch (err) {
    console.warn('[NotificationService] getNotificationPreferences:', err?.message);
    throw err;
  }
}

/**
 * Update user notification preferences.
 * PUT /notifications/preferences
 * @param {Object} prefs - e.g. { promotional: false, system_announcement: true }
 */
export async function updateNotificationPreferences(prefs) {
  try {
    const response = await client.put('/notifications/preferences', prefs);
    return resolveData(response);
  } catch (err) {
    console.warn('[NotificationService] updateNotificationPreferences:', err?.message);
    throw err;
  }
}

// ─── Deep Linking ─────────────────────────────────────────────────────────────

/**
 * Navigate using `data.action_url` from a notification.
 * Falls back to /notifications when action_url is missing, null, or malformed.
 *
 * @param {Object} notification - Notification object from the API list
 * @param {Function} navigate   - React Router navigate function
 */
export function handleNotificationClick(notification, navigate) {
  if (typeof navigate !== 'function') {
    console.warn('[NotificationService] handleNotificationClick: navigate function not provided');
    return;
  }

  try {
    // data.action_url comes from the backend; can also live at top-level action_url
    const actionUrl =
      notification?.data?.action_url ||
      notification?.action_url ||
      null;

    if (!actionUrl || typeof actionUrl !== 'string' || actionUrl.trim() === '') {
      navigate('/notifications');
      return;
    }

    // Only allow relative paths (internal routes) for security
    const trimmed = actionUrl.trim();
    if (trimmed.startsWith('/')) {
      navigate(trimmed);
    } else {
      // Unexpected format — fall back
      console.warn('[NotificationService] Unexpected action_url format:', trimmed);
      navigate('/notifications');
    }
  } catch (err) {
    console.warn('[NotificationService] handleNotificationClick error:', err?.message);
    navigate('/notifications');
  }
}

// ─── Device Registration ───────────────────────────────────────────────────────

/**
 * Build a human-readable device name from user agent.
 */
const getDeviceName = () => {
  const ua = navigator.userAgent || '';
  if (ua.includes('Chrome')) return 'Chrome Web';
  if (ua.includes('Firefox')) return 'Firefox Web';
  if (ua.includes('Safari')) return 'Safari Web';
  if (ua.includes('Edge')) return 'Edge Web';
  return 'Web Browser';
};

/**
 * Register FCM token with backend.
 * POST /notifications/devices/register
 */
export async function registerDevice(token) {
  try {
    await client.post('/notifications/devices/register', {
      token,
      deviceType: 'web',
      deviceName: getDeviceName(),
    });
    localStorage.setItem('viewesta_fcm_token', token);
    console.log('[NotificationService] Token registered with backend.');
  } catch (error) {
    console.warn('[NotificationService] Failed to register token:', error?.message);
    // Non-fatal — push registration failure should not break login
  }
}

/**
 * Unregister FCM token from backend.
 * POST /notifications/devices/unregister
 */
export async function unregisterDevice(token) {
  if (!token) return;
  try {
    await client.post('/notifications/devices/unregister', { token });
    console.log('[NotificationService] Token unregistered from backend.');
  } catch (error) {
    console.warn('[NotificationService] Failed to unregister token:', error?.message);
  }
}

/**
 * List all registered devices for the current user.
 * GET /notifications/devices
 */
export async function getRegisteredDevices() {
  try {
    const response = await client.get('/notifications/devices');
    return resolveData(response);
  } catch (err) {
    console.warn('[NotificationService] getRegisteredDevices:', err?.message);
    return [];
  }
}

// ─── Push Registration ────────────────────────────────────────────────────────

/**
 * Request notification permission and register FCM token.
 * Call after user logs in or when prompting for permission.
 * Returns { supported, granted, token? }
 */
export async function registerPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.info('[NotificationService] Push notifications not supported in this browser.');
    return { supported: false };
  }

  // Don't re-request if already granted
  if (Notification.permission === 'denied') {
    return { supported: true, granted: false };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[NotificationService] Notification permission not granted.');
      return { supported: true, granted: false };
    }

    const messaging = await initializeMessaging();
    if (!messaging) {
      return { supported: false };
    }

    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[NotificationService] FCM token retrieved.');
      const storedToken = localStorage.getItem('viewesta_fcm_token');
      if (storedToken && storedToken !== token) {
        // Token changed — unregister old before registering new
        await unregisterDevice(storedToken);
        localStorage.removeItem('viewesta_fcm_token');
      }
      await registerDevice(token);
      return { supported: true, granted: true, token };
    } else {
      console.warn('[NotificationService] No FCM registration token available.');
      return { supported: true, granted: true, token: null };
    }
  } catch (error) {
    console.error('[NotificationService] Push registration error:', error);
    return { supported: true, granted: false, error };
  }
}

/**
 * Unregister all push notifications (call on logout).
 */
export async function unregisterPushNotifications() {
  const token = localStorage.getItem('viewesta_fcm_token');
  if (token) {
    await unregisterDevice(token);
    localStorage.removeItem('viewesta_fcm_token');
  }
}

/**
 * Refresh FCM token: compare current token against stored one.
 * If different, unregister old and register new.
 * Call on app visibility change or token-refresh events.
 */
export async function refreshFCMToken() {
  try {
    const messaging = await initializeMessaging();
    if (!messaging) return;

    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
    const registration = await navigator.serviceWorker.ready;

    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!currentToken) return;

    const storedToken = localStorage.getItem('viewesta_fcm_token');
    if (storedToken !== currentToken) {
      console.log('[NotificationService] FCM token changed — re-registering.');
      if (storedToken) await unregisterDevice(storedToken);
      await registerDevice(currentToken);
    }
  } catch (err) {
    console.warn('[NotificationService] refreshFCMToken error:', err?.message);
  }
}

// ─── Foreground Listener ──────────────────────────────────────────────────────

/**
 * Set up foreground message listener.
 * Returns unsubscribe function — call it on cleanup to prevent memory leaks.
 * @param {Function} callback - receives the raw Firebase payload
 */
export async function onForegroundMessage(callback) {
  const messaging = await initializeMessaging();
  if (messaging) {
    return onMessage(messaging, (payload) => {
      console.log('[NotificationService] Foreground message received:', payload);
      callback(payload);
    });
  }
  return () => {}; // No-op unsubscribe if messaging not available
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function formatNotificationTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
