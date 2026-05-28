/**
 * Video service — backend API integration for video files and watch progress.
 * Uses real backend endpoints exclusively.
 *
 * Endpoints:
 *   GET  /movies/:movieId/video-files
 *   GET  /episodes/:episodeId/video-files
 *   PUT  /watch-history/:movieId
 *   GET  /watch-history/continue-watching
 */

import client from '../api/client';

// ─── Video Files ──────────────────────────────────────────────────────────────

/**
 * Fetch all video files for a movie.
 * Returns an array of { quality, file_url, duration_seconds, is_processed }
 * GET /movies/:movieId/video-files
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
 * Build a quality→URL sources map from video-file array.
 * Returns: { '1080p': 'https://...', '720p': '...', ... }
 */
export function buildSourcesMap(videoFiles = []) {
  return videoFiles.reduce((acc, vf) => {
    const q = vf?.quality || vf?.resolution || '1080p';
    const url = vf?.file_url || vf?.url || vf?.stream_url || vf?.hls_url;
    if (url) acc[q] = url;
    return acc;
  }, {});
}

/**
 * Pick the best available source URL from a sources map.
 * Priority: 1080p → 720p → 480p → first available
 */
export function pickBestSource(sourcesMap = {}) {
  const preferred = ['1080p', '720p', '480p', '4K', '360p'];
  for (const q of preferred) {
    if (sourcesMap[q]) return sourcesMap[q];
  }
  const values = Object.values(sourcesMap);
  return values.length > 0 ? values[0] : null;
}

/**
 * Fetch all video files for an episode.
 * Returns an array of { quality, file_url, duration_seconds, is_processed }
 * GET /episodes/:episodeId/video-files
 */
export async function getEpisodeVideoFiles(episodeId) {
  if (!episodeId) return [];
  try {
    const response = await client.get(`/episodes/${episodeId}/video-files`);
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      // Handle nesting: { data: { episode: { video_files: [...] } } }
      const inner = data.episode || data.data || data;

      if (Array.isArray(inner.video_files)) return inner.video_files;
      if (Array.isArray(inner.files)) return inner.files;
      if (Array.isArray(inner)) return inner;
    }
    return [];
  } catch (err) {
    console.error(`getEpisodeVideoFiles(${episodeId}):`, err?.message);
    return [];
  }
}

// ─── Watch History / Progress ─────────────────────────────────────────────────

/**
 * Update watch progress for a movie (debounce recommended at call site).
 * PUT /watch-history/:movieId
 * @param {string} movieId
 * @param {{ watch_time_seconds: number, last_position_seconds: number, is_completed: boolean }} data
 */
export async function updateMovieProgress(movieId, data) {
  if (!movieId) return;
  try {
    const response = await client.put(`/watch-history/${movieId}`, {
      watch_time_seconds: data.watch_time_seconds ?? 0,
      last_position_seconds: data.last_position_seconds ?? 0,
      is_completed: data.is_completed ?? false,
    });
    return response.data;
  } catch (err) {
    // Silently ignore — progress tracking is non-critical
    console.warn(`updateMovieProgress(${movieId}):`, err?.message);
  }
}

/**
 * Fetch continue-watching list for current user.
 * GET /watch-history/continue-watching
 */
export async function getContinueWatching() {
  try {
    const response = await client.get('/watch-history/continue-watching');
    if (response.data?.success && response.data?.data) {
      const data = response.data.data;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data)) return data;
    }
    return [];
  } catch (err) {
    console.warn('getContinueWatching:', err?.message);
    return [];
  }
}
