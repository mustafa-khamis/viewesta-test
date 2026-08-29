import React, { useState } from 'react';
import { FaPlus, FaTrash, FaChevronDown, FaChevronUp, FaFilm } from 'react-icons/fa';
import './EpisodeBuilder.css';

/**
 * EpisodeBuilder — manage seasons and episodes for a series upload.
 *
 * Data shape:
 *   seasons: [
 *     { season_number: 1, title: 'Season 1', year: 2024, episodes: [
 *       { id: 'ep-1-1', episode_number: 1, title: '', description: '', duration: '', video_url: '' }
 *     ]}
 *   ]
 *
 * @param {{ seasons: Array, onChange: (seasons: Array) => void, error: string }} props
 */
const EpisodeBuilder = ({ seasons = [], onChange, error }) => {
  const [expandedSeasons, setExpandedSeasons] = useState(new Set([0]));

  // ── Season operations ────────────────────────────────────────────────────

  const addSeason = () => {
    const next = [
      ...seasons,
      {
        season_number: seasons.length + 1,
        title: `Season ${seasons.length + 1}`,
        year: new Date().getFullYear(),
        episodes: [makeEmptyEpisode(1)],
      },
    ];
    onChange(next);
    setExpandedSeasons((s) => new Set([...s, seasons.length]));
  };

  const removeSeason = (seasonIdx) => {
    const next = seasons
      .filter((_, i) => i !== seasonIdx)
      .map((s, i) => ({ ...s, season_number: i + 1, title: `Season ${i + 1}` }));
    onChange(next);
    setExpandedSeasons((s) => {
      const ns = new Set(s);
      ns.delete(seasonIdx);
      return ns;
    });
  };

  const updateSeason = (seasonIdx, field, value) => {
    const next = seasons.map((s, i) =>
      i === seasonIdx ? { ...s, [field]: value } : s
    );
    onChange(next);
  };

  const toggleSeason = (seasonIdx) => {
    setExpandedSeasons((s) => {
      const ns = new Set(s);
      if (ns.has(seasonIdx)) ns.delete(seasonIdx);
      else ns.add(seasonIdx);
      return ns;
    });
  };

  // ── Episode operations ───────────────────────────────────────────────────

  const addEpisode = (seasonIdx) => {
    const season = seasons[seasonIdx];
    const nextEp = makeEmptyEpisode(season.episodes.length + 1);
    const next = seasons.map((s, i) =>
      i === seasonIdx ? { ...s, episodes: [...s.episodes, nextEp] } : s
    );
    onChange(next);
  };

  const removeEpisode = (seasonIdx, episodeIdx) => {
    const next = seasons.map((s, i) =>
      i === seasonIdx
        ? {
            ...s,
            episodes: s.episodes
              .filter((_, ei) => ei !== episodeIdx)
              .map((ep, ei) => ({ ...ep, episode_number: ei + 1 })),
          }
        : s
    );
    onChange(next);
  };

  const updateEpisode = (seasonIdx, episodeIdx, field, value) => {
    const next = seasons.map((s, i) =>
      i === seasonIdx
        ? {
            ...s,
            episodes: s.episodes.map((ep, ei) =>
              ei === episodeIdx ? { ...ep, [field]: value } : ep
            ),
          }
        : s
    );
    onChange(next);
  };

  const makeEmptyEpisode = (num) => ({
    id: `ep-new-${Date.now()}-${num}`,
    episode_number: num,
    title: '',
    description: '',
    duration: '',
    video_file: null,
    video_url: '',
  });

  const totalEpisodes = seasons.reduce((acc, s) => acc + (s.episodes?.length || 0), 0);

  return (
    <div className="episode-builder">
      {/* Header */}
      <div className="eb-header">
        <div className="eb-header-left">
          <FaFilm className="eb-icon" />
          <div>
            <h3 className="eb-title">Seasons &amp; Episodes</h3>
            <p className="eb-subtitle">
              {seasons.length} season{seasons.length !== 1 ? 's' : ''} · {totalEpisodes} episode{totalEpisodes !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button type="button" className="eb-add-season" onClick={addSeason}>
          <FaPlus /> Add Season
        </button>
      </div>

      {error && (
        <p className="eb-error" role="alert">{error}</p>
      )}

      {/* Seasons List */}
      <div className="eb-seasons">
        {seasons.length === 0 ? (
          <div className="eb-empty">
            <p>No seasons yet. Click "Add Season" to get started.</p>
          </div>
        ) : (
          seasons.map((season, seasonIdx) => (
            <div key={seasonIdx} className="eb-season">
              {/* Season Header */}
              <div className="eb-season-header">
                <button
                  type="button"
                  className="eb-season-toggle"
                  onClick={() => toggleSeason(seasonIdx)}
                  aria-expanded={expandedSeasons.has(seasonIdx)}
                >
                  {expandedSeasons.has(seasonIdx) ? <FaChevronUp /> : <FaChevronDown />}
                  <span className="eb-season-label">
                    <input
                      type="text"
                      className="eb-season-title-input"
                      value={season.title}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateSeason(seasonIdx, 'title', e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Season title"
                      aria-label={`Season ${seasonIdx + 1} title`}
                    />
                  </span>
                  <span className="eb-season-count">
                    {season.episodes?.length || 0} ep
                  </span>
                </button>
                <div className="eb-season-meta">
                  <input
                    type="number"
                    className="eb-year-input"
                    value={season.year || ''}
                    onChange={(e) => updateSeason(seasonIdx, 'year', e.target.value)}
                    placeholder="Year"
                    min="1900"
                    max="2030"
                    aria-label="Season year"
                  />
                  {seasons.length > 1 && (
                    <button
                      type="button"
                      className="eb-remove-season"
                      onClick={() => removeSeason(seasonIdx)}
                      aria-label={`Remove ${season.title}`}
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>

              {/* Episodes */}
              {expandedSeasons.has(seasonIdx) && (
                <div className="eb-episodes">
                  {season.episodes?.map((episode, episodeIdx) => (
                    <div key={episode.id || episodeIdx} className="eb-episode">
                      <div className="eb-episode-num">{episode.episode_number}</div>
                      <div className="eb-episode-fields">
                        <div className="eb-row">
                          <div className="eb-field eb-field--title">
                            <label>Title *</label>
                            <input
                              type="text"
                              value={episode.title}
                              onChange={(e) => updateEpisode(seasonIdx, episodeIdx, 'title', e.target.value)}
                              placeholder={`Episode ${episode.episode_number} title`}
                              required
                            />
                          </div>
                          <div className="eb-field eb-field--duration">
                            <label>Duration (min)</label>
                            <input
                              type="number"
                              value={episode.duration}
                              onChange={(e) => updateEpisode(seasonIdx, episodeIdx, 'duration', e.target.value)}
                              placeholder="45"
                              min="1"
                            />
                          </div>
                        </div>
                        <div className="eb-row">
                          <div className="eb-field eb-field--desc">
                            <label>Description</label>
                            <textarea
                              value={episode.description}
                              onChange={(e) => updateEpisode(seasonIdx, episodeIdx, 'description', e.target.value)}
                              placeholder="Episode synopsis..."
                              rows={2}
                            />
                          </div>
                        </div>
                        <div className="eb-row">
                          <div className="eb-field eb-field--video">
                            <label>Video File</label>
                            <input
                              type="file"
                              accept="video/mp4,video/webm"
                              onChange={(e) => updateEpisode(seasonIdx, episodeIdx, 'video_file', e.target.files[0])}
                            />
                            {episode.video_file && (
                              <div className="eb-file-selected">
                                Selected: {episode.video_file.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {season.episodes.length > 1 && (
                        <button
                          type="button"
                          className="eb-remove-episode"
                          onClick={() => removeEpisode(seasonIdx, episodeIdx)}
                          aria-label={`Remove episode ${episode.episode_number}`}
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="eb-add-episode"
                    onClick={() => addEpisode(seasonIdx)}
                  >
                    <FaPlus /> Add Episode
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EpisodeBuilder;
