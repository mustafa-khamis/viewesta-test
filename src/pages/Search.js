import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';
import { useMovies } from '../context/MovieContext';
import * as seriesService from '../services/seriesService';
import MovieCard from '../components/MovieCard';
import { SkeletonCard } from '../components/Skeleton';
import './Search.css';

const Search = () => {
  const { searchMovies, loading: moviesLoading } = useMovies();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [seriesResults, setSeriesResults] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    setQuery(params.get('q') || '');
  }, [params]);

  useEffect(() => {
    if (!query || !query.trim()) {
      setSeriesResults([]);
      return;
    }
    let cancelled = false;
    setSeriesLoading(true);
    seriesService.searchSeries(query, 20).then((list) => {
      if (!cancelled) {
        setSeriesResults(list);
        setSeriesLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setSeriesLoading(false);
    });
    return () => { cancelled = true; };
  }, [query]);

  const movieResults = useMemo(() => {
    if (!query) return [];
    return searchMovies(query);
  }, [query, searchMovies]);

  const loading = moviesLoading || seriesLoading;
  const allResults = useMemo(() => {
    const seen = new Set();
    const out = [];
    movieResults.forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    });
    seriesResults.forEach((s) => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        out.push(s);
      }
    });
    return out.filter(m => String(m.approval_status).toUpperCase() === 'APPROVED');
  }, [movieResults, seriesResults]);

  return (
    <div className="search-page layout-container">
      <h1 className="search-title">Search</h1>
      <div className="search-input-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies and series"
          aria-label="Search movies and series"
          className="search-input-control"
        />
      </div>
      {loading && (
        <div className="search-loading">
          <FaSpinner className="spin-icon" /> Loading...
          <div className="search-results-grid" style={{ marginTop: 12 }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={`search-skeleton-${index}`} />
            ))}
          </div>
        </div>
      )}
      {!loading && (
        <div className="search-results-grid">
          {allResults.map((item) => (
            <MovieCard key={item.id} movie={item} showWatchlist />
          ))}
          {!allResults.length && query && (
            <div className="no-results">No results for &quot;{query}&quot;</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
