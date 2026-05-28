/**
 * Notification service — structured for future push/API integration.
 * Currently builds in-app notifications from local storage + graceful API fallback.
 * Ready for Firebase Cloud Messaging or backend /notifications endpoint when available.
 */

import client from '../api/client';

export const NOTIFICATION_TYPES = {
  NEW_MOVIE: 'new_movie',
  NEW_EPISODE: 'new_episode',
  SYSTEM: 'system',
  TARGETED: 'targeted',
};

// ─── API integration (graceful fallback if endpoint not yet available) ─────────

/**
 * Fetch notifications from backend.
 * GET /notifications  (future endpoint — gracefully returns [] if unavailable)
 */
export async function getNotifications() {
  try {
    const response = await client.get('/notifications');
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      if (Array.isArray(data.notifications)) return data.notifications;
      if (Array.isArray(data)) return data;
    }
    return [];
  } catch (err) {
    // Endpoint may not exist yet — return empty, no crash
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      return [];
    }
    console.warn('getNotifications:', err?.message);
    return [];
  }
}

/**
 * Mark a notification as read.
 * PUT /notifications/:id/read
 */
export async function markNotificationRead(id) {
  try {
    const response = await client.put(`/notifications/${id}/read`);
    return response.data;
  } catch (err) {
    console.warn(`markNotificationRead(${id}):`, err?.message);
  }
}

/**
 * Mark all notifications as read.
 * PUT /notifications/read-all
 */
export async function markAllRead() {
  try {
    const response = await client.put('/notifications/read-all');
    return response.data;
  } catch (err) {
    console.warn('markAllRead:', err?.message);
  }
}

// ─── Local storage helpers for in-app notification state ──────────────────────

const STORAGE_KEY = 'viewesta_notifications';

export function getLocalNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveLocalNotification(notification) {
  const existing = getLocalNotifications();
  const updated = [{ ...notification, id: Date.now(), read: false, timestamp: new Date().toISOString() }, ...existing].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function markLocalNotificationRead(id) {
  const existing = getLocalNotifications();
  const updated = existing.map((n) => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearLocalNotifications() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Push notification registration (Web Push / Firebase — future) ─────────────

/**
 * Register browser for push notifications.
 * Call this after user grants permission.
 * Currently a no-op stub — connect to Firebase FCM or backend when ready.
 */
export async function registerPushNotifications() {
  if (!('Notification' in window)) {
    console.info('[Notifications] Browser does not support push notifications.');
    return { supported: false };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { supported: true, granted: false };
  }

  // TODO: Get FCM token and register with backend
  // const { getToken } = await import('firebase/messaging');
  // const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  // await client.post('/notifications/register-device', { token, platform: 'web' });

  return { supported: true, granted: true };
}

export function formatNotificationTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
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
