/**
 * Auth context — mock auth (local only). API-ready: swap login/register with apiClient when backend is available.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';
import { registerUser } from '../utils/apiClient.js';
import { loginUser } from '../utils/apiClient';
import { getCurrentUser, updateUserProfile, changePassword as apiChangePassword } from '../utils/apiClient.js';

const AuthContext = createContext();
const USER_KEY = 'viewesta_user';

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((rawUser) => {
    if (rawUser) {
      const u = {
        ...rawUser,
        role: rawUser.user_role || rawUser.role || rawUser.user_type || 'viewer',
        purchasedMovies: rawUser.purchasedMovies || [],
        watchHistory: rawUser.watchHistory || [],
        watchlist: rawUser.watchlist || [],
        followedFilmmakers: rawUser.followedFilmmakers || [],
      };
      setUser(u);
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } catch {}
      return u;
    }
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    return null;
  }, []);


// I changed this useEffect so it will check the auth status by calling the getCurrentUser endpoint
// it run after login, register, and start of the app or refreshing the page 

 useEffect(() => {
  const initAuth = async () => {
    try {
      const token = localStorage.getItem('viewesta_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await getCurrentUser();
      const fetchedUser = res.data?.data?.user || res.data?.data || res.data?.user || res.data;
      persistUser(fetchedUser);
    } catch (err) {
      console.log('Auth check failed:', err.message);

      localStorage.removeItem('viewesta_token');
      localStorage.removeItem(USER_KEY);
    } finally {
      setLoading(false);
    }
  };
  initAuth();
}, []);


// I edited the login function to use the apiclient insted of Mock loing of authService
const login = async (email, password) => {
  try {
    const res = await loginUser({ email, password });

    // the correct data based on the backend 
    const user = res.data?.data?.user || res.data?.data || res.data?.user || res.data;
    const token = res.data?.data?.token || res.data?.token;

    if (token) {
      localStorage.setItem('viewesta_token', token);
    }

    persistUser(user);

    return { success: true, user };

  } catch (err) {
    const safeMessage =
      err.message?.toLowerCase().includes('password')
        ? 'Invalid email or password'
        : err.message?.toLowerCase().includes('email')
        ? 'Invalid email'
        : 'Something went wrong, please try again';

    return {
      success: false,
      error: safeMessage,
    };
  }
};

  // I have eited the register function to use the apiClient registerUser function

const register = async (data) => {
  try {
    const res = await registerUser(data);

    // the correct data based on the backend response 
    const user = res.data?.data?.user || res.data?.data || res.data?.user || res.data;
    const token = res.data?.data?.token || res.data?.token;

    if (token) {
      localStorage.setItem('viewesta_token', token);
    }

    persistUser(user);

    return { success: true, user };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
};


  const logout = () => {
    persistUser(null);
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Not logged in' };
    
    // Extract first_name and last_name as required by the backend
    const payload = {
      first_name: updates.first_name || user.first_name || '',
      last_name: updates.last_name || user.last_name || '',
    };
    
    // Optimistic UI update
    const previousUser = { ...user };
    const updated = { ...user, ...updates };
    persistUser(updated);

    try {
      const res = await updateUserProfile(payload);
      
      // Update with exact backend representation if available
      const backendUser = res.data?.data?.user || res.data?.data || res.data || {};
      const fullySyncedUser = { ...updated, ...backendUser };
      
      persistUser(fullySyncedUser);
      return { success: true, user: fullySyncedUser };
    } catch (err) {
      // Revert optimistic update
      persistUser(previousUser);
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await apiChangePassword({ current_password: currentPassword, new_password: newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to change password' };
    }
  };

  const updateWallet = (amount) => {
    if (!user) return;
    const updated = {
      ...user,
      wallet: { ...user.wallet, balance: Number(user.wallet.balance) + amount },
    };
    persistUser(updated);
  };

  const purchaseMovie = (movieId, price) => {
    if (!user) return { success: false, error: 'Please log in first.' };
    const balance = Number(user.wallet.balance);
    const p = Number(price);
    if (balance < p) return { success: false, error: 'Insufficient balance' };
    const updated = {
      ...user,
      wallet: { ...user.wallet, balance: balance - p },
      purchasedMovies: [...(user.purchasedMovies || []), String(movieId)],
    };
    persistUser(updated);
    return { success: true };
  };

  const value = {
    user,
    loading,
    login,
    register,
    socialLogin: async () => ({ success: false, error: 'Social login is not available yet.' }),
    logout,
    updateProfile,
    changePassword,
    updateWallet,
    purchaseMovie,
    refreshProfile: () => user && persistUser(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
