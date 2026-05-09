/**
 * Upload validation utility.
 * Validates media assets (poster, cover, trailer) before content submission.
 * Enforces aspect ratio requirements and required field presence.
 */

import { SHORT_FILM_THRESHOLD_MINUTES } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────

export const VALIDATION_RULES = {
  poster: {
    label: 'Poster',
    description: 'Vertical image (2:3 aspect ratio)',
    aspectRatio: 2 / 3,
    aspectTolerance: 0.15,
    maxSizeMB: 10,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  cover: {
    label: 'Cover / Backdrop',
    description: 'Horizontal image (16:9 aspect ratio)',
    aspectRatio: 16 / 9,
    aspectTolerance: 0.15,
    maxSizeMB: 15,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  trailer: {
    label: 'Trailer',
    description: 'YouTube URL or video file (MP4, WebM, MOV)',
    maxSizeMB: 500,
    acceptedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    acceptedUrlPatterns: [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?vimeo\.com\//,
    ],
  },
  video: {
    label: 'Main Video',
    description: 'Main video file (MP4, WebM) or URL',
    maxSizeMB: 5120, // 5GB limit
    acceptedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
};

// ─── Aspect Ratio Validation ──────────────────────────────────────────────

/**
 * Validate an image file's aspect ratio against expected ratio.
 * @param {File} file
 * @param {number} expectedRatio  e.g. 2/3 for poster
 * @param {number} [tolerance]    allowed deviation (default 0.15)
 * @returns {Promise<{valid: boolean, actual: number, message: string}>}
 */
export function validateImageAspectRatio(file, expectedRatio, tolerance = 0.15) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const actual = img.width / img.height;
      const diff = Math.abs(actual - expectedRatio);
      const valid = diff <= tolerance;
      const expected = expectedRatio >= 1
        ? `${Math.round(expectedRatio * 9)}:9`
        : `2:3`;
      resolve({
        valid,
        actual: Math.round(actual * 100) / 100,
        message: valid
          ? ''
          : `Image aspect ratio is ${img.width}×${img.height}. Expected approximately ${expected}.`,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, actual: 0, message: 'Could not read image dimensions.' });
    };
    img.src = url;
  });
}

// ─── File Size Validation ─────────────────────────────────────────────────

/**
 * @param {File} file
 * @param {number} maxMB
 * @returns {{ valid: boolean, message: string }}
 */
export function validateFileSize(file, maxMB) {
  const sizeMB = file.size / (1024 * 1024);
  const valid = sizeMB <= maxMB;
  return {
    valid,
    message: valid ? '' : `File is ${sizeMB.toFixed(1)} MB. Maximum allowed is ${maxMB} MB.`,
  };
}

// ─── File Type Validation ─────────────────────────────────────────────────

/**
 * @param {File} file
 * @param {string[]} acceptedTypes
 * @returns {{ valid: boolean, message: string }}
 */
export function validateFileType(file, acceptedTypes) {
  const valid = acceptedTypes.includes(file.type);
  return {
    valid,
    message: valid ? '' : `File type "${file.type}" is not accepted. Accepted types: ${acceptedTypes.join(', ')}.`,
  };
}

// ─── URL Validation ───────────────────────────────────────────────────────

/**
 * Validate a media URL (trailer or video).
 * @param {string} url
 * @param {RegExp[]} [patterns]
 * @returns {{ valid: boolean, message: string }}
 */
export function validateMediaUrl(url, patterns = []) {
  if (!url || !url.trim()) return { valid: false, message: 'URL is required.' };

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'URL must use HTTP or HTTPS protocol.' };
    }
  } catch {
    return { valid: false, message: 'Please enter a valid URL.' };
  }

  if (patterns.length > 0) {
    const matchesPattern = patterns.some((p) => p.test(url));
    if (!matchesPattern) {
      return { valid: false, message: 'URL must be from an accepted source (YouTube, Vimeo, or direct video link).' };
    }
  }

  return { valid: true, message: '' };
}

// ─── Core Upload Validation ───────────────────────────────────────────────

/**
 * Validate the complete upload form before submission.
 * @param {Object} formData
 * @param {'Movie'|'ShortFilm'|'Series'} mediaType
 * @returns {{ isValid: boolean, errors: Record<string, string>, warnings: string[] }}
 */
export function validateUploadForm(formData, mediaType) {
  const errors = {};
  const warnings = [];

  // ── Required text fields ──
  if (!formData.title?.trim()) {
    errors.title = 'Title is required.';
  } else if (formData.title.trim().length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  if (!formData.description?.trim()) {
    errors.description = 'Description / synopsis is required.';
  } else if (formData.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  }

  if (!formData.age_rating) {
    errors.age_rating = 'Age rating is required.';
  }

  if (!formData.genres || formData.genres.length === 0) {
    errors.genres = 'At least one genre is required.';
  }

  if (!formData.director?.trim()) {
    errors.director = 'Director name is required.';
  }

  // ── Duration (movies / short films) ──
  if (mediaType !== 'Series') {
    const dur = Number(formData.duration);
    if (!dur || dur < 1) {
      errors.duration = 'Duration must be at least 1 minute.';
    } else if (mediaType === 'ShortFilm' && dur > SHORT_FILM_THRESHOLD_MINUTES) {
      errors.duration = `Short films must be ${SHORT_FILM_THRESHOLD_MINUTES} minutes or less. For longer content, choose "Movie".`;
    } else if (mediaType === 'Movie' && dur <= SHORT_FILM_THRESHOLD_MINUTES) {
      warnings.push(`This duration (${dur} min) qualifies as a Short Film. Consider changing media type.`);
    }
  }

  // ── Release Date ──
  if (!formData.releaseDate) {
    errors.releaseDate = 'Release Date is required.';
  } else {
    const year = new Date(formData.releaseDate).getFullYear();
    if (!year || year < 1900 || year > new Date().getFullYear() + 5) {
      errors.releaseDate = `Year must be between 1900 and ${new Date().getFullYear() + 5}.`;
    }
  }

  // ── Country and Language ──
  if (!formData.country?.trim()) {
    errors.country = 'Country is required.';
  }
  if (!formData.language?.trim()) {
    errors.language = 'Language is required.';
  }

  // ── Media assets ──
  if (!formData.poster_url && !formData.poster_file) {
    errors.poster = 'Poster image is required (vertical, 2:3 aspect ratio).';
  }

  if (!formData.cover_url && !formData.cover_file) {
    errors.cover = 'Cover/backdrop image is required (horizontal, 16:9 aspect ratio).';
  }

  if (!formData.trailer_url && !formData.trailer_file) {
    errors.trailer = 'Trailer is required (YouTube link or video file).';
  }

  // ── Series-specific ──
  if (mediaType === 'Series') {
    if (!formData.seasons || formData.seasons.length === 0) {
      errors.seasons = 'At least one season with one episode is required.';
    } else {
      const hasEpisodes = formData.seasons.every(
        (s) => s.episodes && s.episodes.length > 0
      );
      if (!hasEpisodes) {
        errors.seasons = 'Each season must have at least one episode.';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

// ─── Accepted File Extensions ─────────────────────────────────────────────

export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
export const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/webm,video/quicktime';

/**
 * Generate a human-readable file size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
