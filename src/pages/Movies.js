import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaFilm } from 'react-icons/fa';
import MovieCard from '../components/MovieCard';
import { SkeletonCard } from '../components/Skeleton';
import { useMovies } from '../context/MovieContext';
import './Movies.css';

const GENRES = [
  'All', 'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama',
  'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Family', 'Biography', 'History',
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'top_rated', label: 'Top Rated' },
];

const normalizeType = (item) => (item?.type || '').toLowerCase();

const Movies = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { movies, trendingMovies, loading, error, refreshCatalog } = useMovies();

  const genreParam = searchParams.get('genre') || 'All';
  const yearParam = searchParams.get('year') || '';
  const sortParam = searchParams.get('sort') || 'popular';

  const trendingParam = searchParams.get('trending') === 'true';

  const movieOnly = useMemo(() => {
    const sourceList = trendingParam ? trendingMovies : movies;
    // TEMP TESTING MODE: approval filter disabled temporarily for DRM/video testing
    // TODO: restore approval_status === 'APPROVED' before production
    return sourceList.filter((m) => normalizeType(m) !== 'series' /* && String(m.approval_status).toUpperCase() === 'APPROVED' */);
  }, [movies, trendingMovies, trendingParam]);

  const years = useMemo(() => {
    const set = new Set();
    movieOnly.forEach((m) => {
      const y = Number(m.year);
      if (!Number.isNaN(y)) set.add(y);
    });
    return [...set].sort((a, b) => b - a);
  }, [movieOnly]);

  const filteredAndSorted = useMemo(() => {
    let list = [...movieOnly];
    if (genreParam && genreParam !== 'All') {
      const g = genreParam.toLowerCase();
      list = list.filter((m) =>
        m.genres && m.genres.some((x) => String(x).toLowerCase() === g)
      );
    }
    if (yearParam) {
      const y = Number(yearParam);
      if (!Number.isNaN(y)) list = list.filter((m) => Number(m.year) === y);
    }
    if (sortParam === 'newest') {
      list.sort((a, b) => {
        const dateA = new Date(a.raw?.release_date || a.raw?.created_at || String(a.year)).getTime();
        const dateB = new Date(b.raw?.release_date || b.raw?.created_at || String(b.year)).getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      });
    } else if (sortParam === 'top_rated') {
      list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else {
      list.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }
    return list;
  }, [movieOnly, genreParam, yearParam, sortParam]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All' && value !== '') next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };



  if (error && !movies.length) {
    return (
      <div className="movies-page error-state">
        <p>{error}</p>
        <button className="btn btn-primary" onClick={refreshCatalog}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="movies-page">
      <div className="movies-container layout-container">
        <div className="movies-header">
          <h1 className="movies-title">
            <FaFilm />
            Movies
          </h1>
          <p className="movies-subtitle">
            Discover African cinema — filter by genre, year, and sort by popularity, newest, or top rated.
          </p>
        </div>

        {error && movies.length > 0 && (
          <div className="movies-inline-error">
            <span>{error}</span>
            <button className="btn btn-ghost btn-small" onClick={refreshCatalog}>
              Retry
            </button>
          </div>
        )}

        <div className="movies-filters">
          <div className="filter-group">
            <label htmlFor="genre">Genre</label>
            <select
              id="genre"
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
            <label htmlFor="year">Year</label>
            <select
              id="year"
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
            <label htmlFor="sort">Sort</label>
            <select
              id="sort"
              value={sortParam}
              onChange={(e) => setFilter('sort', e.target.value)}
              className="filter-select"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="movies-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <p className="movies-empty">No movies match your filters. Try changing genre or year.</p>
        ) : (
          <div className="movies-grid">
            {filteredAndSorted.map((movie) => (
              <MovieCard key={movie.id} movie={movie} showWatchlist />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Movies;
