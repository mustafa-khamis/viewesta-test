import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications, markNotificationRead, markAllRead,
  getLocalNotifications, markLocalNotificationRead, clearLocalNotifications,
  registerPushNotifications, formatNotificationTime, NOTIFICATION_TYPES,
} from '../services/notificationService';
import './Notifications.css';

const TYPE_ICONS = {
  [NOTIFICATION_TYPES.NEW_MOVIE]: '🎬',
  [NOTIFICATION_TYPES.NEW_EPISODE]: '📺',
  [NOTIFICATION_TYPES.SYSTEM]: '🔔',
  [NOTIFICATION_TYPES.TARGETED]: '⭐',
};

const TYPE_LABELS = {
  [NOTIFICATION_TYPES.NEW_MOVIE]: 'New Movie',
  [NOTIFICATION_TYPES.NEW_EPISODE]: 'New Episode',
  [NOTIFICATION_TYPES.SYSTEM]: 'System',
  [NOTIFICATION_TYPES.TARGETED]: 'For You',
};

export default function Notifications() {
  const { t } = useLocale();
  const { user } = useAuth();

  const [apiNotifications, setApiNotifications] = useState([]);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // ─── Load notifications ───────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [api, local] = await Promise.all([
        getNotifications(),
        Promise.resolve(getLocalNotifications()),
      ]);
      setApiNotifications(api);
      setLocalNotifications(local);
    } catch {
      setApiNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // ─── Merge and sort all notifications ────────────────────────────────────
  const allNotifications = [
    ...apiNotifications.map((n) => ({ ...n, _source: 'api' })),
    ...localNotifications.map((n) => ({ ...n, _source: 'local' })),
  ].sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));

  const filtered = activeFilter === 'all'
    ? allNotifications
    : activeFilter === 'unread'
    ? allNotifications.filter((n) => !n.read && !n.is_read)
    : allNotifications.filter((n) => n.type === activeFilter);

  const unreadCount = allNotifications.filter((n) => !n.read && !n.is_read).length;

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleMarkRead = async (n) => {
    if (n._source === 'api') {
      await markNotificationRead(n.id);
      setApiNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    } else {
      markLocalNotificationRead(n.id);
      setLocalNotifications(getLocalNotifications());
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setApiNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    clearLocalNotifications();
    setLocalNotifications([]);
  };

  const handleEnablePush = async () => {
    const result = await registerPushNotifications();
    if (result.supported && result.granted) setPushStatus('granted');
    else if (result.supported && !result.granted) setPushStatus('denied');
    else setPushStatus('unsupported');
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
          <button className="btn btn-ghost btn-small" onClick={loadNotifications}>
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
          ⚠️ Push notifications are blocked. Enable them in your browser settings.
        </div>
      )}

      {/* Filter tabs */}
      <div className="notifications-filters">
        {['all', 'unread', NOTIFICATION_TYPES.NEW_MOVIE, NOTIFICATION_TYPES.NEW_EPISODE, NOTIFICATION_TYPES.SYSTEM].map((f) => (
          <button
            key={f}
            className={`filter-tab${activeFilter === f ? ' active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : TYPE_LABELS[f] || f}
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
      ) : filtered.length === 0 ? (
        <div className="notifications-empty">
          <div className="notifications-empty-icon">🔕</div>
          <p>No notifications{activeFilter !== 'all' ? ` in "${activeFilter === 'unread' ? 'Unread' : TYPE_LABELS[activeFilter] || activeFilter}"` : ''} yet.</p>
          {!user && (
            <p className="notifications-hint">
              <Link to="/login">Log in</Link> to receive notifications about new movies and episodes.
            </p>
          )}
          {user && (
            <p className="notifications-hint">
              You'll be notified here when new movies or episodes are published.
            </p>
          )}
        </div>
      ) : (
        <div className="notifications-list">
          {filtered.map((n) => {
            const isRead = n.read || n.is_read;
            const nType = n.type || NOTIFICATION_TYPES.SYSTEM;
            const icon = TYPE_ICONS[nType] || '🔔';
            const label = TYPE_LABELS[nType] || 'Notification';
            const time = formatNotificationTime(n.timestamp || n.created_at);

            return (
              <div
                key={`${n._source}-${n.id}`}
                className={`notification-item${isRead ? ' read' : ' unread'}`}
                onClick={() => !isRead && handleMarkRead(n)}
              >
                <div className="notification-icon">{icon}</div>
                <div className="notification-body">
                  <div className="notification-type-label">{label}</div>
                  <div className="notification-title">{n.title || n.subject || 'New notification'}</div>
                  {n.message || n.body ? (
                    <div className="notification-message">{n.message || n.body}</div>
                  ) : null}
                  {n.content_id && (
                    <Link
                      to={nType === NOTIFICATION_TYPES.NEW_EPISODE ? `/series/${n.show_id || n.series_id}` : `/movie/${n.content_id}`}
                      className="notification-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View →
                    </Link>
                  )}
                </div>
                <div className="notification-meta">
                  <span className="notification-time">{time}</span>
                  {!isRead && <span className="notification-dot" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
