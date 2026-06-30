import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaPlay, FaHeart, FaStar, FaClock, FaCalendar, FaShareAlt } from 'react-icons/fa';
import { useMovies } from '../context/MovieContext';
import { useAuth } from '../context/AuthContext';
import * as movieService from '../services/movieService';
import * as paymentService from '../services/paymentService';
// MOCK_FILMMAKERS_BY_ID removed — filmmaker data comes from API
import MovieCard from '../components/MovieCard';
import AgeRatingBadge from '../components/AgeRatingBadge';
import CastCrewSection from '../components/CastCrewSection';
import MovieGallery from '../components/MovieGallery';
import PaymentMethodModal from '../components/PaymentMethodModal';
import './MovieDetail.css';

const MovieDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getMovieById, movies, addToWatchlist, removeFromWatchlist, watchlist, rateContent, getUserRating, addToDownloads, purchasedMovies } = useMovies();
  const { user, refreshProfile } = useAuth();
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isMutatingWatchlist, setIsMutatingWatchlist] = useState(false);
  const [movie, setMovie] = useState(() => getMovieById(id));
  const [detailLoading, setDetailLoading] = useState(!getMovieById(id));
  const [detailError, setDetailError] = useState('');
  const userRating = movie ? getUserRating(movie.id) : undefined;
  // Filmmaker info fetched from movie.raw when available
  const filmmaker = null; // TODO: fetch from GET /filmmakers/:id when endpoint available
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ title: '', description: '', status: '' });

  useEffect(() => {
    setMovie(getMovieById(id));
  }, [getMovieById, id]);

  // TEMPORARY: Approval filter removed for testing — show ALL content regardless of status
  // TODO: Restore approval check before production: check approval_status === 'APPROVED'
  const fetchMovieDetail = useCallback(async () => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const normalized = await movieService.getMovieById(id);
      setMovie(normalized || null);
      if (!normalized) setDetailError('Movie not found.');
    } catch (error) {
      setDetailError(error?.message || 'Unable to load this movie right now.');
    } finally {
      setDetailLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!movie) {
      fetchMovieDetail();
    }
  }, [movie, fetchMovieDetail]);

  // Fetch related movies from real backend API
  useEffect(() => {
    if (!movie?.id) return;
    let active = true;
    (async () => {
      try {
        const related = await movieService.getRelatedMovies(movie.id, 6);
        if (active) {
          // If API returns empty, fall back to context-based genre matching
          if (related.length > 0) {
            setRelatedMovies(related);
          } else {
            const fallback = movies
              .filter((m) => m.id !== movie.id && m.genres?.some((g) => movie.genres?.includes(g)))
              .slice(0, 6);
            setRelatedMovies(fallback);
          }
        }
      } catch {
        // Fallback to context on error
        const fallback = movies
          .filter((m) => m.id !== movie.id && m.genres?.some((g) => movie.genres?.includes(g)))
          .slice(0, 6);
        if (active) setRelatedMovies(fallback);
      }
    })();
    return () => { active = false; };
  }, [movie?.id, movie?.genres, movies]);

  const getTrailerSrc = () => {
    if (!movie) return '';
    if (movie.trailer) {
      // If a direct YouTube link was provided, normalize to embed
      try {
        const url = new URL(movie.trailer);
        let videoId = '';
        if (url.hostname.includes('youtu.be')) {
          videoId = url.pathname.replace('/', '');
        } else if (url.searchParams.get('v')) {
          videoId = url.searchParams.get('v');
        }
        if (videoId) return { type: 'youtube', src: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` };
        
        // Check for direct video files
        if (url.pathname.match(/\.(mp4|webm|ogg|mov)$/i)) {
          return { type: 'video', src: movie.trailer };
        }
      } catch {}
      
      // Fallback: assume embeddable URL
      return { type: 'iframe', src: movie.trailer };
    }
    const q = encodeURIComponent(`${movie.title} official trailer`);
    return { type: 'youtube', src: `https://www.youtube.com/embed?listType=search&list=${q}&autoplay=1&rel=0` };
  };

  // Check if movie is in watchlist
  useEffect(() => {
    if (movie && watchlist) {
      setIsInWatchlist(watchlist.includes(String(movie.id)));
    }
  }, [movie, watchlist]);

  const handleDeleteMovie = async () => {
    if (window.confirm("Are you sure you want to delete this movie? This action cannot be undone.")) {
      try {
        await movieService.deleteMovie(movie.id);
        alert("Movie deleted successfully.");
        navigate('/filmmaker-studio/movies');
      } catch (err) {
        alert("Failed to delete movie.");
      }
    }
  };

  const handleEditClick = () => {
    setEditFormData({
      title: movie.title || '',
      description: movie.raw?.description || movie.description || '',
      status: movie.raw?.status || movie.status || 'pending',
    });
    setIsEditing(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await movieService.updateMovie(movie.id, editFormData);
      alert("Movie updated successfully.");
      setIsEditing(false);
      fetchMovieDetail(); // Refresh
    } catch (err) {
      alert("Failed to update movie.");
    }
  };

  if (detailLoading && !movie) {
    return (
      <div className="movie-detail loading-state">
        <div className="loading" />
        <p>Loading movie...</p>
        </div>
    );
  }

  if (detailError && !movie) {
    return (
      <div className="movie-not-found">
        <h2>Unable to load this movie</h2>
        <p>{detailError}</p>
        <div className="error-actions">
          <button onClick={fetchMovieDetail} className="btn btn-primary">
            Try Again
          </button>
          <button onClick={() => navigate('/movies')} className="btn btn-outline">
            Browse Movies
          </button>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="movie-not-found">
        <h2>Movie not found</h2>
        <p>The movie you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          Go Home
        </button>
      </div>
    );
  }

  const handleWatch = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Filmmakers should ALWAYS be able to watch THEIR OWN uploaded movies
    // without payment flow, subscription requirement, or unlock modal.
    const isFilmmaker = String(user.id) === String(movie.filmmakerId || movie.raw?.filmmaker_id);
    const monetizationType = movie.raw?.monetization_type || movie.monetization_type || 'both';
    const isSubscribed = user?.subscription?.active;
    
    // Check backend purchased state
    const isPurchased = Array.isArray(purchasedMovies) && purchasedMovies.includes(String(movie.id));
    
    if (isFilmmaker || isPurchased || (isSubscribed && (monetizationType === 'both' || monetizationType === 'subscription'))) {
      // Authorized user bypass: navigate directly to Watch.js
      addToDownloads(movie.id);
      sessionStorage.setItem(`playback_auth_${movie.id}`, 'true');
      navigate(`/watch/${movie.id}?q=${encodeURIComponent(selectedQuality || '1080p')}`);
      return;
    }

    if (monetizationType === 'subscription') {
      setSelectedQuality('');
    } else {
      setSelectedQuality(Object.keys(movie.price || {})[0] || '1080p');
    }

    // For all other users, show the unlock modal (intermediate step)
    setShowPurchaseModal(true);
  };

  const handleInitiatePurchase = () => {
    setShowPurchaseModal(false);
    setShowPaymentMethodModal(true);
  };

  const handleConfirmPurchase = async (paymentMethod) => {
    if (user) {
      setShowPaymentMethodModal(false);
      
      try {
        const response = await paymentService.purchaseMovie({
          movie_id: movie.id,
          quality: selectedQuality,
          payment_method: paymentMethod
        });

        const redirectUrl = response?.data?.redirect_url || response?.redirect_url;

        if (redirectUrl) {
          const returnUrl = `/watch/${movie.id}?q=${encodeURIComponent(selectedQuality)}`;
          sessionStorage.setItem('vw_payment_return_to', returnUrl);
          window.location.href = redirectUrl;
        } else if (response && (response.success || response.status === 'completed')) {
          // Instant wallet payment confirmed by backend
          if (refreshProfile) {
            await refreshProfile();
          }
          navigate(`/watch/${movie.id}?q=${encodeURIComponent(selectedQuality)}`);
        } else {
          alert('Failed to initiate payment. Please try again.');
        }
      } catch (error) {
        console.error('Purchase failed:', error);
        alert(error?.response?.data?.message || 'Failed to initiate payment. Please try again.');
      }
    }
  };

  const handleWatchlistToggle = async () => {
    if (user) {
      if (isMutatingWatchlist) return;
      
      setIsMutatingWatchlist(true);
      try {
        const action = isInWatchlist ? 'remove' : 'add';
        const result = action === 'add' ? await addToWatchlist(movie.id) : await removeFromWatchlist(movie.id);
        
        if (!result.success) {
          alert(result.error || 'Failed to update watchlist. Please try again.');
        } else {
          setIsInWatchlist(action === 'add');
        }
      } finally {
        setIsMutatingWatchlist(false);
      }
    } else {
      navigate('/login');
    }
  };

  /**
   * Build a gallery images array from the movie object.
   * Uses movie.gallery if present; otherwise derives from existing cover/poster fields
   * and supplements with genre-themed Unsplash photos for a richer visual experience.
   */
  const buildGallery = (m) => {
    if (!m) return [];
    // Use explicit gallery data if the movie has it
    if (m.gallery && m.gallery.length > 0) return m.gallery;

    // Genre-to-theme mapping for supplemental Unsplash images
    const themeMap = {
      Drama:    ['photo-1528360983277-13d401cdc186', 'photo-1517457373958-b7bdd4587205'],
      Comedy:   ['photo-1527529482837-4698179dc6ce', 'photo-1492684223066-81342ee5ff30'],
      Romance:  ['photo-1522673607200-164d1b6ce486', 'photo-1464366400600-7168b8af9bc3'],
      Crime:    ['photo-1477959858617-67f85cf4f1df', 'photo-1444723121867-7a241cacace9'],
      Thriller: ['photo-1518331647614-7a1f04cd34cf', 'photo-1542204165-65bf26472b9b'],
      Action:   ['photo-1547153760-18fc86324498', 'photo-1552319454-0f07c07fc399'],
      Family:   ['photo-1529156069898-49953e39b3ac', 'photo-1543269664-56d93c1b41a6'],
      Fantasy:  ['photo-1518709268805-4e9042af9f23', 'photo-1502691876148-a84978e59af8'],
      Music:    ['photo-1511671782779-c97d3d27a1d4', 'photo-1506157786151-b8491531f063'],
      War:      ['photo-1541976590-713941681591', 'photo-1575408264798-a9e5f3aeb2fc'],
      History:  ['photo-1560969184-10fe8719e047', 'photo-1568702846914-96b305d2aaeb'],
    };

    const genres = m.genres || [];
    const seen = new Set();
    const extraImages = [];
    for (const genre of genres) {
      const ids = themeMap[genre] || [];
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          extraImages.push({
            url: `https://images.unsplash.com/${id}?w=900&h=500&fit=crop&auto=format`,
            caption: `${m.title} — ${genre} scene`
          });
        }
      }
      if (extraImages.length >= 4) break;
    }

    const images = [];
    const coverUrl = m.cover || m.backdrop;
    if (coverUrl) images.push({ url: coverUrl, caption: `${m.title} — Featured` });
    if (m.poster) images.push({ url: m.poster, caption: `${m.title} — Poster` });
    images.push(...extraImages);
    return images;
  };

  // Related movies are now fetched via API useEffect above

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: movie.title,
        text: `Check out ${movie.title} on Viewesta`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleRate = (stars) => {
    if (!user) {
      navigate('/login');
      return;
    }
    rateContent(movie.id, stars);
  };

  return (
    <div className="movie-detail">
      {detailError && (
        <div className="movie-detail-alert">
          <span>{detailError}</span>
          <button className="btn btn-ghost btn-small" onClick={fetchMovieDetail}>
            Retry
          </button>
        </div>
      )}
      {/* Hero Section */}
      <div className="movie-hero">
        {movie.title !== 'Interstellar' && (
          <div className="movie-backdrop">
            <img src={movie.backdrop} alt={movie.title} />
            <div className="backdrop-overlay"></div>
          </div>
        )}
        
        <div className="movie-hero-content">
          <div className="movie-poster">
            <img src={movie.poster} alt={movie.title} />
          </div>
          
          <div className="movie-info">
            <h1 className="movie-title">{movie.title}</h1>

            {/* Badges row: Watch trailer */}
            <div className="detail-badges">
              <button onClick={() => setIsTrailerOpen(true)} className="badge badge-ghost">
                <FaPlay />
                Watch Trailer
              </button>
            </div>
            
            {/* Meta line (rating • year • duration) */}
            <div className="movie-meta">
              <div className="movie-rating">
                <FaStar className="star-icon" />
                <span>{movie.rating}</span>
              </div>
              <div className="movie-year">
                <FaCalendar />
                <span>{movie.year}</span>
              </div>
              <div className="movie-duration">
                <FaClock />
                <span>{Math.floor(movie.duration / 60)}h {movie.duration % 60}m</span>
              </div>
            </div>

            {/* Description */}
            <p className="movie-description">{movie.description}</p>

            {/* Two-column specs grid */}
            <div className="specs-grid">
              <div className="specs-col">
                <div className="spec-item"><strong>Released:</strong> {movie.year}</div>
                <div className="spec-item"><strong>Genre:</strong> {movie.genres.join(', ')}</div>
                <div className="spec-item"><strong>Director:</strong> {movie.director}</div>
              </div>
              <div className="specs-col">
                <div className="spec-item"><strong>Duration:</strong> {Math.floor(movie.duration / 60)}h {movie.duration % 60}m</div>
                <div className="spec-item"><strong>Cast:</strong> {movie.cast.join(', ')}</div>
              </div>
            </div>

            {/* Cast & Crew - MOVED outside hero */}
            
            {/* Age Rating */}
            {movie.age_rating && (
              <div className="detail-age-rating">
                <AgeRatingBadge rating={movie.age_rating} size="md" showTooltip />
              </div>
            )}

            {/* Filmmaker who uploaded */}
            {filmmaker && (
              <div className="detail-filmmaker">
                <strong>Uploaded by:</strong>{' '}
                <Link to={`/filmmaker/${filmmaker.id}`} className="detail-filmmaker-link">
                  {filmmaker.name}
                </Link>
              </div>
            )}

            {/* Your rating (viewer) */}
            <div className="detail-your-rating">
              <span className="detail-your-rating-label">Your rating:</span>
              <div className="detail-stars" role="group" aria-label="Rate this movie">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`detail-star-btn ${userRating >= star ? 'filled' : ''}`}
                    onClick={() => handleRate(star)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRate(star)}
                    aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <FaStar />
                  </button>
                ))}
              </div>
              {userRating != null && (
                <span className="detail-your-rating-value">{userRating}/5</span>
              )}
            </div>

            {/* Actions */}
            <div className="movie-actions">
              <div className="primary-cta">
                <button 
                  onClick={handleWatch} 
                  className="btn btn-primary"
                >
                  <FaPlay />
                  {user?.subscription?.active ? 'Watch Now' : 'Watch'}
                </button>
                <button 
                  onClick={user ? handleWatchlistToggle : () => navigate('/login')}
                  disabled={isMutatingWatchlist}
                  className={`btn btn-secondary wishlist-btn ${isInWatchlist ? 'active' : ''}`}
                  title={!user ? "Log in to add to your wishlist" : (isInWatchlist ? "Remove from wishlist" : "Add to wishlist")}
                >
                  <FaHeart className={isInWatchlist && !isMutatingWatchlist ? "heart-beat" : ""} />
                  {isMutatingWatchlist ? 'Wait...' : (isInWatchlist ? 'In Wishlist' : 'Wishlist')}
                </button>
              </div>
              <div className="secondary-cta">
                <button onClick={handleShare} className="btn btn-secondary">
                  <FaShareAlt />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cast & Crew Section */}
      {movie.cast_crew && movie.cast_crew.length > 0 && (
        <div className="movie-cast-section">
          <div className="movie-cast-container">
            <CastCrewSection castCrew={movie.cast_crew} />
          </div>
        </div>
      )}

      {/* Gallery Section */}
      {movie && (
        <div className="movie-gallery-section">
          <div className="movie-gallery-container">
            <MovieGallery images={buildGallery(movie)} title={movie.title} />
          </div>
        </div>
      )}

      {/* Related Movies Section */}
      {relatedMovies.length > 0 && (
        <div className="related-movies-section">
          <div className="related-movies-container">
            <h2 className="related-movies-title">More Like This</h2>
            <div className="related-movies-grid">
              {relatedMovies.map((relatedMovie) => (
                <MovieCard key={relatedMovie.id} movie={relatedMovie} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filmmaker Controls (Edit / Delete) */}
      {user && movie && String(user.id) === String(movie.filmmakerId || movie.raw?.filmmaker_id) && (
        <div className="filmmaker-controls-section" style={{ margin: '2rem auto', padding: '2rem', background: 'var(--card-bg)', borderRadius: 'var(--radius)', maxWidth: '1200px' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Filmmaker Controls</h2>
          {!isEditing ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleEditClick} className="btn btn-secondary">Edit Movie</button>
              <button onClick={handleDeleteMovie} className="btn btn-outline" style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}>Delete Movie</button>
            </div>
          ) : (
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: '500' }}>Title</label>
                <input 
                  type="text" 
                  value={editFormData.title} 
                  onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: '500' }}>Description</label>
                <textarea 
                  value={editFormData.description} 
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  required
                  rows="5"
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: '500' }}>Status</label>
                <select 
                  value={editFormData.status} 
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="draft">Draft</option>
                </select>
                <small style={{ color: 'var(--text-secondary)' }}>Note: Status changes may require admin review depending on platform policies.</small>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Purchase Modal: Subscribe or Pay-per-view */}
      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="purchase-modal">
            <div className="modal-header">
              <h3>Watch Options</h3>
              <button 
                onClick={() => setShowPurchaseModal(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="watch-options-tabs">
                {((movie?.raw?.monetization_type || movie?.monetization_type || 'both') === 'both' || (movie?.raw?.monetization_type || movie?.monetization_type) === 'subscription') && (
                  <button
                    type="button"
                    className={`option-tab ${selectedQuality ? '' : 'active'}`}
                    onClick={() => setSelectedQuality('')}
                  >
                    Subscribe
                  </button>
                )}
                {((movie?.raw?.monetization_type || movie?.monetization_type || 'both') === 'both' || (movie?.raw?.monetization_type || movie?.monetization_type) === 'pay_per_view') && (
                  <button
                    type="button"
                    className={`option-tab ${selectedQuality ? 'active' : ''}`}
                    onClick={() => setSelectedQuality(Object.keys(movie.price || {})[0] || '1080p')}
                  >
                    Pay-per-view
                  </button>
                )}
              </div>

              {selectedQuality ? (
                <>
                  <div className="quality-options">
                    {Object.entries(movie.price || {}).map(([quality, price]) => (
                      <label 
                        key={quality} 
                        className={`quality-option ${selectedQuality === quality ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="quality"
                          value={quality}
                          checked={selectedQuality === quality}
                          onChange={(e) => setSelectedQuality(e.target.value)}
                        />
                        <div className="quality-info">
                          <span className="quality-name">{quality}</span>
                          <span className="quality-price">${price}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="purchase-summary">
                    <div className="summary-item">
                      <span>Movie:</span>
                      <span>{movie.title}</span>
                    </div>
                    <div className="summary-item">
                      <span>Quality:</span>
                      <span>{selectedQuality}</span>
                    </div>
                    <div className="summary-item total">
                      <span>Total:</span>
                      <span>${(movie.price || {})[selectedQuality] ?? 0}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="subscribe-option">
                  <p>Get unlimited access to all movies with a monthly subscription.</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/subscription?return_to=${encodeURIComponent(`/watch/${movie.id}?q=${selectedQuality || '1080p'}`)}&movie_id=${movie.id}`)}
                  >
                    View Plans
                  </button>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowPurchaseModal(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              {selectedQuality ? (
                <button 
                  onClick={handleInitiatePurchase}
                  className="btn btn-primary"
                >
                  Purchase & Watch
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Trailer Modal */}
      {isTrailerOpen && (
        <div className="modal-overlay trailer-modal" onClick={() => setIsTrailerOpen(false)}>
          <div className="trailer-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsTrailerOpen(false)}>×</button>
            <div className="trailer-frame-wrap">
              {(() => {
                const trailerData = getTrailerSrc();
                if (trailerData.type === 'video') {
                  return (
                    <video 
                      src={trailerData.src} 
                      controls 
                      autoPlay 
                      className="trailer-video-player"
                    >
                      Your browser does not support the video tag.
                    </video>
                  );
                }
                return (
                  <iframe
                    src={trailerData.src}
                    title={`${movie.title} Trailer`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    onError={(e) => { e.target.style.display='none'; alert('Trailer failed to load'); }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <PaymentMethodModal
        isOpen={showPaymentMethodModal}
        onClose={() => setShowPaymentMethodModal(false)}
        onContinue={handleConfirmPurchase}
        amount={Number((movie.price || {})[selectedQuality] ?? 0)}
        title={`Purchase ${movie.title}`}
      />
    </div>
  );
};

export default MovieDetail;