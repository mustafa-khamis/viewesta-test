const DEFAULT_PRICE = {
  '480p': 2.99,
  '720p': 4.99,
  '1080p': 7.99,
  '4K': 12.99,
};

const ensureString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value);
};

export const coerceArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

export const normalizePricing = (pricing) => {
  if (!pricing) return { ...DEFAULT_PRICE };
  if (!Array.isArray(pricing) && typeof pricing === 'object') {
    return { ...DEFAULT_PRICE, ...pricing };
  }

  return pricing.reduce((acc, tier) => {
    const quality = tier?.quality || tier?.label;
    if (!quality) return acc;
    const priceValue = Number(tier?.price ?? tier?.amount);
    if (!Number.isNaN(priceValue)) {
      acc[quality] = priceValue;
    }
    return acc;
  }, { ...DEFAULT_PRICE });
};

const extractYear = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getFullYear();
};

const normalizePeopleList = (list) => {
  return coerceArray(list)
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry?.name) return entry.name;
      return null;
    })
    .filter(Boolean);
};

const normalizeCastCrew = (list) => {
  return coerceArray(list)
    .map((entry, index) => {
      if (!entry) return null;

      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) return null;
        return {
          id: ensureString(`${name}-${index}`),
          name,
          role: 'Actor',
          character: '',
          photo: '',
        };
      }

      const name = entry?.name || entry?.full_name || entry?.fullName;
      if (!name) return null;

      const role = entry?.role || entry?.job || entry?.type || 'Actor';
      const character = entry?.character || entry?.character_name || entry?.characterName || '';
      const photo = entry?.photo || entry?.photo_url || entry?.avatar || entry?.image || '';
      const rawId = entry?.id || entry?._id || entry?.person_id || entry?.personId;

      return {
        id: ensureString(rawId || `${name}-${role}-${index}`),
        name,
        role,
        character,
        photo,
      };
    })
    .filter(Boolean);
};

export const coerceMovieId = (entry) => {
  if (!entry) return null;
  if (entry.movie_id) return ensureString(entry.movie_id);
  if (entry.movieId) return ensureString(entry.movieId);
  if (entry.movie?.id) return ensureString(entry.movie.id);
  if (entry.series_id) return ensureString(entry.series_id);
  if (entry.id) return ensureString(entry.id);
  return null;
};

export const normalizeMovie = (input = {}) => {
  // Handle nested objects from backend (e.g. { movie: {...} } or { show: {...} })
  const rawMovie = input.movie || input.show || input.series || input;

  const releaseDate =
    rawMovie.release_date || rawMovie.released_at || rawMovie.created_at || rawMovie.published_at;
  const releaseYear = extractYear(releaseDate) || rawMovie.year;
  const durationMinutes =
    Number(rawMovie.duration_minutes ?? rawMovie.duration ?? rawMovie.runtime_minutes) || 0;

  const genres =
    coerceArray(rawMovie.genres)
      .map((genre) => {
        if (typeof genre === 'string') return genre;
        if (genre?.name) return genre.name;
        return null;
      })
      .filter(Boolean) ||
    coerceArray(rawMovie.categories)
      .map((category) => category?.name)
      .filter(Boolean);

  if (genres.length === 0 && rawMovie.category_name) {
    genres.push(rawMovie.category_name);
  }

  const cast = normalizePeopleList(rawMovie.cast);

  const ageRating =
    rawMovie.age_rating ||
    rawMovie.ageRating ||
    rawMovie.rating_certification ||
    rawMovie.certification ||
    '';
  const castCrew = normalizeCastCrew(
    rawMovie.cast_crew || rawMovie.castCrew || rawMovie.cast_and_crew || rawMovie.castAndCrew
  );
  const cover =
    rawMovie.cover ||
    rawMovie.cover_url ||
    rawMovie.backdrop ||
    rawMovie.backdrop_url ||
    rawMovie.hero_image ||
    '';
  const trailerUrl = rawMovie.trailer_url || rawMovie.trailerUrl || '';
  const approvalStatus = rawMovie.approval_status || rawMovie.approvalStatus || rawMovie.status || '';

  // Standardize the content type
  let type = rawMovie.type || rawMovie.content_type || rawMovie.media_type || 'Movie';
  const lowerType = String(type).toLowerCase();
  if (lowerType === 'series' || lowerType === 'show') {
    type = 'Series';
  } else if (lowerType === 'short' || lowerType === 'shortfilm') {
    type = 'ShortFilm';
  } else {
    type = 'Movie';
  }

  return {
    id: ensureString(rawMovie.id),
    title: rawMovie.title || 'Untitled',
    year: releaseYear || '—',
    rating: rawMovie.rating || rawMovie.average_rating || rawMovie.score || 0,
    average_rating: rawMovie.average_rating ?? null,
    duration: durationMinutes,
    genres: genres.length ? genres : ['General'],
    poster:
      rawMovie.poster ||
      rawMovie.poster_url ||
      rawMovie.cover_url ||
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="450"%3E%3Crect fill="%23333" width="300" height="450"/%3E%3Ctext x="50%" y="50%" font-size="18" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Poster%3C/text%3E%3C/svg%3E',
    backdrop:
      rawMovie.backdrop ||
      rawMovie.backdrop_url ||
      rawMovie.hero_image ||
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"%3E%3Crect fill="%23222" width="1200" height="600"/%3E%3Ctext x="50%" y="50%" font-size="24" fill="%23666" text-anchor="middle" dominant-baseline="middle"%3ENo Backdrop%3C/text%3E%3C/svg%3E',
    description: rawMovie.description || rawMovie.synopsis || 'No description provided.',
    director: rawMovie.director || rawMovie.directed_by || rawMovie.filmmaker || 
              (rawMovie.filmmaker_first_name ? `${rawMovie.filmmaker_first_name} ${rawMovie.filmmaker_last_name || ''}`.trim() : 'Unknown Director'),
    cast: cast.length ? cast : ['Unknown Cast'],
    quality: rawMovie.default_quality || '1080p',
    price: normalizePricing(rawMovie.pricing),
    trending: Boolean(rawMovie.trending || rawMovie.is_trending || rawMovie.isTrending),
    featured: Boolean(rawMovie.featured || rawMovie.is_featured || rawMovie.isFeatured),
    type,
    filmmakerId: rawMovie.filmmakerId || rawMovie.filmmaker_id || null,
    age_rating: ensureString(ageRating),
    cast_crew: castCrew,
    cover: ensureString(cover),
    trailer_url: ensureString(trailerUrl),
    approval_status: ensureString(approvalStatus),
    status: ensureString(approvalStatus),
    raw: rawMovie,
  };
};

const normalizeSeason = (season) => {
  if (!season) return null;
  const episodes = coerceArray(season.episodes).map((episode, index) => ({
    episodeNumber: episode?.episode_number ?? episode?.episodeNumber ?? index + 1,
    title: episode?.title || `Episode ${index + 1}`,
    duration: Number(episode?.duration_minutes ?? episode?.duration ?? 0),
    description: episode?.description || episode?.synopsis || 'Episode description coming soon.',
    id: ensureString(episode?.id ?? `${season.season_number}-${index + 1}`),
    // Video source fields — consumed by VideoPlayer via videoService.getEpisodeVideoFiles()
    video_url: episode?.video_url || episode?.file_url || episode?.stream_url || episode?.hls_url || '',
    hls_url: episode?.hls_url || episode?.m3u8_url || '',
    file_url: episode?.file_url || episode?.video_url || '',
  }));

  return {
    seasonNumber: season?.season_number ?? season?.seasonNumber ?? 1,
    title: season?.title || `Season ${season?.season_number ?? 1}`,
    year: season?.year || extractYear(season?.release_date) || '—',
    episodes,
    raw: season,
  };
};

export const normalizeSeries = (input = {}) => {
  const rawSeries = input.movie || input.show || input.series || input;

  const normalized = normalizeMovie({
    ...rawSeries,
    type: rawSeries.type || 'Series',
  });

  const seasons = coerceArray(rawSeries.seasons).map(normalizeSeason).filter(Boolean);

  return {
    ...normalized,
    seasons,
    director: rawSeries.director || rawSeries.creator || normalized.director,
    raw: rawSeries,
  };
};

export { DEFAULT_PRICE };

