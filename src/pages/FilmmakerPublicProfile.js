/**
 * Public filmmaker profile — /filmmaker/:id. Bio, avatar, films grid, Follow button.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMovies, getFilmmakerMovies } from '../services/movieService';
import { MOCK_FILMMAKERS_BY_ID } from '../services/mockData/users';
import MovieCard from '../components/MovieCard';
import './FilmmakerPublicProfile.css';

export default function FilmmakerPublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [filmmakerFilms, setFilmmakerFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const filmmaker = MOCK_FILMMAKERS_BY_ID[id] || null;

  useEffect(() => {
    const fetchFilmmakerContent = async () => {
      setLoading(true);
      try {
        let movies = [];
        // If viewing own profile, use the specialized filmmaker endpoint
        if (user && String(user.id) === String(id)) {
          movies = await getFilmmakerMovies();
        } else {
          // Otherwise fetch public movies by this filmmaker
          movies = await getMovies({ filmmaker_id: id });
        }
        setFilmmakerFilms(movies || []);
      } catch (err) {
        console.error('Failed to fetch filmmaker movies:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchFilmmakerContent();
    }
  }, [id, user]);

  if (!filmmaker) {
    return (
      <div className="filmmaker-public-page layout-container">
        <h2>Filmmaker not found</h2>
        <Link to="/search">Search filmmakers</Link>
      </div>
    );
  }

  return (
    <div className="filmmaker-public-page layout-container">
      <div className="filmmaker-public-header">
        <div className="filmmaker-public-avatar">
          {filmmaker.avatar ? (
            <img src={filmmaker.avatar} alt="" />
          ) : (
            <span>{filmmaker.name.charAt(0)}</span>
          )}
        </div>
        <h1 className="filmmaker-public-name">{filmmaker.name}</h1>
        {filmmaker.bio && <p className="filmmaker-public-bio">{filmmaker.bio}</p>}
        {filmmaker.location && <p className="filmmaker-public-location">{filmmaker.location}</p>}
        <div className="filmmaker-public-stats">
          <span>{loading ? '...' : filmmakerFilms.length} films</span>
          <span>{filmmaker.followersCount ?? 0} followers</span>
        </div>

      </div>
      <section className="filmmaker-public-films">
        <h2>Films</h2>
        {loading ? (
          <p>Loading films...</p>
        ) : filmmakerFilms.length > 0 ? (
          <div className="filmmaker-public-grid">
            {filmmakerFilms.map((movie) => (
              <MovieCard key={movie.id} movie={movie} showWatchlist />
            ))}
          </div>
        ) : (
          <p className="filmmaker-public-empty">No films yet.</p>
        )}
      </section>
    </div>
  );
}

