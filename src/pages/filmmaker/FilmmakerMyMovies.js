import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { getFilmmakerMovies } from '../../services/movieService';
import MovieCard from '../../components/MovieCard';
import { SkeletonCard } from '../../components/Skeleton';
import './FilmmakerMyMovies.css';
import { FaEdit, FaEye } from 'react-icons/fa';

/**
 * Filmmaker — list of my uploaded movies fetched from backend API.
 */
function FilmmakerMyMovies() {
  const { user } = useAuth();
  const { t } = useLocale();
  
  const [myMovies, setMyMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const movies = await getFilmmakerMovies();
        setMyMovies(movies || []);
      } catch (err) {
        console.error('Error fetching filmmaker movies:', err);
        setError('Failed to load your movies. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchMovies();
    } else {
      setLoading(false);
    }
  }, [user]);

  const getStatusBadge = (status) => {
    const s = String(status).toUpperCase();
    switch(s) {
      case 'DRAFT': return <span className="status-badge status-draft">Draft</span>;
      case 'PENDING': return <span className="status-badge status-pending">Pending Review</span>;
      case 'REJECTED': return <span className="status-badge status-rejected">Rejected</span>;
      case 'APPROVED': return <span className="status-badge status-approved">Approved</span>;
      default: return <span className="status-badge status-pending">{status || 'Pending'}</span>;
    }
  };

  return (
    <div className="filmmaker-mymovies page-container">
      <div className="page-header">
        <h1>{t('myStudio')}</h1>
        <p className="subtitle">Manage your uploaded titles</p>
        <Link to="/filmmaker-studio/upload" className="btn btn-primary">{t('uploadNewMovie')}</Link>
      </div>

      {loading ? (
        <div className="movies-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <p>{error}</p>
        </div>
      ) : myMovies.length === 0 ? (
        <div className="empty-state">
          <p>You haven't uploaded any content yet.</p>
          <Link to="/filmmaker-studio/upload" className="btn btn-primary">{t('uploadNewMovie')}</Link>
        </div>
      ) : (
        <div className="movies-grid">
          {myMovies.map((movie) => (
            <div key={movie.id} className="movie-item-wrapper">
              <div className="movie-card-container">
                <MovieCard movie={movie} showWatchlist={false} />
                <div className="approval-overlay">
                   {getStatusBadge(movie.status || movie.approvalStatus)}
                </div>
              </div>
              <div className="movie-actions-bar">
                <Link to={`/filmmaker-studio/edit/${movie.id}`} className="action-btn edit" title="Edit Metadata">
                  <FaEdit /> Edit
                </Link>
                <Link to={`/watch/${movie.id}`} className="action-btn view" title="View Public Page">
                  <FaEye /> View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilmmakerMyMovies;
