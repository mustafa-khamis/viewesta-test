/**
 * Movie/content service — API integration.
 * Connects to backend endpoints for movies, trending, featured content, etc.
 */

import client from '../api/client';
import { normalizeMovie } from '../utils/mediaHelpers';
// Keep mock data as fallback for development/testing
import { mockMovies } from './mockData/movies';
import { mockSeries } from './mockData/series';
import { mockShortFilms } from './mockData/shortFilms';

/**
 * Fetch full movie catalog from backend.
 * GET /movies with params (limit, offset, genre_id, search, sort_by, order).
 */
export async function getMovies(params = {}) {
  try {
    // NOTE: Backend does not support sort_by/order — omit them to avoid 400
    const queryParams = {};
    if (params.category_id) queryParams.category_id = params.category_id;
    if (params.filmmaker_id) queryParams.filmmaker_id = params.filmmaker_id;
    if (params.search) queryParams.search = params.search;
    queryParams.limit = params.limit || 100;
    queryParams.offset = params.offset || 0;

    // Workaround: If no specific status is requested, fetch both approved and pending
    if (!params.status) {
      const [resApproved, resPending] = await Promise.all([
        client.get('/movies', { params: { ...queryParams, status: 'approved' } }).catch(() => ({ data: {} })),
        client.get('/movies', { params: { ...queryParams, status: 'pending' } }).catch(() => ({ data: {} }))
      ]);

      const extractMovies = (res) => {
        if (res.data?.success && res.data?.data) {
          const data = res.data.data;
          if (data.movies && Array.isArray(data.movies)) return data.movies;
          if (Array.isArray(data)) return data;
          if (data.items && Array.isArray(data.items)) return data.items;
        }
        return [];
      };

      const combined = [...extractMovies(resApproved), ...extractMovies(resPending)];
      // Deduplicate
      const uniqueMovies = Array.from(new Map(combined.map(item => [item.id, item])).values());
      return uniqueMovies.map(normalizeMovie);

    } else {
      queryParams.status = params.status;
      const response = await client.get('/movies', {
        params: queryParams,
      });

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        if (data.movies && Array.isArray(data.movies)) return data.movies.map(normalizeMovie);
        if (Array.isArray(data)) return data.map(normalizeMovie);
        if (data.items && Array.isArray(data.items)) return data.items.map(normalizeMovie);
        return [];
      }
      return [];
    }
  } catch (err) {
    console.error('Failed to fetch movies:', err);
    // Fallback to mock data for development
    const { genre, year, sort = 'popular', limit = 100 } = params;
    let list = [...mockMovies, ...mockSeries].map(normalizeMovie);

    if (genre) {
      const g = String(genre).toLowerCase();
      list = list.filter((m) => m.genres.some((x) => String(x).toLowerCase() === g));
    }
    if (year) {
      const y = Number(year);
      if (!Number.isNaN(y)) list = list.filter((m) => Number(m.year) === y);
    }
    if (sort === 'newest') {
      list.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    } else if (sort === 'top_rated') {
      list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }

    return list.slice(0, limit);
  }
}

/**
 * Fetch trending movies from backend.
 * GET /movies/trending
 */
export async function getTrendingMovies(limit = 12) {
  try {
    const response = await client.get('/movies/trending', {
      params: { limit },
    });

    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      
      // Handle response.data.data.movies array
      if (data.movies && Array.isArray(data.movies)) {
        return data.movies.map(normalizeMovie);
      }
      
      // Handle direct array response
      if (Array.isArray(data)) {
        return data.map(normalizeMovie);
      }
      
      // Handle data.items array
      if (data.items && Array.isArray(data.items)) {
        return data.items.map(normalizeMovie);
      }
      
      return [];
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch trending movies:', err);
    // Fallback to mock data
    const trendingMovies = mockMovies.filter((m) => m.trending);
    const trendingSeries = mockSeries.filter((s) => s.trending);
    return [...trendingMovies, ...trendingSeries]
      .map(normalizeMovie)
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
      .slice(0, limit);
  }
}

/**
 * Fetch featured movies from backend (for hero carousel and highlights).
 * GET /movies/featured
 */
export async function getFeaturedMovies(limit = 10) {
  try {
    const response = await client.get('/movies/featured', {
      params: { limit },
    });

    console.log('Featured movies response:', response.data);

    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      
      // Handle response.data.data.movies array
      if (data.movies && Array.isArray(data.movies)) {
        console.log('Found movies in data.movies:', data.movies);
        return data.movies.map(normalizeMovie);
      }
      
      // Handle direct array response
      if (Array.isArray(data)) {
        return data.map(normalizeMovie);
      }
      
      // Handle data.items array
      if (data.items && Array.isArray(data.items)) {
        return data.items.map(normalizeMovie);
      }
      
      return [];
    }
    
    // If response doesn't have expected structure, log and fallback
    console.warn('Featured movies response structure unexpected:', response.data);
    return [];
  } catch (err) {
    console.error('Failed to fetch featured movies:', err);
    // Fallback to mock data
    const featured = mockMovies
      .filter((m) => m.featured)
      .map(normalizeMovie)
      .slice(0, limit);
    
    console.log('Using fallback featured movies:', featured);
    return featured;
  }
}

/**
 * Fetch top rated movies from backend.
 * Uses average_rating strictly — no fallback, no mock data.
 * GET /movies (fetches a larger pool, then filters/sorts client-side on average_rating)
 */
export async function getTopRatedMovies(limit = 12) {
  const response = await client.get('/movies', {
    params: { limit: 100 },
  });

  if (!response.data?.success || !response.data?.data) {
    return [];
  }

  const data = response.data.data;
  let raw = [];

  if (data.movies && Array.isArray(data.movies)) {
    raw = data.movies;
  } else if (Array.isArray(data)) {
    raw = data;
  } else if (data.items && Array.isArray(data.items)) {
    raw = data.items;
  }

  // Strictly filter on average_rating — null/undefined entries are excluded
  return raw
    .filter((m) => m.average_rating !== null && m.average_rating !== undefined)
    .sort((a, b) => Number(b.average_rating) - Number(a.average_rating))
    .slice(0, limit)
    .map(normalizeMovie);
}

/**
 * Fetch new releases.
 * NOTE: Backend does not support sort_by param — returns 400 for any value.
 * We fetch a large pool and sort client-side by release_date descending.
 */
export async function getNewReleases(limit = 12) {
  try {
    // Do NOT pass sort_by or order — backend rejects them with 400
    const response = await client.get('/movies', {
      params: { limit: 100 },
    });

    const data = response.data?.data;

    if (!response.data?.success || !data) {
      return [];
    }

    let raw = [];

    if (Array.isArray(data.movies)) {
      raw = data.movies;
    } else if (Array.isArray(data)) {
      raw = data;
    } else if (Array.isArray(data.items)) {
      raw = data.items;
    }

    // Sort client-side by release_date descending (raw field, before normalizing)
    return raw
      .filter((m) => m.release_date)
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
      .slice(0, limit)
      .map(normalizeMovie);

  } catch (err) {
    console.error('Failed to fetch new releases:', err);
    return [];
  }
}

/**
 * Fetch short films catalog.
 * GET /short-films or /movies?type=short
 */
export async function getShortFilms(params = {}) {
  try {
    // NOTE: Backend does not support sort_by/order — omit them to avoid 400
    const queryParams = {};
    if (params.search) queryParams.search = params.search;
    queryParams.limit = params.limit || 50;
    queryParams.offset = params.offset || 0;

    const response = await client.get('/movies', {
      params: queryParams,
    });

    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      
      if (data.movies && Array.isArray(data.movies)) {
        return data.movies.map(normalizeMovie);
      }
      if (Array.isArray(data)) {
        return data.map(normalizeMovie);
      }
      if (data.items && Array.isArray(data.items)) {
        return data.items.map(normalizeMovie);
      }
      return [];
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch short films:', err);
    // Fallback to mock data
    const { genre, sort = 'popular', limit = 50 } = params;
    let list = [...mockShortFilms].map(normalizeMovie);
    if (genre) {
      const g = String(genre).toLowerCase();
      list = list.filter((m) => m.genres.some((x) => String(x).toLowerCase() === g));
    }
    if (sort === 'newest') {
      list.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    } else if (sort === 'top_rated') {
      list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }
    return list.slice(0, limit);
  }
}

/**
 * Fetch single movie by ID.
 * GET /movies/:id
 */
export async function getMovieById(id) {
  if (!id) return null;
  try {
    const response = await client.get(`/movies/${id}`);

    if (response.data?.success && response.data?.data) {
      return normalizeMovie(response.data.data);
    }
    return null;
  } catch (err) {
    console.error(`Failed to fetch movie ${id}:`, err);
    // Fallback to mock data
    const allContent = [...mockMovies, ...mockShortFilms];
    const raw = allContent.find((m) => String(m.id) === String(id));
    return raw ? normalizeMovie(raw) : null;
  }
}

/**
 * Search movies by query.
 * GET /movies?search=...
 */
export async function searchMovies(query, limit = 20) {
  if (!query || !String(query).trim()) return [];
  try {
    const response = await client.get('/movies', {
      params: {
        search: query,
        limit,
      },
    });

    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      
      if (data.movies && Array.isArray(data.movies)) {
        return data.movies.map(normalizeMovie);
      }
      if (Array.isArray(data)) {
        return data.map(normalizeMovie);
      }
      if (data.items && Array.isArray(data.items)) {
        return data.items.map(normalizeMovie);
      }
      return [];
    }
    return [];
  } catch (err) {
    console.error('Failed to search movies:', err);
    // Fallback to mock data
    const q = String(query).toLowerCase();
    const allContent = [...mockMovies, ...mockShortFilms];
    return allContent
      .filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.director && m.director.toLowerCase().includes(q)) ||
          (m.genres && m.genres.some((g) => String(g).toLowerCase().includes(q)))
      )
      .slice(0, limit)
      .map(normalizeMovie);
  }
}

/**
 * Fetch filmmaker's own movies.
 * GET /movies/filmmaker/movies
 */
export async function getFilmmakerMovies() {
  try {
    const response = await client.get('/movies/filmmaker/movies');
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      if (data.movies && Array.isArray(data.movies)) {
        return data.movies.map(normalizeMovie);
      }
      if (Array.isArray(data)) {
        return data.map(normalizeMovie);
      }
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch filmmaker movies:', err);
    throw err;
  }
}

/**
 * Create a new movie.
 * POST /movies
 */
export async function createMovie(payload) {
  try {
    const response = await client.post('/movies', payload);
    return response.data;
  } catch (err) {
    // Log the full backend error so we can read the exact validation messages
    console.error('Failed to create movie — full backend error:', {
      status: err.response?.status,
      responseData: JSON.stringify(err.response?.data, null, 2),
      sentPayload: JSON.stringify(payload, null, 2),
      message: err.message,
    });
    throw err;
  }
}

/**
 * Update an existing movie.
 * PUT /movies/:id
 */
export async function updateMovie(id, payload) {
  try {
    const response = await client.put(`/movies/${id}`, payload);
    return response.data;
  } catch (err) {
    console.error(`Failed to update movie ${id}:`, err);
    throw err;
  }
}

/**
 * Delete a movie.
 * DELETE /movies/:id
 */
export async function deleteMovie(id) {
  try {
    const response = await client.delete(`/movies/${id}`);
    return response.data;
  } catch (err) {
    console.error(`Failed to delete movie ${id}:`, err);
    throw err;
  }
}

/**
 * Add a video file to an existing movie.
 * POST /movies/:movieId/video-files
 */
export async function addMovieVideoFile(movieId, payload) {
  try {
    const response = await client.post(`/movies/${movieId}/video-files`, payload);
    return response.data;
  } catch (err) {
    console.error(`Failed to add video file to movie ${movieId}:`, err);
    throw err;
  }
}

/**
 * Rate a movie.
 * POST /movies/:id/rate
 */
export async function rateMovie(id, rating) {
  try {
    const response = await client.post(`/movies/${id}/rate`, { rating });
    return response.data;
  } catch (err) {
    console.error(`Failed to rate movie ${id}:`, err);
    throw err;
  }
}

/**
 * Fetch all video files for a movie.
 * GET /movies/:movieId/video-files
 * Returns array of { quality, file_url, duration_seconds, is_processed }
 */
export async function getMovieVideoFiles(movieId) {
  if (!movieId) return [];
  try {
    const response = await client.get(`/movies/${movieId}/video-files`);
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      // Handle nesting: { data: { movie: { video_files: [...] } } }
      const inner = data.movie || data.show || data.series || data;
      
      if (Array.isArray(inner.video_files)) return inner.video_files;
      if (Array.isArray(inner.files)) return inner.files;
      if (Array.isArray(inner)) return inner;
    }
    return [];
  } catch (err) {
    console.error(`getMovieVideoFiles(${movieId}):`, err?.message);
    return [];
  }
}

/**
 * Fetch related movies for a given movie.
 * GET /movies/:movieId/related
 */
export async function getRelatedMovies(movieId, limit = 6) {
  if (!movieId) return [];
  try {
    const response = await client.get(`/movies/${movieId}/related`, { params: { limit } });
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      const raw = Array.isArray(data.movies) ? data.movies
        : Array.isArray(data) ? data
        : Array.isArray(data.items) ? data.items : [];
      return raw.map(normalizeMovie);
    }
    return [];
  } catch (err) {
    console.error(`getRelatedMovies(${movieId}):`, err?.message);
    return [];
  }
}
