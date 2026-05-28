/**
 * Series service — Backend API integration.
 * Connects to backend endpoints: GET /series, GET /series/:id, etc.
 * No mock data fallback — data comes exclusively from the live backend.
 */

import client from '../api/client';
import { normalizeSeries } from '../utils/mediaHelpers';
import { mockSeries } from './mockData/series'; // used only by helper functions, NOT getSeries

// ─── helper: parse any response shape the backend might return ───────────────
function extractList(data) {
  if (!data) return [];
  if (data.series && Array.isArray(data.series)) return data.series;
  if (data.movies && Array.isArray(data.movies)) return data.movies; // some backends reuse the movies key
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Fetch full series catalog from the backend.
 * GET /series   (params: limit, offset, search)
 *
 * Throws a clean, user-friendly Error on any failure (network error, 4xx, 5xx).
 * Raw backend messages are never propagated to the caller.
 */
export async function getSeries(params = {}) {
  try {
    const queryParams = {};
    if (params.search) queryParams.search = params.search;
    queryParams.limit  = params.limit  || 20;
    queryParams.offset = params.offset || 0;
    // Omit sort_by and order to avoid 400 error from backend

    const response = await client.get('/shows', { params: queryParams });

    if (response.data?.success && response.data?.data) {
      const raw = extractList(response.data.data);
      return raw.map(normalizeSeries);
    }

    // Successful HTTP response but unexpected/empty shape
    return [];
  } catch (err) {
    // Log the real error for debugging — never expose it to the UI
    console.error('getSeries failed:', err?.response?.status, err?.message);
    throw new Error('Something went wrong while loading series. Please try again later.');
  }
}

/**
 * Fetch a single series by ID.
 * GET /series/:id
 */
export async function getSeriesById(id) {
  if (!id) return null;
  try {
    const response = await client.get(`/shows/${id}`);

    if (response.data?.success && response.data?.data) {
      return normalizeSeries(response.data.data);
    }
    return null;
  } catch (err) {
    console.error(`getSeriesById(${id}): backend unavailable, using mock data.`, err?.message);
    const raw = mockSeries.find((s) => String(s.id) === String(id));
    return raw ? normalizeSeries(raw) : null;
  }
}

/**
 * Fetch featured series (for hero/carousel sections).
 * GET /series/featured   — falls back to GET /series then filters client-side.
 */
export async function getFeaturedSeries(limit = 10) {
  try {
    // Try a dedicated featured endpoint first
    try {
      const response = await client.get('/shows/featured', { params: { limit } });
      if (response.data?.success && response.data?.data) {
        const raw = extractList(response.data.data);
        if (raw.length > 0) return raw.map(normalizeSeries).slice(0, limit);
      }
    } catch {
      // endpoint may not exist — fall through to general list
    }

    // Fallback: fetch all series and filter by featured flag
    const all = await getSeries({ limit: 50 });
    const featured = all.filter((s) => s.featured);
    return featured.length ? featured.slice(0, limit) : all.slice(0, limit);
  } catch (err) {
    console.error('getFeaturedSeries: error.', err?.message);
    return mockSeries
      .filter((s) => s.featured)
      .map(normalizeSeries)
      .slice(0, limit);
  }
}

/**
 * Fetch trending series.
 * GET /series/trending   — falls back to GET /series then sorts by trending flag.
 */
export async function getTrendingSeries(limit = 12) {
  try {
    // Try a dedicated trending endpoint first
    try {
      const response = await client.get('/shows/trending', { params: { limit } });
      if (response.data?.success && response.data?.data) {
        const raw = extractList(response.data.data);
        if (raw.length > 0) return raw.map(normalizeSeries).slice(0, limit);
      }
    } catch {
      // endpoint may not exist — fall through to general list
    }

    // Fallback: fetch all series and sort by trending
    const all = await getSeries({ limit: 50 });
    const trending = all.filter((s) => s.trending);
    return trending.length ? trending.slice(0, limit) : all.slice(0, limit);
  } catch (err) {
    console.error('getTrendingSeries: error.', err?.message);
    return mockSeries
      .filter((s) => s.trending)
      .map(normalizeSeries)
      .slice(0, limit);
  }
}

/**
 * Search series by query string.
 * GET /series?search=...
 */
export async function searchSeries(query, limit = 20) {
  if (!query || !String(query).trim()) return [];
  try {
    const response = await client.get('/shows', {
      params: { search: String(query).trim(), limit },
    });

    if (response.data?.success && response.data?.data) {
      const raw = extractList(response.data.data);
      if (raw.length > 0) return raw.map(normalizeSeries);
    }
    return [];
  } catch (err) {
    console.error('searchSeries: backend unavailable, using mock data.', err?.message);
    const q = String(query).toLowerCase();
    return mockSeries
      .filter(
        (s) =>
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.director && s.director.toLowerCase().includes(q)) ||
          (s.genres && s.genres.some((g) => String(g).toLowerCase().includes(q)))
      )
      .slice(0, limit)
      .map(normalizeSeries);
  }
}

/**
 * Create a new show (series).
 * POST /shows
 */
export async function createShow(payload) {
  try {
    const response = await client.post('/shows', payload);
    return response.data;
  } catch (err) {
    console.error('Failed to create show:', err);
    throw err;
  }
}
export async function rateShow(id, rating) {
  try {
    const response = await client.post(`/shows/${id}/rate`, { rating });
    return response.data;
  } catch (err) {
    console.error(`Failed to rate show ${id}:`, err);
    throw err;
  }
}

export async function viewShow(id) {
  try {
    const response = await client.post(`/shows/${id}/view`);
    return response.data;
  } catch (err) {
    console.error(`Failed to record view for show ${id}:`, err);
    throw err;
  }
}

export async function saveShow(id) {
  try {
    const response = await client.post(`/shows/${id}/save`);
    return response.data;
  } catch (err) {
    console.error(`Failed to save show ${id}:`, err);
    throw err;
  }
}

export async function unsaveShow(id) {
  try {
    const response = await client.delete(`/shows/${id}/save`);
    return response.data;
  } catch (err) {
    console.error(`Failed to unsave show ${id}:`, err);
    throw err;
  }
}

export async function likeShow(id) {
  try {
    const response = await client.post(`/shows/${id}/like`);
    return response.data;
  } catch (err) {
    console.error(`Failed to like show ${id}:`, err);
    throw err;
  }
}

export async function unlikeShow(id) {
  try {
    const response = await client.delete(`/shows/${id}/like`);
    return response.data;
  } catch (err) {
    console.error(`Failed to unlike show ${id}:`, err);
    throw err;
  }
}
