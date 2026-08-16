/**
 * Data models aligned with API and spec.
 * Use for API layer and state management.
 * Feature-based modular architecture.
 */

// ─── Role & Permission Types ───────────────────────────────────────────────

/** @typedef {'guest'|'viewer'|'user'|'filmmaker'|'moderator'|'admin'} UserRole */

// ─── Media Types ───────────────────────────────────────────────────────────

/**
 * Supported media content types.
 * ShortFilm = standalone film under configurable threshold (default 40 min).
 * @typedef {'Movie'|'ShortFilm'|'Series'} MediaType
 */
export const MEDIA_TYPES = /** @type {const} */ ({
  MOVIE: 'Movie',
  SHORT_FILM: 'ShortFilm',
  SERIES: 'Series',
});

/** Duration threshold (minutes) for ShortFilm classification */
export const SHORT_FILM_THRESHOLD_MINUTES = 40;

// ─── Age Ratings ──────────────────────────────────────────────────────────

/**
 * Content age rating labels and their display colors.
 * @typedef {'G'|'PG'|'PG-13'|'R'|'NC-17'|'16+'|'18+'} AgeRating
 */
export const AGE_RATINGS = /** @type {const} */ ({
  G: { label: 'G', color: '#22c55e', description: 'General Audiences' },
  PG: { label: 'PG', color: '#84cc16', description: 'Parental Guidance Suggested' },
  'PG-13': { label: 'PG-13', color: '#eab308', description: 'Parents Strongly Cautioned' },
  R: { label: 'R', color: '#f97316', description: 'Restricted' },
  'NC-17': { label: 'NC-17', color: '#ef4444', description: 'Adults Only' },
  '16+': { label: '16+', color: '#f97316', description: 'Suitable for ages 16 and above' },
  '18+': { label: '18+', color: '#ef4444', description: 'Suitable for ages 18 and above' },
});

// ─── Approval Workflow ────────────────────────────────────────────────────

/**
 * Lifecycle states for uploaded content (admin approval workflow).
 * @typedef {'draft'|'pending_review'|'approved'|'rejected'|'published'} ApprovalStatus
 */
export const APPROVAL_STATUS = /** @type {const} */ ({
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
});

// ─── Cast & Crew ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} CastMember
 * @property {string} id
 * @property {string} name
 * @property {string} role           - e.g. "Actor", "Director", "Producer"
 * @property {string} [character]    - Character name for actors
 * @property {string} [photo]        - Photo URL
 * @property {string} [nationality]
 */

/**
 * @typedef {Object} CrewMember
 * @property {string} id
 * @property {string} name
 * @property {string} role           - e.g. "Director", "Producer", "Cinematographer"
 * @property {string} [photo]
 */

// ─── Media Upload ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} MediaAssets
 * @property {string} [trailer_url]  - Trailer URL (YouTube embed or direct file)
 * @property {string} [poster_url]   - Poster image URL (vertical, 2:3 aspect)
 * @property {string} [cover_url]    - Cover/backdrop image URL (horizontal, 16:9 aspect)
 * @property {string} [video_url]    - Main video URL or file path
 */

/**
 * @typedef {Object} UploadValidation
 * @property {boolean} hasTrailer
 * @property {boolean} hasPoster
 * @property {boolean} hasCover
 * @property {boolean} hasVideo
 * @property {string[]} errors
 * @property {boolean} isValid
 */

// ─── Episode & Season ─────────────────────────────────────────────────────

/**
 * @typedef {Object} Episode
 * @property {string} id
 * @property {number} episode_number
 * @property {string} title
 * @property {string} [description]
 * @property {number} [duration]     - Duration in minutes
 * @property {string} [video_url]
 * @property {string} [thumbnail_url]
 * @property {ApprovalStatus} [status]
 */

/**
 * @typedef {Object} Season
 * @property {number} season_number
 * @property {string} title
 * @property {number} [year]
 * @property {Episode[]} episodes
 */

// ─── Core Content Models ──────────────────────────────────────────────────

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} [profile_image]
 * @property {string} [bio]
 * @property {UserRole} role
 * @property {string} [created_at]
 */

/** @param {User} user */
export function isFilmmaker(user) {
  if (!user || !user.role) return false;
  return String(user.role).toLowerCase() === 'filmmaker';
}

/** @param {User} user */
export function isAdmin(user) {
  if (!user || !user.role) return false;
  return ['admin', 'moderator'].includes(String(user.role).toLowerCase());
}

/**
 * @typedef {Object} Film
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {MediaType} [type]
 * @property {AgeRating} [age_rating]
 * @property {string} [poster]        - Poster URL (2:3 vertical)
 * @property {string} [cover]         - Cover/backdrop URL (16:9 horizontal)
 * @property {string} [trailer]       - Trailer URL
 * @property {string} [video_url]     - Main video URL
 * @property {string[]} [genres]
 * @property {number} [duration]      - Minutes
 * @property {number} [year]
 * @property {string|number} [release_date]
 * @property {string} [filmmaker_id]
 * @property {string} [filmmaker_name]
 * @property {string} [filmmaker_image]
 * @property {CastMember[]} [cast_crew]
 * @property {string} [director]
 * @property {string} [producer]
 * @property {number} [views]
 * @property {number} [likes]
 * @property {boolean} [is_liked]
 * @property {boolean} [is_saved]
 * @property {number} [average_rating]
 * @property {number} [user_rating]
 * @property {ApprovalStatus} [approval_status]
 * @property {string} [rejection_reason]
 * @property {string} [created_at]
 * @property {boolean} [trending]
 * @property {boolean} [featured]
 */

/**
 * @typedef {Object} Show
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {MediaType} [type]
 * @property {AgeRating} [age_rating]
 * @property {string} [poster]      - 2:3 vertical
 * @property {string} [cover]       - 16:9 horizontal
 * @property {string} [trailer]
 * @property {string[]} [genres]
 * @property {string} [filmmaker_id]
 * @property {string} [filmmaker_name]
 * @property {Season[]} [seasons]
 * @property {CastMember[]} [cast_crew]
 * @property {ApprovalStatus} [approval_status]
 */

/**
 * @typedef {Object} Filmmaker
 * @property {string} id
 * @property {string} name
 * @property {string} [profile_image]
 * @property {string} [bio]
 * @property {string} [location]
 * @property {number} [total_films]
 * @property {number} [total_views]
 * @property {number} [followers]
 * @property {boolean} [is_following]
 * @property {string[]} [specialties]
 * @property {string} [website]
 * @property {string} [instagram_url]
 * @property {string} [twitter_url]
 * @property {string} [youtube_url]
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} [icon_url]
 * @property {number} [film_count]
 */

/**
 * @typedef {Object} AuthResponse
 * @property {string} access_token
 * @property {string} [refresh_token]
 * @property {User} user
 */

/**
 * @typedef {Object} ApprovalAction
 * @property {string} content_id
 * @property {MediaType} content_type
 * @property {ApprovalStatus} new_status
 * @property {string} [rejection_reason]
 * @property {string} [reviewer_id]
 * @property {string} [reviewed_at]
 */

const types = {};
export default types;
