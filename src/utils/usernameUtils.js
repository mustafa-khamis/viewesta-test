/**
 * Utilities for username generation and sanitization.
 */

/**
 * Generates a unique-ish username from an email address.
 * Example: johnsmith@gmail.com -> johnsmith_4821
 * 
 * @param {string} email - The user's email address.
 * @returns {string} The generated username.
 */
export function generateUsername(email) {
  if (!email || !email.includes('@')) return `user_${Math.floor(Math.random() * 10000)}`;

  // 1. Extract the part before the @
  let base = email.split('@')[0];

  // 2. Sanitize: keep only alphanumeric, dots, and underscores
  // Remove any other characters
  base = base.replace(/[^a-zA-Z0-9._]/g, '');

  // 3. Ensure it's not empty after sanitization
  if (!base) base = 'user';

  // 4. Add a unique suffix (random 4 digits) to minimize backend conflicts
  const suffix = Math.floor(1000 + Math.random() * 9000);
  
  return `${base}_${suffix}`;
}

/**
 * Sanitizes a manually entered username (if ever allowed).
 * 
 * @param {string} username - The username to sanitize.
 * @returns {string} The sanitized username.
 */
export function sanitizeUsername(username) {
  return (username || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._]/g, '');
}
