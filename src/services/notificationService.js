/**
 * Notification service — push/API integration.
 *
 * API path note: `client` baseURL is already `${API_BASE}/api/v1`, so all
 * paths here are relative (no leading /api/v1).
 *
 * Backend reference: PUSH_NOTIFICATIONS_FRONTEND_QA.md
 */

import client, { baseURL } from '../api/client';
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


const maskToken = (token) =>
  typeof token === 'string' && token.length > 12
    ? `${token.slice(0, 6)}...${token.slice(-4)}`
    : '[missing]';

/**
 * Register FCM token with backend.
 * POST /notifications/devices/register
 */
export async function registerDevice(token) {
  let device_id = localStorage.getItem('viewesta_web_device_id');
  if (!device_id) {
    device_id = 'web-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('viewesta_web_device_id', device_id);
  }

  const body = {
    token,
    // Backend Joi schema uses camelCase 'deviceType', NOT snake_case 'platform'.
    // Only 'ios' | 'android' are accepted; web browsers register as 'android'.
    deviceType: 'android',
    device_id,
    // NOTE: device_name is intentionally omitted — not in the backend Joi schema.
  };

  console.info('[Notifications][FCM Audit] Registration function called:', {
    called: true,
    url: `${baseURL}/notifications/devices/register`,
    method: 'POST',
    body: {
      token: maskToken(token),
      deviceType: body.deviceType,
      device_id: body.device_id,
    },
  });

  try {
    const response = await client.post('/notifications/devices/register', body);
    console.info('[Notifications][FCM Audit] Device registration response:', {
      sent: true,
      status: response?.status,
      message: response?.data?.message,
      expected201: response?.status === 201,
    });
    localStorage.setItem('viewesta_fcm_token', token);
    console.log('[NotificationService] Token registered with backend.');
  } catch (error) {
    console.warn('[Notifications][FCM Audit] Device registration failed:', {
      sent: true,
      status: error?.response?.status || error?.status,
      // Log the full backend response body so validation errors are visible
      backendError: error?.response?.data ?? null,
      message: error?.response?.data?.message || error?.response?.data?.error || error?.message,
    });
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

// ─── Service Worker Registration ────────────────────────────────────────────

/**
 * Build the firebase-messaging-sw.js URL with all Firebase config values
 * embedded as query parameters. The service worker reads these params at
 * startup (see public/firebase-messaging-sw.js) so that we don't hardcode
 * credentials in the publicly-served SW file.
 *
 * This mirrors the approach used in the admin dashboard (notifications.ts →
 * getServiceWorkerUrl / registerNotificationServiceWorker).
 */
function getServiceWorkerUrl() {
  const config = new URLSearchParams({
    apiKey:            process.env.REACT_APP_FIREBASE_API_KEY            ?? '',
    authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN        ?? '',
    projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID         ?? '',
    storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET     ?? '',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId:             process.env.REACT_APP_FIREBASE_APP_ID             ?? '',
  });
  return `/firebase-messaging-sw.js?${config.toString()}`;
}

/**
 * Explicitly register the Firebase Cloud Messaging service worker with the
 * Firebase config baked into its URL, then wait for it to become active.
 *
 * Calling this before `navigator.serviceWorker.ready` guarantees that the
 * service worker Firebase Messaging is properly initialised — without it the
 * SW boots without config, Firebase stays uninitialized inside the worker,
 * and getToken() either fails or produces an invalid token that the backend
 * rejects with a 400.
 */
async function registerNotificationServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Notifications][SW] serviceWorker API not available in this browser.');
    return null;
  }

  const swUrl = getServiceWorkerUrl();
  console.info('[Notifications][SW] Registering service worker:', swUrl.split('?')[0], {
    origin: window.location.origin,
    isSecureContext: window.isSecureContext,
  });

  try {
    const registration = await navigator.serviceWorker.register(swUrl);
    console.info('[Notifications][SW] Service worker registered.', {
      scope:      registration.scope,
      installing: !!registration.installing,
      waiting:    !!registration.waiting,
      active:     !!registration.active,
    });
    return registration;
  } catch (err) {
    console.error('[Notifications][SW] Service worker registration failed:', err);
    return null;
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
    console.info('[Notifications] Push notifications not supported in this browser.');
    return { supported: false };
  }

  if (Notification.permission === 'denied') {
    console.info('[Notifications] Permission denied — skipping registration.');
    return { supported: true, granted: false };
  }

  try {
    // Only prompt the browser dialog if permission is still 'default';
    // skip straight to token fetch if already 'granted'.
    let permission = Notification.permission;
    if (permission !== 'granted') {
      console.info('[Notifications] Requesting notification permission...');
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[Notifications] Notification permission not granted.');
      return { supported: true, granted: false };
    }

    console.info('[Notifications] Permission granted — initialising Firebase Messaging...');
    const messaging = await initializeMessaging();
    if (!messaging) {
      console.warn('[Notifications] Firebase Messaging unavailable in this browser.');
      return { supported: false };
    }

    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[Notifications] REACT_APP_FIREBASE_VAPID_KEY is not set — cannot obtain FCM token.');
      return { supported: true, granted: true, token: null };
    }

    // Explicitly register the SW with Firebase config params in the URL so the
    // service worker can initialise Firebase Messaging. Without this step the
    // SW receives no config (reads from URL params), Firebase stays uninitialised
    // inside the worker, getToken() returns an invalid token, and the backend
    // rejects the device registration with a 400.
    console.info('[Notifications] Registering notification service worker with Firebase config...');
    await registerNotificationServiceWorker();
    console.info('[Notifications] Waiting for service worker...');
    const registration = await navigator.serviceWorker.ready;
    console.info('[Notifications][SW] Active SW script URL:', registration.active?.scriptURL);
    console.info('[Notifications] Service worker ready — requesting FCM token...');

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    console.info('[Notifications][FCM Audit] FCM token generated:', {
      generated: Boolean(token),
      token: maskToken(token),
    });

    if (token) {
      console.info('[Notifications] FCM token obtained successfully.');
      const storedToken = localStorage.getItem('viewesta_fcm_token');
      if (storedToken && storedToken !== token) {
        // Token rotated — unregister old before registering new
        console.info('[Notifications] FCM token changed — unregistering old token...');
        await unregisterDevice(storedToken);
        localStorage.removeItem('viewesta_fcm_token');
      }
      console.info('[Notifications] Registering device with backend...');
      await registerDevice(token);
      return { supported: true, granted: true, token };
    } else {
      console.warn('[Notifications] getToken() returned empty — VAPID key may be incorrect or SW not ready.');
      return { supported: true, granted: true, token: null };
    }
  } catch (error) {
    console.error('[Notifications] Push registration error:', error?.message || error);
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
  // Only attempt refresh if this device was previously registered.
  const storedToken = localStorage.getItem('viewesta_fcm_token');
  if (!storedToken) return;

  try {
    const messaging = await initializeMessaging();
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
    if (!messaging || !vapidKey || !('serviceWorker' in navigator)) return;

    // Re-register the SW with config params before reading the token — same
    // reason as in registerPushNotifications: the SW needs the config in its URL.
    await registerNotificationServiceWorker();
    const registration = await navigator.serviceWorker.ready;

    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!currentToken) return;

    if (storedToken !== currentToken) {
      console.log('[NotificationService] FCM token changed — re-registering.');
      await unregisterDevice(storedToken);
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
