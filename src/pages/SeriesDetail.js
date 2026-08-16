import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaPlay, FaHeart, FaStar, FaClock, FaCalendar,
  FaShareAlt, FaChevronDown, FaChevronUp, FaArrowLeft, FaArrowRight,
} from 'react-icons/fa';
import { useMovies } from '../context/MovieContext';
import { useAuth } from '../context/AuthContext';
import * as seriesService from '../services/seriesService';
import { getEpisodeVideoFiles, buildSourcesMap, pickBestSource } from '../services/videoService';
import MovieCard from '../components/MovieCard';
import CastCrewSection from '../components/CastCrewSection';
import MovieGallery from '../components/MovieGallery';
import AgeRatingBadge from '../components/AgeRatingBadge';
import VideoPlayer from '../components/VideoPlayer';
import './SeriesDetail.css';

const SeriesDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToWatchlist, removeFromWatchlist, watchlist, rateContent, getUserRating } = useMovies();
  const episodesRef = useRef(null);
  const { user } = useAuth();

  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState(1);
  const [seriesData, setSeriesData] = useState(null);
  const [relatedSeries, setRelatedSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Episode player state
  const [watchEpisode, setWatchEpisode] = useState(null); // { season, episode, seasonIdx, episodeIdx }
  const [episodeSources, setEpisodeSources] = useState({});
  const [episodeSourcesLoading, setEpisodeSourcesLoading] = useState(false);

  // ─── Fetch series data ──────────────────────────────────────────────────────
  const fetchSeriesDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const normalized = await seriesService.getSeriesById(id);
      // TEMPORARY: Approval filter removed for testing — show ALL content regardless of status
      // TODO: Restore approval check before production
      setSeriesData(normalized || null);
      if (normalized?.seasons?.[0]) {
        setExpandedSeason(normalized.seasons[0].seasonNumber ?? 1);
      }
      if (!normalized) setError('Series not found.');
    } catch (err) {
      setError(err?.message || 'Unable to load this series right now.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSeriesDetail();
    if (id) seriesService.viewShow(id).catch(() => {});
  }, [fetchSeriesDetail, id]);

  // ─── Fetch related series ─────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesData) return;
    let active = true;
    (async () => {
      try {
        const list = await seriesService.getSeries({ limit: 24 });
        if (!active) return;
        const filtered = list
          .filter((item) => item.id !== seriesData.id)
          .filter((item) => item.genres?.some((g) => seriesData.genres?.includes(g)))
          .slice(0, 6);
        setRelatedSeries(filtered);
      } catch {}
    })();
    return () => { active = false; };
  }, [seriesData]);

  // ─── Watchlist state ──────────────────────────────────────────────────────
  useEffect(() => {
    if (seriesData && watchlist) {
      setIsInWatchlist(watchlist.includes(seriesData.id));
    }
  }, [seriesData, watchlist]);

  // ─── Fetch episode video files when episode selected ──────────────────────
  useEffect(() => {
    if (!watchEpisode) {
      setEpisodeSources({});
      return;
    }
    let active = true;
    (async () => {
      setEpisodeSourcesLoading(true);
      setEpisodeSources({});
      console.log(`[SeriesDetail] Fetching dynamic signed URLs for episode ${watchEpisode.episode.id}...`);
      try {
        const files = await getEpisodeVideoFiles(watchEpisode.episode.id);
        if (active) {
          setEpisodeSources(buildSourcesMap(files));
          console.log(`[SeriesDetail] Successfully fetched signed URLs.`);
        }
      } catch (err) {
        console.error('[SeriesDetail] Error fetching signed URLs:', err);
      } finally { 
        if (active) setEpisodeSourcesLoading(false); 
      }
    })();
    return () => { 
      active = false;
      setEpisodeSources({}); // Cleanup on unmount or episode change
    };
  }, [watchEpisode]);

  const handleRefreshSource = useCallback(() => {
    if (!watchEpisode) return;
    console.log('[SeriesDetail] Refreshing signed URLs due to expiration or playback error...');
    (async () => {
      try {
        const files = await getEpisodeVideoFiles(watchEpisode.episode.id);
        setEpisodeSources(buildSourcesMap(files));
        console.log('[SeriesDetail] Refreshed signed URLs successfully.');
      } catch (err) {
        console.error('[SeriesDetail] Failed to refresh signed URLs:', err);
      }
    })();
  }, [watchEpisode]);






  
  // ─── Episode navigation helpers ───────────────────────────────────────────
  const getAllEpisodes = () => {
    if (!seriesData) return [];
    const result = [];
    for (const season of seriesData.seasons || []) {
      for (const ep of season.episodes || []) {
        result.push({ season, episode: ep });
      }
    }
    return result;
  };

  const getCurrentEpisodeIndex = () => {
    if (!watchEpisode) return -1;
    const all = getAllEpisodes();
    return all.findIndex(
      (e) => e.season.seasonNumber === watchEpisode.season.seasonNumber &&
             e.episode.episodeNumber === watchEpisode.episode.episodeNumber
    );
  };

  const goToEpisode = (idx) => {
    const all = getAllEpisodes();
    if (idx >= 0 && idx < all.length) {
      const { season, episode } = all[idx];
      setWatchEpisode({ season, episode });
    }
  };

  const handleWatchEpisode = (season, episode) => {
    setWatchEpisode({ season, episode });
  };

  const handleAutoplayNext = () => {
    const idx = getCurrentEpisodeIndex();
    if (idx >= 0) goToEpisode(idx + 1);
    else setWatchEpisode(null);
  };

  // ─── Loading / error states ───────────────────────────────────────────────
  if (loading && !seriesData) {
    return (
      <div className="series-detail loading-state">
        <div className="loading" />
        <p>Loading series...</p>
      </div>
    );
  }

  if (error && !seriesData) {
    return (
      <div className="series-not-found">
        <h2>Unable to load this series</h2>
        <p>{error}</p>
        <div className="error-actions">
          <button onClick={fetchSeriesDetail} className="btn btn-primary">Try Again</button>
          <button onClick={() => navigate('/series')} className="btn btn-outline">Browse Series</button>
        </div>
      </div>
    );
  }

  if (!seriesData) {
    return (
      <div className="series-not-found">
        <h2>Series not found</h2>
        <p>The series you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">Go Home</button>
      </div>
    );
  }

  const handleStartWatching = () => {
    if (episodesRef.current) episodesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleWatchlistToggle = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      if (isInWatchlist) await seriesService.unsaveShow(seriesData.id);
      else await seriesService.saveShow(seriesData.id);
    } catch {}
    if (isInWatchlist) {
      const result = await removeFromWatchlist(seriesData.id);
      if (result?.success) setIsInWatchlist(false);
    } else {
      const result = await addToWatchlist(seriesData.id);
      if (result?.success) setIsInWatchlist(true);
    }
  };

  const handleLikeToggle = async () => {
    if (!user) { navigate('/login'); return; }
    setIsLiked(!isLiked);
    try {
      if (isLiked) await seriesService.unlikeShow(seriesData.id);
      else await seriesService.likeShow(seriesData.id);
    } catch { setIsLiked(isLiked); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: seriesData.title, text: `Check out ${seriesData.title} on Viewesta`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const userRating = seriesData ? getUserRating(seriesData.id) : undefined;
  const totalEpisodes = (seriesData?.seasons || []).reduce((s, x) => s + (x.episodes?.length || 0), 0);

  const handleRate = (stars) => {
    if (!user) { navigate('/login'); return; }
    rateContent(seriesData.id, stars);
  };

  const buildGallery = (s) => {
    if (!s) return [];
    if (s.gallery?.length > 0) return s.gallery;
    const images = [];
    if (s.cover || s.backdrop) images.push({ url: s.cover || s.backdrop, caption: `${s.title} — Featured` });
    if (s.poster) images.push({ url: s.poster, caption: `${s.title} — Poster` });
    return images;
  };

  const epIdx = getCurrentEpisodeIndex();
  const allEps = getAllEpisodes();
  const hasPrev = epIdx > 0;
  const hasNext = epIdx >= 0 && epIdx < allEps.length - 1;
  const episodeVideoSrc = pickBestSource(episodeSources);

  return (
    <div className="series-detail">
      {error && (
        <div className="series-detail-alert">
          <span>{error}</span>
          <button className="btn btn-ghost btn-small" onClick={fetchSeriesDetail}>Retry</button>
        </div>
      )}

      {/* Hero */}
      <div className="series-hero">
        <div className="series-backdrop">
          <img src={seriesData.backdrop} alt={seriesData.title} />
          <div className="backdrop-overlay" />
        </div>
        <div className="series-hero-content">
          <div className="series-poster">
            <img src={seriesData.poster} alt={seriesData.title} />
          </div>
          <div className="series-info">
            <h1 className="series-title">{seriesData.title}</h1>
            <div className="detail-badges">
              {seriesData.age_rating && (
                <div className="series-age-rating">
                  <AgeRatingBadge rating={seriesData.age_rating} size="sm" showTooltip />
                </div>
              )}
            </div>
            <div className="series-meta">
              <div className="series-rating"><FaStar className="star-icon" /><span>{seriesData.rating}</span></div>
              <div className="series-year"><FaCalendar /><span>{seriesData.year}</span></div>
              <div className="series-seasons">
                <span>{seriesData.seasons.length} Season{seriesData.seasons.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {seriesData.genres?.length > 0 && (
              <div className="series-genres">
                {seriesData.genres.map((g) => <span key={g} className="genre-badge">{g}</span>)}
              </div>
            )}
            <p className="series-description">{seriesData.description}</p>
            <div className="series-details">
              <div className="detail-item"><strong>Creator:</strong> {seriesData.director || seriesData.creator || 'Unknown'}</div>
              <div className="detail-item"><strong>Cast:</strong> {Array.isArray(seriesData.cast) ? seriesData.cast.join(', ') : '—'}</div>
              <div className="detail-item"><strong>Premiered:</strong> {seriesData.raw?.release_date || seriesData.year || '—'}</div>
              <div className="detail-item"><strong>Seasons:</strong> {seriesData.seasons?.length || '—'}</div>
              {totalEpisodes > 0 && <div className="detail-item"><strong>Episodes:</strong> {totalEpisodes}</div>}
            </div>
            <div className="detail-your-rating">
              <span className="detail-your-rating-label">Your rating:</span>
              <div className="detail-stars" role="group" aria-label="Rate this series">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`detail-star-btn ${userRating >= star ? 'filled' : ''}`}
                    onClick={() => handleRate(star)}
                    aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <FaStar />
                  </button>
                ))}
              </div>
              {userRating != null && <span className="detail-your-rating-value">{userRating}/5</span>}
            </div>
            <div className="series-actions">
              <button onClick={handleStartWatching} className="btn btn-primary">
                <FaPlay /> Start Watching
              </button>
              {user && (
                <button onClick={handleWatchlistToggle} className={`btn btn-secondary ${isInWatchlist ? 'active' : ''}`}>
                  <FaHeart /> {isInWatchlist ? 'In Wishlist' : 'Add to Wishlist'}
                </button>
              )}
              {user && (
                <button onClick={handleLikeToggle} className={`btn btn-secondary ${isLiked ? 'active' : ''}`}>
                  <FaHeart style={{ color: isLiked ? '#ff4081' : 'inherit' }} />
                  {isLiked ? 'Liked' : 'Like'}
                </button>
              )}
              <button onClick={handleShare} className="btn btn-secondary">
                <FaShareAlt /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cast */}
      {seriesData.cast_crew?.length > 0 && (
        <div className="series-cast-section">
          <div className="series-cast-container">
            <CastCrewSection castCrew={seriesData.cast_crew} />
          </div>
        </div>
      )}

      {/* Gallery */}
      <div className="series-gallery-section">
        <div className="series-gallery-container">
          <MovieGallery images={buildGallery(seriesData)} title={seriesData.title} />
        </div>
      </div>

      {/* Episodes */}
      <div className="seasons-section" ref={episodesRef} id="episodes">
        <div className="seasons-container">
          <h2 className="seasons-title">Episodes</h2>
          {(!seriesData.seasons || seriesData.seasons.length === 0) && (
            <p className="seasons-empty">Episodes will appear here once they are published.</p>
          )}
          {(seriesData.seasons || []).map((season) => (
            <div key={season.seasonNumber} className="season-container">
              <div
                className="season-header"
                onClick={() => setExpandedSeason(expandedSeason === season.seasonNumber ? null : season.seasonNumber)}
              >
                <div className="season-info">
                  <h3 className="season-title">{season.title}</h3>
                  <span className="season-year">{season.year}</span>
                </div>
                <div className="season-toggle">
                  {expandedSeason === season.seasonNumber ? <FaChevronUp /> : <FaChevronDown />}
                </div>
              </div>
              {expandedSeason === season.seasonNumber && (
                <div className="episodes-list">
                  {season.episodes.map((episode) => (
                    <div key={episode.id || episode.episodeNumber} className="episode-item">
                      <div className="episode-number">{episode.episodeNumber}</div>
                      <div className="episode-content">
                        <div className="episode-header">
                          <div className="episode-title-row">
                            <h4 className="episode-title">{episode.title}</h4>
                            <span className="episode-duration"><FaClock />{episode.duration}m</span>
                          </div>
                        </div>
                        <p className="episode-description">{episode.description}</p>
                      </div>
                      <div className="episode-actions">
                        <button
                          onClick={() => handleWatchEpisode(season, episode)}
                          className="btn btn-primary btn-small"
                          aria-label={`Play ${episode.title}`}
                        >
                          <FaPlay />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Related */}
      {relatedSeries.length > 0 && (
        <div className="related-series-section">
          <div className="related-series-container">
            <h2 className="related-series-title">More Like This</h2>
            <div className="related-series-grid">
              {relatedSeries.map((related) => (
                <MovieCard key={related.id} movie={related} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Episode Watch Modal */}
      {watchEpisode && (
        <div className="modal-overlay watch-modal" onClick={() => setWatchEpisode(null)}>
          <div className="watch-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Header with navigation */}
            <div className="watch-dialog-header">
              <div className="watch-episode-nav">
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => goToEpisode(epIdx - 1)}
                  disabled={!hasPrev}
                  aria-label="Previous episode"
                >
                  <FaArrowLeft />
                </button>
                <span className="watch-dialog-title">
                  {seriesData.title} — S{watchEpisode.season.seasonNumber} E{watchEpisode.episode.episodeNumber}: {watchEpisode.episode.title}
                </span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => goToEpisode(epIdx + 1)}
                  disabled={!hasNext}
                  aria-label="Next episode"
                >
                  <FaArrowRight />
                </button>
              </div>
              <button className="modal-close" onClick={() => setWatchEpisode(null)}>×</button>
            </div>

            {episodeSourcesLoading ? (
              <div className="watch-frame-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, background: '#111' }}>
                <div className="loading" />
              </div>
            ) : (
              <div className="watch-frame-wrap">
                <VideoPlayer
                  src={episodeVideoSrc || ''}
                  sources={episodeSources}
                  title={`S${watchEpisode.season.seasonNumber} E${watchEpisode.episode.episodeNumber}: ${watchEpisode.episode.title}`}
                  poster={seriesData.backdrop || seriesData.poster}
                  onRequestRefresh={handleRefreshSource}
                  onEnded={handleAutoplayNext}
                />
              </div>
            )}

            <div className="watch-episode-info">
              <p style={{ margin: '8px 16px', color: '#aaa', fontSize: 14 }}>
                {watchEpisode.episode.description}
              </p>
              {hasNext && (
                <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn btn-primary btn-small" onClick={() => goToEpisode(epIdx + 1)}>
                    <FaArrowRight /> Next Episode
                  </button>
                  <span style={{ color: '#666', fontSize: 12 }}>
                    {allEps[epIdx + 1]?.episode?.title}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesDetail;
