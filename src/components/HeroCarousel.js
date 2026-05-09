import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight, FaPlay, FaCheck } from 'react-icons/fa';
import { useLocale } from '../context/LocaleContext';
import { useMovies } from '../context/MovieContext';
import { useAuth } from '../context/AuthContext';
import './HeroCarousel.css';

const HeroCarousel = ({ items = [] }) => {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { watchlist, mutateWatchlist } = useMovies();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());
  const [isMutating, setIsMutating] = useState(false);
  const intervalRef = useRef(null);

  // Auto-scroll functionality
  useEffect(() => {
    if (isPlaying && !isHovered && items.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
      }, 5000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, isHovered, items.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? items.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
  };

  const handleWatchNow = (movieId) => {
    navigate(`/movie/${movieId}`);
  };

  const handleAddToWatchlist = async (movieId, e) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/login');
      return;
    }

    if (!mutateWatchlist) {
      console.error("mutateWatchlist is not available in context");
      return;
    }

    if (isMutating) return;

    setIsMutating(true);
    const strId = String(movieId);
    const isInWatchlist = watchlist.includes(strId);
    
    try {
      const result = await mutateWatchlist(movieId, isInWatchlist ? 'remove' : 'add');
      
      if (!result.success) {
        alert(result.error || 'Failed to update watchlist. Please try again.');
        return;
      }

      // Show visual feedback
      if (!isInWatchlist) {
        setAddedIds((prev) => new Set([...prev, movieId]));
        setTimeout(() => {
          setAddedIds((prev) => {
            const next = new Set(prev);
            next.delete(movieId);
            return next;
          });
        }, 2000);
      }
    } finally {
      setIsMutating(false);
    }
  };

  if (!items.length) return null;

  const currentItem = items[currentIndex];
  const isCurrentInWatchlist = watchlist.includes(String(currentItem?.id));
  const isCurrentJustAdded = addedIds.has(currentItem?.id);

  return (
    <div 
      className="hero-carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="carousel-container">
        {/* Main Content */}
        <div className="carousel-content">
          <div className="carousel-track">
            {items.map((item, index) => (
              <div 
                key={item.id || index} 
                className={`carousel-slide ${index === currentIndex ? 'active' : ''}`}
              >
                <div className="slide-background">
                  <img src={item.backdrop} alt={item.title} />
                  <div className="slide-overlay"></div>
                </div>
                
                <div className="slide-content">
                  <div className="slide-info">
                    <h1 className="slide-title">{item.title}</h1>
                    <p className="slide-description">{item.description}</p>
                    <div className="slide-meta">
                      <span className="slide-year">{item.year}</span>
                      <span className="slide-rating">⭐ {item.rating}</span>
                      <span className="slide-duration">{item.duration}m</span>
                    </div>
                    <div className="slide-actions">
                      <button 
                        onClick={() => handleWatchNow(item.id)} 
                        className="btn btn-primary btn-large"
                      >
                        <FaPlay />
                        {t('watchNow')}
                      </button>
                      <button 
                        onClick={(e) => handleAddToWatchlist(item.id, e)} 
                        disabled={isMutating}
                        className={`btn ${String(item.id) === String(currentItem?.id) && isCurrentInWatchlist ? 'btn-success' : 'btn-outline'} ${isCurrentJustAdded && String(item.id) === String(currentItem?.id) ? 'btn-success' : ''}`}
                      >
                        {isMutating && String(item.id) === String(currentItem?.id) ? (
                          'Loading...'
                        ) : String(item.id) === String(currentItem?.id) && isCurrentInWatchlist ? (
                          <>
                            <FaCheck />
                            {t('addedToWatchlist')}
                          </>
                        ) : (
                          t('addToWatchlist')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        <button 
          className="carousel-arrow carousel-arrow-left"
          onClick={goToPrevious}
        >
          <FaChevronLeft />
        </button>
        <button 
          className="carousel-arrow carousel-arrow-right"
          onClick={goToNext}
        >
          <FaChevronRight />
        </button>

        {/* Pagination Dots */}
        <div className="carousel-pagination">
          {items.map((_, index) => (
            <button
              key={index}
              className={`pagination-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroCarousel;
