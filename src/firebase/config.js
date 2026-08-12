import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// ─── Firebase App Singleton ───────────────────────────────────────────────────
// Guard against re-initialising during hot-reloads or multiple imports.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Firebase Messaging Singleton ─────────────────────────────────────────────
// Lazily initialised once; subsequent calls return the cached instance.
let _messagingInstance = null;
let _initInProgress = false;
let _initPromise = null;

export const initializeMessaging = async () => {
  // Return cached instance immediately
  if (_messagingInstance) return _messagingInstance;

  // Prevent concurrent init calls from racing
  if (_initInProgress) return _initPromise;

  _initInProgress = true;
  _initPromise = (async () => {
    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn('[Firebase] Messaging is not supported in this browser.');
        return null;
      }
      _messagingInstance = getMessaging(app);
      return _messagingInstance;
    } catch (err) {
      console.error('[Firebase] Error initialising Firebase Messaging:', err);
      return null;
    } finally {
      _initInProgress = false;
    }
  })();

  return _initPromise;
};

export { app };
