import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  registerPushNotifications,
  formatNotificationTime,
  NOTIFICATION_TYPES,
  handleNotificationClick,
} from '../services/notificationService';
import './Notifications.css';

const TYPE_ICONS = {
  [NOTIFICATION_TYPES.NEW_CONTENT]: '🎬',
  [NOTIFICATION_TYPES.CONTENT_APPROVED]: '✅',
  [NOTIFICATION_TYPES.CONTENT_REJECTED]: '❌',
  [NOTIFICATION_TYPES.PURCHASE_SUCCESS]: '💳',
  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING]: '⏳',
  [NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED]: '🔄',
  [NOTIFICATION_TYPES.NEW_EPISODE]: '📺',
  [NOTIFICATION_TYPES.NEW_SEASON]: '🌟',
  [NOTIFICATION_TYPES.FILMMAKER_EARNINGS]: '💰',
  [NOTIFICATION_TYPES.PAYOUT_PROCESSED]: '💸',
  [NOTIFICATION_TYPES.REVIEW_RECEIVED]: '📝',
  [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: '📢',
  [NOTIFICATION_TYPES.PROMOTIONAL]: '🎉',
};

const TYPE_LABELS = {
  [NOTIFICATION_TYPES.NEW_CONTENT]: 'New Content',
  [NOTIFICATION_TYPES.CONTENT_APPROVED]: 'Content Approved',
  [NOTIFICATION_TYPES.CONTENT_REJECTED]: 'Content Rejected',
  [NOTIFICATION_TYPES.PURCHASE_SUCCESS]: 'Purchase Success',
  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING]: 'Subscription Expiring',
  [NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED]: 'Subscription Renewed',
  [NOTIFICATION_TYPES.NEW_EPISODE]: 'New Episode',
  [NOTIFICATION_TYPES.NEW_SEASON]: 'New Season',
  [NOTIFICATION_TYPES.FILMMAKER_EARNINGS]: 'New Earnings',
  [NOTIFICATION_TYPES.PAYOUT_PROCESSED]: 'Payout Processed',
  [NOTIFICATION_TYPES.REVIEW_RECEIVED]: 'New Review',
  [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: 'System Announcement',
  [NOTIFICATION_TYPES.PROMOTIONAL]: 'Promotional',
};

const PAGE_LIMIT = 20;

export default function Notifications() {
  const { t } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    unreadCount,
    setUnreadCount,
    markReadLocally,
    markAllReadLocally,
    deleteLocally,
    pendingNotification,
    clearPendingNotification,
  } = useNotification();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0); // Use ref instead of state to avoid stale closure in useCallback
  const [error, setError] = useState(null);
  const [pushStatus, setPushStatus] = useState(null); // null | 'granted' | 'denied' | 'unsupported'
  const [activeFilter, setActiveFilter] = useState('all');

  // ─── Check existing push permission ────────────────────────────────────────
  useEffect(() => {
    if (!('Notification' in window)) {
      setPushStatus('unsupported');
    } else if (Notification.permission === 'granted') {
      setPushStatus('granted');
    } else if (Notification.permission === 'denied') {
      setPushStatus('denied');
    }
  }, []);

  // ─── Consume foreground notifications pushed from NotificationContext ────────
  useEffect(() => {
    if (pendingNotification) {
      setNotifications((prev) => {
        // Avoid duplicate if notification already exists
        const exists = prev.some((n) => n.id === pendingNotification.id);
        if (exists) return prev;
        return [pendingNotification, ...prev];
      });
      clearPendingNotification();
    }
  }, [pendingNotification, clearPendingNotification]);

  // ─── Load notifications ───────────────────────────────────────────────────
  const loadNotifications = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setError(null);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = offsetRef.current;
      const data = await getNotifications(PAGE_LIMIT, currentOffset);

      const newNotifications = data.notifications;

      setNotifications((prev) => {
        if (reset) return newNotifications;
        // Merge without duplicates (foreground-prepended items may already exist)
        const existingIds = new Set(prev.map((n) => n.id));
        const fresh = newNotifications.filter((n) => !existingIds.has(n.id));
        return [...prev, ...fresh];
      });

      // Sync badge with backend truth
      setUnreadCount(data.unreadCount);

      if (newNotifications.length === PAGE_LIMIT) {
        setHasMore(true);
        offsetRef.current = currentOffset + PAGE_LIMIT;
      } else {
        setHasMore(false);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (!navigator.onLine) {
        setError('No internet connection. Please check your network.');
      } else {
        setError('Failed to load notifications. Please try again.');
      }
      if (reset) setNotifications([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (user) {
      loadNotifications(true);
    } else {
      setLoading(false);
      setNotifications([]);
    }
  }, [user, loadNotifications]);

  // ─── Filter notifications locally for tabs ────────────────────────────────
  const filtered = activeFilter === 'all'
    ? notifications
    : activeFilter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications.filter((n) => n.notification_type === activeFilter);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleMarkRead = async (n) => {
    if (n.is_read) return;
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
    );
    markReadLocally(n.id, true); // decrement badge in context

    try {
      await markNotificationRead(n.id);
    } catch {
      // Revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: false } : x))
      );
      setUnreadCount((prev) => prev + 1);
    }
  };

  const handleMarkAllRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    markAllReadLocally();

    try {
      await markAllRead();
    } catch {
      // Revert by reloading
      loadNotifications(true);
    }
  };

  const handleDelete = async (e, n) => {
    e.stopPropagation();
    const wasUnread = !n.is_read;
    // Optimistic remove
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    deleteLocally(wasUnread); // adjust badge in context

    try {
      await deleteNotification(n.id);
    } catch {
      // Revert by reloading
      loadNotifications(true);
    }
  };

  const handleEnablePush = async () => {
    const result = await registerPushNotifications();
    if (result.supported && result.granted) setPushStatus('granted');
    else if (result.supported && !result.granted) setPushStatus('denied');
    else setPushStatus('unsupported');
  };

  const onItemClick = (n) => {
    handleMarkRead(n);
    handleNotificationClick(n, navigate);
  };

  return (
    <div className="notifications-page layout-container">
      {/* Header */}
      <div className="notifications-header">
        <div className="notifications-title-row">
          <h1>{t('notifications') || 'Notifications'}</h1>
          {unreadCount > 0 && (
            <span className="notifications-badge">{unreadCount}</span>
          )}
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="btn btn-ghost btn-small" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          )}
          <button
            className="btn btn-ghost btn-small"
            onClick={() => loadNotifications(true)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Push notification permission banner */}
      {pushStatus === null && user && (
        <div className="push-banner">
          <span>🔔 Enable push notifications to get alerts about new movies and episodes.</span>
          <button className="btn btn-primary btn-small" onClick={handleEnablePush}>
            Enable
          </button>
        </div>
      )}
      {pushStatus === 'granted' && (
        <div className="push-banner push-banner--success">
          ✅ Push notifications are enabled.
        </div>
      )}
      {pushStatus === 'denied' && (
        <div className="push-banner push-banner--warning">
          ⚠️ Push notifications are blocked. Enable them in your browser settings to receive alerts.
        </div>
      )}
      {pushStatus === 'unsupported' && (
        <div className="push-banner push-banner--warning">
          ℹ️ Your browser does not support push notifications.
        </div>
      )}

      {/* Filter tabs */}
      <div className="notifications-filters">
        {['all', 'unread', NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT, NOTIFICATION_TYPES.NEW_CONTENT, NOTIFICATION_TYPES.PROMOTIONAL].map((f) => (
          <button
            key={f}
            className={`filter-tab${activeFilter === f ? ' active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f === 'all'
              ? 'All'
              : f === 'unread'
              ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`
              : TYPE_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="notifications-loading">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="notification-skeleton" />
          ))}
        </div>
      ) : error ? (
        /* ── Error state ──────────────────────────────────────────────────── */
        <div className="notifications-error">
          <div className="notifications-empty-icon">⚠️</div>
          <p>{error}</p>
          <button
            className="btn btn-primary btn-small"
            onClick={() => loadNotifications(true)}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <div className="notifications-empty">
          <div className="notifications-empty-icon">🔕</div>
          <p>
            No notifications
            {activeFilter !== 'all'
              ? ` in "${activeFilter === 'unread' ? 'Unread' : TYPE_LABELS[activeFilter] || activeFilter}"`
              : ''}{' '}
            yet.
          </p>
          {!user && (
            <p className="notifications-hint">
              <Link to="/login">Log in</Link> to receive notifications.
            </p>
          )}
          {user && (
            <p className="notifications-hint">
              You'll be notified here when there is new activity.
            </p>
          )}
        </div>
      ) : (
        /* ── Notification list ────────────────────────────────────────────── */
        <div className="notifications-list">
          {filtered.map((n) => {
            const nType = n.notification_type || NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT;
            const icon = TYPE_ICONS[nType] || '🔔';
            const label = TYPE_LABELS[nType] || 'Notification';
            const time = formatNotificationTime(n.sent_at || n.created_at);

            return (
              <div
                key={n.id}
                className={`notification-item${n.is_read ? ' read' : ' unread'}`}
                onClick={() => onItemClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onItemClick(n)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', flex: 1 }}>
                  <div className="notification-icon">{icon}</div>
                  <div className="notification-body">
                    <div className="notification-type-label">{label}</div>
                    <div className="notification-title">{n.title || 'New notification'}</div>
                    {n.body && (
                      <div className="notification-message">{n.body}</div>
                    )}
                  </div>
                </div>
                <div
                  className="notification-meta"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}
                >
                  <span className="notification-time">{time}</span>
                  {!n.is_read && <span className="notification-dot" />}
                  <button
                    onClick={(e) => handleDelete(e, n)}
                    className="btn btn-ghost btn-small"
                    style={{ padding: '2px 6px', fontSize: '12px', color: '#ff4d4f' }}
                    aria-label="Delete notification"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="notifications-load-more" style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => loadNotifications(false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
