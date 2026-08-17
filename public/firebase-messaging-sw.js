/* eslint-disable no-restricted-globals */

/**
 * Firebase Cloud Messaging Service Worker
 *
 * Handles background notifications and notification click events.
 * Firebase config is passed via URL query parameters from the React app
 * so we don't need to hardcode credentials in this public file.
 */

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// ─── Firebase config from URL params ─────────────────────────────────────────
const urlParams = new URLSearchParams(location.search);

const firebaseConfig = {
  apiKey: urlParams.get('apiKey'),
  authDomain: urlParams.get('authDomain'),
  projectId: urlParams.get('projectId'),
  storageBucket: urlParams.get('storageBucket'),
  messagingSenderId: urlParams.get('messagingSenderId'),
  appId: urlParams.get('appId'),
};

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined') {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  // ─── Background message handler ────────────────────────────────────────────
  // Called when a notification arrives while the app is in the background / closed.
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const title = payload.notification?.title || 'New Notification';
    const body = payload.notification?.body || '';
    const actionUrl = payload.data?.action_url || null;
    const notificationId = payload.data?.notificationId || null;

    const options = {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      // Store action_url in notification data for the click handler
      data: { action_url: actionUrl },
      // Use notificationId as tag to deduplicate OS-level notifications
      tag: notificationId || title,
    };

    self.registration.showNotification(title, options);
  });

  // ─── Notification click handler ─────────────────────────────────────────────
  // Handles clicks on OS notifications (background / when app is closed).
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const actionUrl = event.notification.data?.action_url || null;
    const targetUrl = actionUrl && actionUrl.startsWith('/')
      ? self.location.origin + actionUrl
      : self.location.origin + '/notifications';

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If the app is already open in a tab, focus it and navigate
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  });
} else {
  console.warn('[SW] Firebase config not provided in URL params — notifications disabled.');
}
