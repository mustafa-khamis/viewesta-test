import axios from 'axios';

const defaultBaseUrl = 'http://localhost:3000/api/v1';


const API_BASE = process.env.REACT_APP_API_BASE;
const API_VERSION = process.env.REACT_APP_API_VERSION || 'v1';

const normalizedBaseUrl = (() => {
  if (!API_BASE) return defaultBaseUrl;

  const trimmed = API_BASE.trim().replace(/\/$/, '');

  return `${trimmed}/api/${API_VERSION}`;
})();

export const API_BASE_URL = normalizedBaseUrl;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // to prevent hanging requests
});

// I add this interceptor to automaticly attach the token to every request if it exists
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('viewesta_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


 //Response interceptor → unified error handling

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message:
        error?.response?.data?.message ||
        error.message ||
        'Something went wrong',
      status: error?.response?.status,
      data: error?.response?.data,
    };

    // optional: auto logout on 401
    if (customError.status === 401) {
      localStorage.removeItem('viewesta_token');
      localStorage.removeItem('viewesta_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(customError);
  }
);

/**
 * Health check endpoint
 */
export const healthCheck = () => apiClient.get('/health');

/**
 * Generic helpers (optional but very useful)
 */
export const get = (url, config = {}) => apiClient.get(url, config);

export const post = (url, data = {}, config = {}) =>
  apiClient.post(url, data, config);

export const put = (url, data = {}, config = {}) =>
  apiClient.put(url, data, config);

export const del = (url, config = {}) =>
  apiClient.delete(url, config);

export const registerUser = (data) =>
  post('/auth/register', data);

export const loginUser = (data) =>
  post('/auth/login', data);

export const getCurrentUser = () =>
  get('/auth/me');

export const updateUserProfile = (data) =>
  put('/auth/profile', data);

export const changePassword = (data) =>
  post('/auth/change-password', data);

export default apiClient;