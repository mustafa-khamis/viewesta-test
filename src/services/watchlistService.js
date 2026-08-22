import client from '../api/client';
import { normalizeMovie } from '../utils/mediaHelpers';

/**
 * Fetch the user's entire watchlist.
 * GET /watchlist
 */
export async function getWatchlist() {
  try {
    const response = await client.get('/watchlist');
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      
      let rawArray = [];
      if (Array.isArray(data)) {
        rawArray = data;
      } else if (data.movies && Array.isArray(data.movies)) {
        rawArray = data.movies;
      } else if (data.items && Array.isArray(data.items)) {
        rawArray = data.items;
      }

      return rawArray.map((item) => {
        const rawMovie = item.movie || item.movie_details || item.movieDetails || item;
        return normalizeMovie(rawMovie);
      });
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch watchlist:', err);
    throw err;
  }
}

/**
 * Add a movie to the watchlist.
 * POST /watchlist/:movieId
 */
export async function addToWatchlist(movieId) {
  try {
    const response = await client.post(`/watchlist/${movieId}`, {});
    return response.data;
  } catch (err) {
    console.error(`Failed to add movie ${movieId} to watchlist:`, err);
    throw err;
  }
}

/**
 * Remove a movie from the watchlist.
 * DELETE /watchlist/:movieId
 */
export async function removeFromWatchlist(movieId) {
  try {
    const response = await client.delete(`/watchlist/${movieId}`);
    return response.data;
  } catch (err) {
    console.error(`Failed to remove movie ${movieId} from watchlist:`, err);
    throw err;
  }
}

/**
 * Check if a specific movie is in the watchlist.
 * GET /watchlist/:movieId/check
 */
export async function checkWatchlist(movieId) {
  try {
    const response = await client.get(`/watchlist/${movieId}/check`);
    // Assuming backend returns { success: true, data: { inWatchlist: true } } or similar
    // We handle the boolean result
    if (response.data?.success && response.data?.data !== undefined) {
      return !!response.data.data.inWatchlist; // Adjust based on actual response schema
    }
    return false;
  } catch (err) {
    console.error(`Failed to check watchlist for movie ${movieId}:`, err);
    return false; // Fail open
  }
}
