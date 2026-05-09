/**
 * Central HTTP client: base URL, auth header, refresh on 401.
 * Uses REACT_APP_API_BASE and REACT_APP_API_VERSION from .env
 */

import axios from 'axios';

const apiBase = process.env.REACT_APP_API_BASE ;
const apiVersion = process.env.REACT_APP_API_VERSION || 'v1';
const baseURL = `${apiBase}/api/${apiVersion}`;

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('viewesta_token') || localStorage.getItem('viewesta_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (token ? prom.resolve(token) : prom.reject(error)));
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('viewesta_refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        processQueue(error, null);
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refresh_token: refreshToken });
        const newAccess = data.access_token || data.accessToken;
        if (newAccess) {
          localStorage.setItem('viewesta_token', newAccess);
          if (data.refresh_token) localStorage.setItem('viewesta_refresh_token', data.refresh_token);
          client.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          processQueue(null, newAccess);
          return client(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
export { baseURL };
