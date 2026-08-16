import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaTv } from 'react-icons/fa';
import MovieCard from '../components/MovieCard';
import { SkeletonCard } from '../components/Skeleton';
import * as seriesService from '../services/seriesService';
import './Series.css';

const GENRES = [
  'All', 'Action', 'Biography', 'Comedy', 'Crime', 'Drama',
  'Fantasy', 'History', 'Horror', 'Mystery', 'Reality', 'Romance',
  'Sci-Fi', 'Thriller', 'Family',
];

const SORT_OPTIONS = [
  { value: 'popular',   label: 'Popular' },
  { value: 'newest',    label: 'Newest' },
  { value: 'top_rated', label: 'Top Rated' },
];



const Series = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [series, setSeries]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const genreParam = searchParams.get('genre') || 'All';
  const yearParam  = searchParams.get('year')  || '';
  const sortParam  = searchParams.get('sort')  || 'popular';

  /* ── Data loading ─────────────────────────────────────────────────────────── */
  const loadSeries = useCallback(async () => {
    setLoading(true);
    setError('');
    // Clear any previously loaded data so stale content is never shown on failure
    setSeries([]);
    try {
      const list = await seriesService.getSeries({ limit: 50 });
      setSeries(list);
    } catch (err) {
      // err.message is already a safe, user-friendly string from seriesService
      setError(err?.message || 'Something went wrong while loading series. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  /* ── Derive year list from loaded data ────────────────────────────────────── */
  const years = useMemo(() => {
    const set = new Set();
    series.forEach((s) => {
      const y = Number(s.year);
      if (!Number.isNaN(y) && y > 1900) set.add(y);
    });
    return [...set].sort((a, b) => b - a);
  }, [series]);

  /* ── Client-side filter + sort ────────────────────────────────────────────── */
  const filteredAndSorted = useMemo(() => {
    // TEMP TESTING MODE: approval filter disabled temporarily for DRM/video testing
    // TODO: restore approval_status === 'APPROVED' before production
    let list = series.filter(s => true /* String(s.approval_status).toUpperCase() === 'APPROVED' */);
    const trendingParam = searchParams.get('trending') === 'true';

    // Trending filter
    if (trendingParam) {
      list = list.filter((s) => s.trending);
    }

    // Genre filter
    if (genreParam && genreParam !== 'All') {
      const g = genreParam.toLowerCase();
      list = list.filter((s) =>
        s.genres && s.genres.some((x) => String(x).toLowerCase() === g)
      );
    }

    // Year filter
    if (yearParam) {
      const y = Number(yearParam);
      if (!Number.isNaN(y)) list = list.filter((s) => Number(s.year) === y);
    }

    // Sort
    if (sortParam === 'newest') {
      list.sort((a, b) => {
        // Prefer full ISO release_date from raw payload (more precise than year)
        const dateA = new Date(
          a.raw?.release_date || a.raw?.released_at || String(a.year)
        ).getTime();
        const dateB = new Date(
          b.raw?.release_date || b.raw?.released_at || String(b.year)
        ).getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      });
    } else if (sortParam === 'top_rated') {
      list.sort(
        (a, b) =>
          (Number(b.average_rating ?? b.rating) || 0) -
          (Number(a.average_rating ?? a.rating) || 0)
      );
    } else {
      // popular: trending first, then by rating
      list.sort(
        (a, b) =>
          (b.trending ? 1 : 0) - (a.trending ? 1 : 0) ||
          (Number(b.rating) || 0) - (Number(a.rating) || 0)
      );
    }

    return list;
  }, [series, searchParams, genreParam, yearParam, sortParam]);






  
  /* ── URL param helper ─────────────────────────────────────────────────────── */
  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All' && value !== '') next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };





  /* ── Main render ──────────────────────────────────────────────────────────── */
  return (
    <div className="series-page">
      <div className="series-container layout-container">

        {/* Header */}
        <div className="series-header">
          <h1 className="series-title">
            <FaTv />
            TV Series
          </h1>
          <p className="series-subtitle">
            Discover African TV shows — filter by genre, year, and sort by popularity.
          </p>
        </div>

        {/* Inline error banner — shown regardless of whether data was loaded before */}
        {error && (
          <div className="series-inline-error">
            <span>⚠ Unable to load series</span>
            <button className="btn btn-ghost btn-small" onClick={loadSeries}>
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="series-filters">
          <div className="filter-group">
            <label htmlFor="sg-genre">Genre</label>
            <select
              id="sg-genre"
              value={genreParam}
              onChange={(e) => setFilter('genre', e.target.value)}
              className="filter-select"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sg-year">Year</label>
            <select
              id="sg-year"
              value={yearParam}
              onChange={(e) => setFilter('year', e.target.value)}
              className="filter-select"
            >
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sg-sort">Sort</label>
            <select
              id="sg-sort"
              value={sortParam}
              onChange={(e) => setFilter('sort', e.target.value)}
              className="filter-select"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Result count */}
          {!loading && (
            <span className="series-count">
              {filteredAndSorted.length} show{filteredAndSorted.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="series-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error && series.length === 0 ? (
          // Error with no data — show a minimal placeholder where cards would be
          <div className="series-empty">
            <FaTv className="series-empty-icon" />
            <p>Unable to load series</p>
            <span>Check your connection and try again.</span>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="series-empty">
            {series.length === 0 ? (
              <>
                <FaTv className="series-empty-icon" />
                <p>No series available right now.</p>
                <span>Check back later or explore other content.</span>
              </>
            ) : (
              <>
                <p>No shows match your filters.</p>
                <span>Try changing the genre or year.</span>
              </>
            )}
          </div>
        ) : (
          <div className="series-grid">
            {filteredAndSorted.map((show) => (
              <MovieCard key={show.id} movie={show} showWatchlist />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Series;
