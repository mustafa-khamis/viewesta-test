/**
 * NotificationContext — global notification state shared across the app.
 *
 * Provides:
 *   unreadCount       - live unread count, updated after every mutation
 *   prependNotification(n) - add a new notification to the top of the list
 *   refreshUnreadCount()   - lightweight re-sync with backend
 *   markReadLocally(id)    - optimistic read mark (badge only)
 *   markAllReadLocally()   - optimistic mark-all (badge only)
 *   deleteLocally(id)      - optimistic delete (badge only when unread)
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useAuth } from './AuthContext';
import { getNotifications } from '../services/notificationService';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  // Shared in-memory notification list — used to push foreground arrivals
  // to Notifications page without re-fetching from API.
  const [pendingNotification, setPendingNotification] = useState(null);

  // ─── Sync unread count from backend ────────────────────────────────────────
  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications(1, 0);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Non-fatal — badge simply stays stale
    }
  }, [user]);

  // ─── Fetch on login/mount, reset on logout ─────────────────────────────────
  // refreshUnreadCount depends on `user`, so this effect re-runs correctly
  // on every login/logout cycle without needing a manual ref guard.
  useEffect(() => {
    if (user) {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
      setPendingNotification(null);
    }
  }, [user, refreshUnreadCount]);

  // ─── Token refresh on page visibility change ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Refresh badge when user returns to tab
        refreshUnreadCount();
        // Also attempt FCM token refresh to catch rotated tokens
        import('../services/notificationService').then(({ refreshFCMToken }) => {
          refreshFCMToken().catch(() => {});
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, refreshUnreadCount]);

  // ─── Optimistic local mutations (badge only) ────────────────────────────────

  const markReadLocally = useCallback((id, isCurrentlyUnread) => {
    if (isCurrentlyUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const markAllReadLocally = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const deleteLocally = useCallback((wasUnread) => {
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  // ─── Prepend foreground-arrived notification ────────────────────────────────
  const prependNotification = useCallback((notification) => {
    setUnreadCount((prev) => prev + 1);
    setPendingNotification(notification);
  }, []);

  const clearPendingNotification = useCallback(() => {
    setPendingNotification(null);
  }, []);

  const value = {
    unreadCount,
    setUnreadCount,
    refreshUnreadCount,
    markReadLocally,
    markAllReadLocally,
    deleteLocally,
    prependNotification,
    pendingNotification,
    clearPendingNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
