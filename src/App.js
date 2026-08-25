import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import ScrollToTop from './components/ScrollToTop';
import ViewerLayout from './layouts/ViewerLayout';
import FilmmakerStudioLayout from './layouts/FilmmakerStudioLayout';
import ProtectedRoute from './components/ProtectedRoute';
import FilmmakerRoute from './components/FilmmakerRoute';
import RedirectFilmmakerToStudio from './components/RedirectFilmmakerToStudio';

import Home from './pages/Home';
import Movies from './pages/Movies';
import MovieDetail from './pages/MovieDetail';
import Series from './pages/Series';
import SeriesDetail from './pages/SeriesDetail';
import Watchlist from './pages/Watchlist';
import Downloads from './pages/Downloads';
import Subscription from './pages/Subscription';
import Wallet from './pages/Wallet';
import Search from './pages/Search';
import Genre from './pages/Genre';
import Genres from './pages/Genres';
import Watch from './pages/Watch';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Contact from './pages/Contact';
import Help from './pages/Help';
import Notifications from './pages/Notifications';
import EditProfile from './pages/EditProfile';
import Following from './pages/Following';
import FilmmakerPublicProfile from './pages/FilmmakerPublicProfile';
import ShortFilms from './pages/ShortFilms';
import AdminApproval from './pages/admin/AdminApproval';
import PaymentCallback from './pages/PaymentCallback';

import FilmmakerDashboard from './pages/filmmaker/FilmmakerDashboard';
import FilmmakerMyMovies from './pages/filmmaker/FilmmakerMyMovies';
import FilmmakerUpload from './pages/filmmaker/FilmmakerUpload';
import FilmmakerEarnings from './pages/filmmaker/FilmmakerEarnings';
import FilmmakerFollowers from './pages/filmmaker/FilmmakerFollowers';
import FilmmakerViews from './pages/FilmmakerViews';
import FilmmakerStudioProfile from './pages/FilmmakerStudioProfile';
import EarningsDetail from './pages/EarningsDetail';

import { AuthProvider } from './context/AuthContext';
import { MovieProvider } from './context/MovieContext';
import { ThemeProvider } from './context/ThemeContext';

import { LocaleProvider } from './context/LocaleContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { onForegroundMessage, markNotificationRead } from './services/notificationService';

// ─── Foreground Notification Handler ─────────────────────────────────────────
// Lives inside NotificationProvider so it can call useNotification().
function ForegroundNotificationHandler() {
  const { prependNotification, markReadLocally } = useNotification();
  const seenToastIdsRef = useRef(new Set());

  // Listen for BACKGROUND messages forwarded by the Service Worker
  useEffect(() => {
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'BACKGROUND_FCM') {
        const payload = event.data.payload;
        const title = payload.notification?.title || 'New Notification';
        const body = payload.notification?.body || '';
        const notificationId = payload.data?.notificationId || null;
        const toastId = notificationId || `${title}:${body}`;

        if (!seenToastIdsRef.current.has(toastId) && document.visibilityState === 'visible') {
          seenToastIdsRef.current.add(toastId);
          setToastNotif({ id: notificationId, title, body, actionUrl: payload.data?.action_url || null });
        }

        const newNotif = {
          id: notificationId || `bg-${Date.now()}`,
          title,
          body,
          notification_type: payload.data?.type || 'system_announcement',
          data: payload.data || {},
          is_read: false,
          is_sent: true,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          read_at: null,
        };
        prependNotification(newNotif);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, [prependNotification]);

  const [toastNotif, setToastNotif] = useState(null);

  // Clear toast after a few seconds
  useEffect(() => {
    if (toastNotif) {
      const timer = setTimeout(() => setToastNotif(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotif]);

  // Listen for FOREGROUND messages
  useEffect(() => {
    let unsubFn;

    const setup = async () => {
      unsubFn = await onForegroundMessage((payload) => {
        const title = payload.notification?.title || 'New Notification';
        const body = payload.notification?.body || '';
        const actionUrl = payload.data?.action_url || null;
        const notificationId = payload.data?.notificationId || null;

        // 1. Show native browser notification (when app is in foreground)
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const opts = {
              body,
              icon: '/logo192.png',
              badge: '/logo192.png',
              tag: notificationId || title, // deduplicate by ID
              data: { action_url: actionUrl },
            };
            const browserNotif = new Notification(title, opts);
            browserNotif.onclick = () => {
              window.focus();
              if (notificationId) {
                markReadLocally(notificationId, true);
                markNotificationRead(notificationId).catch(console.warn);
              }
              const target = actionUrl && actionUrl.startsWith('/') ? actionUrl : '/notifications';
              window.location.href = target;
              browserNotif.close();
            };
          } catch (e) {
            console.warn('[App] Could not show browser notification:', e);
          }
        }

        // Show in-app toast
        setToastNotif({ id: notificationId, title, body, actionUrl });

        // 2. Update in-app notification list + badge
        const newNotif = {
          id: notificationId || `fg-${Date.now()}`,
          title,
          body,
          notification_type: payload.data?.type || 'system_announcement',
          data: payload.data || {},
          is_read: false,
          is_sent: true,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          read_at: null,
        };
        prependNotification(newNotif);
      });
    };

    setup();

    return () => {
      if (typeof unsubFn === 'function') unsubFn();
    };
  }, [markReadLocally, prependNotification]);

  if (!toastNotif) return null;

  return (
    <div 
      className="app-toast-notification"
      onClick={() => {
        if (toastNotif.id) {
          markReadLocally(toastNotif.id, true);
          markNotificationRead(toastNotif.id).catch(console.warn);
        }
        if (toastNotif.actionUrl) {
          window.location.href = toastNotif.actionUrl.startsWith('/') ? toastNotif.actionUrl : '/notifications';
        }
        setToastNotif(null);
      }}
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 9999,
        cursor: 'pointer',
        maxWidth: '300px',
        color: 'var(--text-primary)',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
        <span>{toastNotif.title}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); setToastNotif(null); }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
        >
          &times;
        </button>
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{toastNotif.body}</div>
    </div>
  );
}

// ─── App Routes ───────────────────────────────────────────────────────────────
function AppRoutes() {
  // ── Register service worker once ────────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const params = new URLSearchParams();
      [
        ['apiKey', process.env.REACT_APP_FIREBASE_API_KEY],
        ['projectId', process.env.REACT_APP_FIREBASE_PROJECT_ID],
        ['messagingSenderId', process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID],
        ['appId', process.env.REACT_APP_FIREBASE_APP_ID],
        ['authDomain', process.env.REACT_APP_FIREBASE_AUTH_DOMAIN],
        ['storageBucket', process.env.REACT_APP_FIREBASE_STORAGE_BUCKET],
      ].forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      navigator.serviceWorker
        .register(`/firebase-messaging-sw.js?${params.toString()}`)
        .catch((err) => console.warn('[App] Service worker registration failed:', err));
    }
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <div className="App">
        <a href="#main-content" className="skip-to-main">Skip to main content</a>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route element={<ViewerLayout />}>
            <Route path="/" element={<RedirectFilmmakerToStudio><Home /></RedirectFilmmakerToStudio>} />
            <Route path="/watch" element={<Movies />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/series" element={<Series />} />
            <Route path="/genres" element={<Genres />} />
            <Route path="/genre/:name" element={<Genre />} />
            <Route path="/search" element={<Search />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/help" element={<Help />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/film/:id" element={<MovieDetail />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/show/:id" element={<SeriesDetail />} />
            <Route path="/series/:id" element={<SeriesDetail />} />
            <Route path="/filmmaker/:id" element={<FilmmakerPublicProfile />} />
            <Route path="/short-films" element={<ShortFilms />} />
            <Route path="/admin/approval" element={<ProtectedRoute><AdminApproval /></ProtectedRoute>} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/following" element={<ProtectedRoute><Following /></ProtectedRoute>} />
            <Route path="/payment-callback" element={<ProtectedRoute><PaymentCallback /></ProtectedRoute>} />
            <Route path="/filmmaker-followers" element={<FilmmakerRoute><FilmmakerFollowers /></FilmmakerRoute>} />
            <Route path="/filmmaker-views" element={<FilmmakerRoute><FilmmakerViews /></FilmmakerRoute>} />
            <Route path="/earnings-detail" element={<FilmmakerRoute><EarningsDetail /></FilmmakerRoute>} />
          </Route>

          <Route path="/filmmaker-studio" element={<FilmmakerRoute><FilmmakerStudioLayout /></FilmmakerRoute>}>
            <Route index element={<FilmmakerDashboard />} />
            <Route path="movies" element={<FilmmakerMyMovies />} />
            <Route path="upload" element={<FilmmakerUpload />} />
            <Route path="earnings" element={<FilmmakerEarnings />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<FilmmakerStudioProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <NotificationProvider>
            {/* Handles foreground FCM messages — must be inside NotificationProvider */}
            <ForegroundNotificationHandler />
            <MovieProvider>
              <AppRoutes />
            </MovieProvider>
          </NotificationProvider>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export default App;
