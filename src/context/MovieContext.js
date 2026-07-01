/**
 * Movie/Content context — mock data via movieService. API-ready: swap service calls for apiClient when backend is available.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import * as movieService from '../services/movieService';
import * as seriesService from '../services/seriesService';
import * as watchlistService from '../services/watchlistService';
import * as paymentService from '../services/paymentService';
import {
  coerceMovieId,
  coerceArray,
} from '../utils/mediaHelpers';

const MovieContext = createContext();
const RATINGS_KEY = 'viewesta_ratings';
const DOWNLOADS_KEY = 'viewesta_downloads';

export const useMovies = () => {
  const context = useContext(MovieContext);
  if (!context) throw new Error('useMovies must be used within a MovieProvider');
  return context;
};

export const MovieProvider = ({ children }) => {
  const { user } = useAuth();
  const [movies, setMovies] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [purchasedMovies, setPurchasedMovies] = useState([]);
  const [isSyncingLists] = useState(false);
  const [userRatings, setUserRatings] = useState(() => {
    try {
      const raw = localStorage.getItem(RATINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [downloads, setDownloads] = useState(() => {
    try {
      const raw = localStorage.getItem(DOWNLOADS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, trending, featured, newRel, topRated] = await Promise.all([
        movieService.getMovies({ limit: 100 }),
        movieService.getTrendingMovies(24),
        movieService.getFeaturedMovies(10),
        movieService.getNewReleases(10),
        movieService.getTopRatedMovies(12),
      ]);
      setMovies(catalog);
      setTrendingMovies(trending);
      setFeaturedMovies(featured);
      setNewReleases(newRel);
      setTopRatedMovies(topRated);
    } catch (err) {
      console.error('Failed to load catalog', err);
      setError(err.message || 'Unable to load movies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // Fetch real watchlist from backend on login
  useEffect(() => {
    if (!user) {
      setWatchlist([]);
      setFavorites([]);
      return;
    }
    const fetchWatchlist = async () => {
      try {
        const items = await watchlistService.getWatchlist();
        setWatchlist(items.map((item) => String(item.id)));
      } catch (err) {
        console.error('Failed to load watchlist:', err);
      }
    };
    fetchWatchlist();

    const fetchPurchases = async () => {
      try {
        const purchasesData = await paymentService.getPurchases();
        // Support all three backend response shapes:
        //   1. { data: { purchases: [...] } }  ← real backend response
        //   2. { data: [...] }                  ← flat-data envelope
        //   3. [...]                            ← bare array
        const items = Array.isArray(purchasesData?.data?.purchases) ? purchasesData.data.purchases :
                      Array.isArray(purchasesData?.data)            ? purchasesData.data :
                      Array.isArray(purchasesData)                  ? purchasesData :
                      [];
        // Safely extract movie IDs based on potential structures, supporting flat arrays
        const ids = items.map(p => {
          if (typeof p === 'string' || typeof p === 'number') return String(p);
          return String(p?.movie_id || p?.movieId || p?.movie?.id || p?.id);
        }).filter(id => id && id !== 'undefined' && id !== 'null');
        setPurchasedMovies(ids);
      } catch (err) {
        console.error('Failed to load purchases:', err);
        // Temporary fallback: use user.purchasedMovies if API fails
        if (user.purchasedMovies && Array.isArray(user.purchasedMovies)) {
          setPurchasedMovies(user.purchasedMovies.map(String));
        }
      }
    };
    fetchPurchases();

    const fav = coerceArray(user.favorites || []).map((id) => (typeof id === 'object' ? coerceMovieId(id) : String(id))).filter(Boolean);
    setFavorites(fav);
  }, [user]);

  const mutateWatchlist = useCallback(
    async (movieId, action) => {
      if (!user) return { success: false, error: 'Please log in first.' };
      
      const strId = String(movieId);
      // Optimistic UI update
      if (action === 'add') {
        setWatchlist((prev) => (prev.includes(strId) ? prev : [...prev, strId]));
      } else {
        setWatchlist((prev) => prev.filter((id) => id !== strId));
      }
      
      try {
        if (action === 'add') {
          await watchlistService.addToWatchlist(movieId);
        } else {
          await watchlistService.removeFromWatchlist(movieId);
        }
        return { success: true };
      } catch (err) {
        // Revert on error
        if (action === 'add') {
          setWatchlist((prev) => prev.filter((id) => id !== strId));
        } else {
          setWatchlist((prev) => (prev.includes(strId) ? prev : [...prev, strId]));
        }
        return { success: false, error: 'Failed to update watchlist.' };
      }
    },
    [user]
  );

  const mutateFavorites = useCallback(
    async (movieId, action) => {
      if (!user) return { success: false, error: 'Please log in first.' };
      if (action === 'add') {
        setFavorites((prev) => (prev.includes(movieId) ? prev : [...prev, movieId]));
      } else {
        setFavorites((prev) => prev.filter((id) => id !== movieId));
      }
      // TODO: API - POST/DELETE /favorites/:id
      return { success: true };
    },
    [user]
  );

  const getMovieById = useCallback(
    (id) => {
      if (!id) return undefined;
      return movies.find((m) => String(m.id) === String(id));
    },
    [movies]
  );

  const searchMovies = useCallback(
    (query) => {
      if (!query) return movies;
      const q = String(query).toLowerCase();
      return movies.filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.genres && m.genres.some((g) => String(g).toLowerCase().includes(q))) ||
          (m.director && m.director.toLowerCase().includes(q))
      );
    },
    [movies]
  );

  const getMoviesByGenre = useCallback(
    (genre) => {
      if (!genre) return movies;
      const norm = String(genre).toLowerCase();
      return movies.filter((m) =>
        m.genres && m.genres.some((g) => String(g).toLowerCase() === norm)
      );
    },
    [movies]
  );

  const addToWatchlist = useCallback((movieId) => mutateWatchlist(movieId, 'add'), [mutateWatchlist]);
  const removeFromWatchlist = useCallback((movieId) => mutateWatchlist(movieId, 'remove'), [mutateWatchlist]);
  const addToFavorites = useCallback((movieId) => mutateFavorites(movieId, 'add'), [mutateFavorites]);
  const removeFromFavorites = useCallback((movieId) => mutateFavorites(movieId, 'remove'), [mutateFavorites]);

  const rateContent = useCallback(async (contentId, rating) => {
    const num = Math.min(5, Math.max(1, Number(rating)));
    if (!contentId || Number.isNaN(num)) return;
    
    // Optimistic update
    setUserRatings((prev) => {
      const next = { ...prev, [String(contentId)]: num };
      try {
        localStorage.setItem(RATINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      // Determine if it's a movie or show by checking our loaded movies catalog
      const isMovie = movies.some((m) => String(m.id) === String(contentId));
      if (isMovie) {
        await movieService.rateMovie(contentId, num);
      } else {
        await seriesService.rateShow(contentId, num);
      }
    } catch (err) {
      console.error('Failed to save rating to backend:', err);
    }
  }, [movies]);

  const getUserRating = useCallback(
    (contentId) => (contentId ? userRatings[String(contentId)] : undefined),
    [userRatings]
  );

  const addToDownloads = useCallback((contentId) => {
    if (!contentId) return;
    setDownloads((prev) => {
      const id = String(contentId);
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    // TODO: API - POST /downloads/:id
  }, []);

  const rateMovie = rateContent;

  const getRecommendations = useCallback(() => {
    return [...trendingMovies, ...featuredMovies].slice(0, 6);
  }, [trendingMovies, featuredMovies]);

  const value = useMemo(
    () => ({
      movies,
      trendingMovies,
      featuredMovies,
      newReleases,
      topRatedMovies,
      loading,
      error,
      watchlist,
      favorites,
      purchasedMovies,
      isSyncingLists,
      userRatings,
      downloads,
      getMovieById,
      searchMovies,
      getMoviesByGenre,
      addToWatchlist,
      removeFromWatchlist,
      mutateWatchlist,
      addToFavorites,
      removeFromFavorites,
      rateMovie,
      rateContent,
      getUserRating,
      addToDownloads,
      getRecommendations,
      refreshCatalog,
      refreshWatchlist: () => {},
      refreshFavorites: () => {},
    }),
    [
      movies,
      trendingMovies,
      featuredMovies,
      newReleases,
      topRatedMovies,
      loading,
      error,
      watchlist,
      favorites,
      purchasedMovies,
      isSyncingLists,
      userRatings,
      downloads,
      getMovieById,
      searchMovies,
      getMoviesByGenre,
      addToWatchlist,
      removeFromWatchlist,
      mutateWatchlist,
      addToFavorites,
      removeFromFavorites,
      rateContent,
      getUserRating,
      addToDownloads,
      getRecommendations,
      refreshCatalog,
    ]
  );

  return <MovieContext.Provider value={value}>{children}</MovieContext.Provider>;
};
