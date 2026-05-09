import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPlay, FaHeart, FaClock, FaBookmark, FaCalendar } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useMovies } from '../context/MovieContext';
import AgeRatingBadge from './AgeRatingBadge';
import './MovieCard.css';

const MovieCard = ({ movie, showWatchlist = true, isTrending = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { watchlist, addToWatchlist, removeFromWatchlist } = useMovies();
  const isInWatchlist = movie?.id ? watchlist.includes(movie.id) : false;

  const handleWatchlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (isInWatchlist) removeFromWatchlist(movie.id);
    else addToWatchlist(movie.id);
  };

  const handleTrailerPlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoRef.current) {
      if (isTrailerPlaying) {
        videoRef.current.pause();
        setIsTrailerPlaying(false);
      } else {
        videoRef.current.play().catch(() => {
          // Handle autoplay blocked
          setIsTrailerPlaying(false);
        });
        setIsTrailerPlaying(true);
      }
    }
  };

  useEffect(() => {
    if (isHovered && videoRef.current) {
      // Try to autoplay trailer on hover
      videoRef.current.play().catch(() => {
        // Autoplay blocked, show play button
        setIsTrailerPlaying(false);
      });
    } else if (!isHovered && videoRef.current) {
      videoRef.current.pause();
      setIsTrailerPlaying(false);
    }
  }, [isHovered]);

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleCardClick = (e) => {
    console.log('MovieCard clicked:', movie.title, movie.id);
    console.log('Target route:', movie.type === 'Series' ? `/series/${movie.id}` : `/movie/${movie.id}`);
  };

  return (
    <Link 
      to={movie.type === 'Series' ? `/series/${movie.id}` : `/movie/${movie.id}`}
      className={`movie-card ${isHovered ? 'hovered' : ''} ${isTrending ? 'trending' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="movie-card-inner">
        {/* Poster Section */}
        <div className="movie-poster">
          <img 
            src={imageError ? 'https://via.placeholder.com/200x300/333333/FFFFFF?text=No+Image' : movie.poster} 
            alt={movie.title}
            className="poster-image"
            loading="lazy"
            onError={() => {
              console.log('Image failed to load:', movie.poster);
              setImageError(true);
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', movie.poster);
              setImageError(false);
            }}
          />
          
          {/* Trailer Video */}
          {movie.trailer && (
            <video
              ref={videoRef}
              className="trailer-video"
              muted
              loop
              playsInline
              poster={movie.poster}
            >
              <source src={movie.trailer} type="video/mp4" />
            </video>
          )}
          
          {/* Type Badge */}
          <div className={`type-badge type-badge--${(movie.type || 'Movie').toLowerCase().replace('_', '-')}`}>
            {movie.type === 'ShortFilm' ? 'Short' : (movie.type || 'Movie')}
          </div>

          {/* Age Rating Badge */}
          {movie.age_rating && (
            <div className="card-age-rating">
              <AgeRatingBadge rating={movie.age_rating} size="sm" showTooltip={false} />
            </div>
          )}
          
          
          {/* Play Overlay */}
          <button
            type="button"
            className="play-overlay"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const path = movie.type === 'Series' ? `/series/${movie.id}` : `/movie/${movie.id}`;
              navigate(path);
            }}
          >
            <div className="play-button">
              <FaPlay />
            </div>
          </button>

        </div>

        {/* Movie Info */}
        <div className="movie-info">
          <h3 className="movie-title">{movie.title}</h3>
          
          <div className="movie-meta">
            {movie.year && (
              <div className="movie-year">
                <FaCalendar className="calendar-icon" />
                <span>{movie.year}</span>
              </div>
            )}
            
            {movie.duration && (
              <div className="movie-duration">
                <FaClock className="clock-icon" />
                <span>{formatDuration(movie.duration)}</span>
              </div>
            )}
          </div>

          {movie.genres && movie.genres.length > 0 && (
            <div className="movie-genres">
              {movie.genres.slice(0, 2).map((genre, index) => (
                <span key={index} className="genre-tag">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hover Details Overlay */}
        <div className="movie-details">
          <div className="details-content">
            <h3 className="movie-title">{movie.title}</h3>
            
            <div className="movie-meta">
              {movie.year && (
                <div className="movie-year">
                  <FaCalendar className="calendar-icon" />
                  <span>{movie.year}</span>
                </div>
              )}
              
              {movie.duration && (
                <div className="movie-duration">
                  <FaClock className="clock-icon" />
                  <span>{formatDuration(movie.duration)}</span>
                </div>
              )}
            </div>

            {movie.genres && movie.genres.length > 0 && (
              <div className="movie-genres">
                {movie.genres.slice(0, 3).map((genre, index) => (
                  <span key={index} className="genre-tag">
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {movie.description && (
              <p className="movie-description">
                {movie.description.length > 120 
                  ? `${movie.description.substring(0, 120)}...` 
                  : movie.description
                }
              </p>
            )}

            <div className="movie-actions">
              <div className="btn-primary">
                <FaPlay />
                {movie.type === 'Series' ? 'Watch Series' : 'Watch Now'}
              </div>
              
              <div className="secondary-actions">
                <button className="btn-secondary" onClick={handleTrailerPlay}>
                  <FaBookmark />
                  Trailer
                </button>
                {user && (
                  <button 
                    className={`btn-secondary ${isInWatchlist ? 'active' : ''}`}
                    onClick={handleWatchlistToggle}
                  >
                    <FaHeart />
                    {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;