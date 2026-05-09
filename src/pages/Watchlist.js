import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMovies } from '../context/MovieContext';
import { useLocale } from '../context/LocaleContext';
import * as watchlistService from '../services/watchlistService';
import MovieCard from '../components/MovieCard';
import { SkeletonCard } from '../components/Skeleton';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import './Watchlist.css';

const Watchlist = () => {
  const { user } = useAuth();
  const { mutateWatchlist } = useMovies();
  const { t } = useLocale();
  const [watchlistMovies, setWatchlistMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const movies = await watchlistService.getWatchlist();
        if (isMounted) {
          setWatchlistMovies(movies);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError('Failed to load watchlist. Please try again later.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMovies();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleRemove = async (movieId) => {
    setRemovingId(movieId);
    const result = await mutateWatchlist(movieId, 'remove');
    setRemovingId(null);
    if (result.success) {
      setWatchlistMovies(prev => prev.filter(m => String(m.id) !== String(movieId)));
    } else {
      alert(result.error || 'Failed to remove from watchlist');
    }
  };

  if (!user) {
    return (
      <div className="watchlist-not-found">
        <h2>Please log in to view your wishlist</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="watchlist-page">
        <div className="watchlist-container layout-container">
          <div className="watchlist-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="watchlist-page">
        <div className="watchlist-container layout-container">
          <div className="empty-watchlist">
            <FaHeart className="empty-icon" />
            <h3>Oops!</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="watchlist-page">
      <div className="watchlist-container layout-container">
        <div className="watchlist-header">
          <h1 className="watchlist-title">
            <FaHeart />
            My Wishlist
          </h1>
          <p className="watchlist-subtitle">
            {watchlistMovies.length} movie{watchlistMovies.length !== 1 ? 's' : ''} saved
          </p>
        </div>

        {watchlistMovies.length > 0 ? (
          <div className="watchlist-grid">
            {watchlistMovies.map((movie) => (
              <div key={movie.id} className="watchlist-item-wrapper">
                <MovieCard movie={movie} showWatchlist={false} />
                <button
                  className={`wishlist-heart-btn${removingId === movie.id ? ' removing' : ''}`}
                  onClick={() => handleRemove(movie.id)}
                  disabled={removingId === movie.id}
                  title={t('removeFromWatchlist')}
                  aria-label={t('removeFromWatchlist')}
                >
                  <FaHeart className="heart-filled" />
                  <FaRegHeart className="heart-empty" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-watchlist">
            <FaHeart className="empty-icon" />
            <h3>Your wishlist is empty</h3>
            <p>Start adding movies to your wishlist to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;

