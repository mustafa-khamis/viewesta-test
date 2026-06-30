import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaStar, FaCalendar, FaClock, FaArrowLeft } from 'react-icons/fa';
import { useMovies } from '../context/MovieContext';
import { useAuth } from '../context/AuthContext';
import * as movieService from '../services/movieService';
import { getMovieVideoFiles, buildSourcesMap, pickBestSource, updateMovieProgress } from '../services/videoService';
import VideoPlayer from '../components/VideoPlayer';
import './Watch.css';

const Watch = () => {
  const { id } = useParams();
  const [params] = [new URLSearchParams(window.location.search)];
  const navigate = useNavigate();
  const { getMovieById, loading: contextLoading, purchasedMovies } = useMovies();
  const { user } = useAuth();

  const quality = new URLSearchParams(window.location.search).get('q') || '1080p';

  const [movie, setMovie] = useState(() => getMovieById(id));
  const [isFetching, setIsFetching] = useState(false);
  const [movieError, setMovieError] = useState('');

  // Video sources from backend video-files API
  const [sourcesMap, setSourcesMap] = useState({});
  const [sourcesLoading, setSourcesLoading] = useState(true);

  // ─── Authorization Check ───────────────────────────────────────────────
  const checkAuthorization = useCallback((m) => {
    if (!m) return false;
    if (!user) return false;
    const isFilmmaker = String(user.id) === String(m.filmmakerId || m.raw?.filmmaker_id);
    const monetizationType = m.raw?.monetization_type || m.monetization_type || 'both';
    const isSubscribed = user?.subscription?.active;
    const isPurchased = Array.isArray(purchasedMovies) && purchasedMovies.includes(String(m.id));

    if (isFilmmaker || isPurchased || (isSubscribed && (monetizationType === 'both' || monetizationType === 'subscription'))) {
      return true;
    }
    return false;
  }, [user, purchasedMovies]);

  const [isAuthorized, setIsAuthorized] = useState(() => checkAuthorization(movie));

  // ─── Sync movie with context ─────────────────────────────────────────────
  useEffect(() => {
    const ctxMovie = getMovieById(id);
    if (ctxMovie) {
      setMovie(ctxMovie);
    }
  }, [getMovieById, id]);

  // ─── Fetch movie if not in context ───────────────────────────────────────
  useEffect(() => {
    if (movie) return; // already have it
    if (contextLoading) return; // wait for context to finish first

    let active = true;
    (async () => {
      setIsFetching(true);
      try {
        const m = await movieService.getMovieById(id);
        if (active) {
          if (m) {
            setMovie(m);
          } else {
            setMovieError('Movie not found.');
          }
        }
      } catch (err) {
        if (active) setMovieError('Unable to load movie details.');
      } finally {
        if (active) setIsFetching(false);
      }
    })();
    return () => { active = false; };
  }, [id, movie, contextLoading]);

  // ─── Validate Authorization ──────────────────────────────────────────────
  useEffect(() => {
    if (movie) {
      const authorized = checkAuthorization(movie);
      setIsAuthorized(authorized);
      if (!authorized) {
         setMovieError('Unauthorized playback session. Please initiate playback from the movie details page.');
      } else {
         setMovieError('');
      }
    }
  }, [movie, checkAuthorization]);

  const isLoading = contextLoading || isFetching;

  // ─── Fetch video files from backend ──────────────────────────────────────
  useEffect(() => {
    if (!id || !isAuthorized) {
      setSourcesLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setSourcesLoading(true);
      console.log(`[Watch] Fetching dynamic signed URLs for movie ${id}...`);
      try {
        const files = await getMovieVideoFiles(id);
        if (active) {
          setSourcesMap(buildSourcesMap(files));
          console.log(`[Watch] Successfully fetched signed URLs.`);
        }
      } catch (err) {
        console.error('[Watch] Error fetching signed URLs:', err);
      } finally {
        if (active) setSourcesLoading(false);
      }
    })();
    return () => { 
      active = false;
      setSourcesMap({}); // Clear sources immediately on unmount
    };
  }, [id]);

  const handleRefreshSource = useCallback(() => {
    console.log('[Watch] Refreshing signed URLs due to expiration or playback error...');
    (async () => {
      try {
        const files = await getMovieVideoFiles(id);
        setSourcesMap(buildSourcesMap(files));
        console.log('[Watch] Refreshed signed URLs successfully.');
      } catch (err) {
        console.error('[Watch] Failed to refresh signed URLs:', err);
      }
    })();
  }, [id]);

  // ─── Watch progress tracking ──────────────────────────────────────────────
  const handleProgress = useCallback(({ currentTime, duration, percent }) => {
    if (!user || !id || !duration) return;
    // Debounce: save every ~30 seconds of watch time
    if (Math.floor(currentTime) % 30 === 0 && Math.floor(currentTime) > 0) {
      updateMovieProgress(id, {
        watch_time_seconds: Math.floor(currentTime),
        last_position_seconds: Math.floor(currentTime),
        is_completed: percent >= 95,
      });
    }
  }, [id, user]);

  // ─── Loading / error states ───────────────────────────────────────────────
  if (isLoading && !movie) {
    return (
      <div className="watch-not-found">
        <div className="loading" />
        <p>Loading movie...</p>
      </div>
    );
  }

  if (movieError || !movie) {
    return (
      <div className="watch-not-found">
        <h2>Movie not found</h2>
        <p>{movieError || "The movie you're looking for doesn't exist."}</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">Go Home</button>
      </div>
    );
  }



  // Determine best video source from dynamic endpoint
  const finalSrc = pickBestSource(sourcesMap) || '';

  return (
    <div className="watch-page">
      <div className="watch-container">
        <div className="watch-back">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-small">
            <FaArrowLeft /> Back
          </button>
        </div>

        <VideoPlayer
          src={finalSrc}
          sources={sourcesMap}
          initialQuality={quality}
          title={movie.title}
          poster={movie.backdrop || movie.poster}
          onRequestRefresh={handleRefreshSource}
          onProgress={handleProgress}
          onEnded={() => {
            // Track completion
            if (user && id) {
              updateMovieProgress(id, {
                watch_time_seconds: movie.duration * 60,
                last_position_seconds: movie.duration * 60,
                is_completed: true,
              });
            }
          }}
        />

        {sourcesLoading && (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 13, marginTop: 8 }}>
            Loading video sources…
          </div>
        )}

        <section className="watch-details">
          <h1 className="watch-title">{movie.title}</h1>
          <div className="watch-meta">
            <div className="meta-item rating">
              <FaStar className="icon" />
              <span>{movie.rating || '—'}</span>
            </div>
            <div className="meta-item">
              <FaCalendar className="icon" />
              <span>{movie.year || '—'}</span>
            </div>
            {movie.duration > 0 && (
              <div className="meta-item">
                <FaClock className="icon" />
                <span>{Math.floor(movie.duration / 60)}h {movie.duration % 60}m</span>
              </div>
            )}
          </div>
          {movie.genres?.length > 0 && (
            <div className="watch-genres">
              {movie.genres.map((g, i) => <span key={i} className="genre-tag">{g}</span>)}
            </div>
          )}
          {movie.description && (
            <p className="watch-description">{movie.description}</p>
          )}
          <div className="watch-specs">
            {movie.director && <div className="spec"><strong>Director:</strong> {movie.director}</div>}
            {Array.isArray(movie.cast) && movie.cast.length > 0 && (
              <div className="spec"><strong>Cast:</strong> {movie.cast.join(', ')}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Watch;
