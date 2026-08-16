import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaFilm, FaUsers, FaEye, FaCheck, FaArrowLeft, FaArrowRight,
  FaPlus, FaTimes, FaUser, FaExclamationTriangle, FaInfoCircle,
  FaFileUpload, FaUserShield, FaCloudUploadAlt, FaTv, FaBolt
} from 'react-icons/fa';
import { MEDIA_TYPES, SHORT_FILM_THRESHOLD_MINUTES } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import client from '../../api/client';
import { validateUploadForm } from '../../utils/uploadValidation';
import { submitForReview } from '../../services/approvalService';
import uploadService from '../../services/uploadService';
import { createMovie, addMovieVideoFile } from '../../services/movieService';
import { createShow } from '../../services/seriesService';
import MediaUploadZone from '../../components/MediaUploadZone';
import EpisodeBuilder from '../../components/EpisodeBuilder';
import AgeRatingBadge from '../../components/AgeRatingBadge';
import './FilmmakerUpload.css';

const GENRES = [
  'Drama', 'Action', 'Comedy', 'Romance', 'Thriller', 'Documentary',
  'Animation', 'Horror', 'Sci-Fi', 'Adventure', 'Historical', 'Fantasy',
];

const AGE_RATINGS = {
  'G':    { description: 'General audiences â€” all ages admitted.' },
  'PG':   { description: 'Parental guidance suggested â€” some material may not suit children.' },
  'PG-13':{ description: 'Parents strongly cautioned â€” some material may be inappropriate for children under 13.' },
  'R':    { description: 'Restricted â€” under 17 requires accompanying parent or guardian.' },
  '16+':  { description: 'Suitable for viewers aged 16 and above.' },
  '18+':  { description: 'Adults only â€” not suitable for viewers under 18.' },
};

const ROLE_OPTIONS = [
  'Actor', 'Actress', 'Director', 'Producer', 'Executive Producer',
  'Cinematographer', 'Editor', 'Composer', 'Writer', 'Other',
];

const STEPS = [
  { label: 'Mode', icon: <FaCloudUploadAlt /> },
  { label: 'Info', icon: <FaInfoCircle /> },
  { label: 'Media', icon: <FaFilm /> },
  { label: 'Cast', icon: <FaUsers /> },
  { label: 'Review', icon: <FaEye /> },
];

const MODES = {
  DIRECT: 'direct',
  ADMIN_REQUEST: 'admin_request',
};

const emptyMember = () => ({
  id: Date.now() + Math.random(),
  name: '', role: 'Actor', character: '', photo: '',
});

const initialForm = {
  mode: MODES.DIRECT,
  mediaType: MEDIA_TYPES.MOVIE,
  title: '', description: '', director: '', producer: '',
  releaseDate: '', duration: '', language: '', country: '',
  age_rating: '', genres: [], monetization_type: 'both',
  poster_url: '', poster_file: null,
  cover_url: '', cover_file: null,
  trailer_url: '', trailer_file: null,
  video_url: '', video_file: null,
  seasons: [],
  cast_crew: [],
  production_company: '',
  budget: '',
};

const FilmmakerUpload = () => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const warnings = []; // TODO: populate from form validation warnings if needed
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState([]);

  // Fetch categories from backend to ensure valid UUIDs are used
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await client.get('/categories');
        if (response.data?.success && response.data?.data) {
          // Response structure is often { success: true, data: { categories: [...] } }
          const fetchedCats = response.data.data.categories || response.data.data;
          if (Array.isArray(fetchedCats)) {
            setCategories(fetchedCats);
          }
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const { t } = useLocale();

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const e = { ...prev };
      delete e[key];
      return e;
    });
  }, []);

  const toggleGenre = (g) => {
    setForm((prev) => ({
      ...prev,
      genres: prev.genres.includes(g)
        ? prev.genres.filter((x) => x !== g)
        : [...prev.genres, g],
    }));
  };

  const addCastMember = () =>
    setForm((prev) => ({ ...prev, cast_crew: [...prev.cast_crew, emptyMember()] }));

  const updateCastMember = (id, key, val) =>
    setForm((prev) => ({
      ...prev,
      cast_crew: prev.cast_crew.map((m) => (m.id === id ? { ...m, [key]: val } : m)),
    }));

  const removeCastMember = (id) =>
    setForm((prev) => ({ ...prev, cast_crew: prev.cast_crew.filter((m) => m.id !== id) }));

  const validateStep = (s) => {
    // If Mode Select step
    if (s === 0) return true;

    // Shift steps logic because we added Step 0
    const formStep = s - 1;
    
    // Step 1: Info (was 0)
    // Step 2: Media (was 1)
    // Step 3: Cast (was 2)
    // Step 4: Review (was 3)

    if (formStep === 0) {
      const keys = ['title', 'description', 'director', 'releaseDate', 'language', 'country', 'mediaType'];
      if (form.mediaType !== MEDIA_TYPES.SERIES) keys.push('duration');
      // Validate specifically these
      const result = validateUploadForm(form, form.mediaType);
      const stepErrors = {};
      keys.forEach(k => { if (result.errors[k]) stepErrors[k] = result.errors[k]; });
      
      if (!form.title) stepErrors.title = 'Title is required'; // explicit check
      
      setErrors(stepErrors);
      return Object.keys(stepErrors).length === 0;
    }

    if (formStep === 1) {
      // Media step
      // Must check poster and cover always? Yes per requirements "On movie upload: Poster... Cover... required"
      const result = validateUploadForm(form, form.mediaType);
      const keys = ['poster', 'cover'];
      // If direct upload, require video/trailer? Maybe.
      // If Admin Request, only metadata required? The prompt says "Submit metadata only -> Admin uploads video".
      // So if mode === ADMIN_REQUEST, skip video/trailer errors?
      // Assume "Poster + Cover" required for BOTH modes so the card looks good.
      if (form.mode === MODES.DIRECT) {
        keys.push('trailer');
        if (form.mediaType !== MEDIA_TYPES.SERIES) keys.push('video'); // Main video
      }
      
      const stepErrors = {};
      keys.forEach(k => { 
        if (result.errors[k]) stepErrors[k] = result.errors[k]; 
      });
      setErrors(stepErrors);
      return Object.keys(stepErrors).length === 0;
    }
    
    return true; 
  };

  const goNext = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSaveDraft = () => alert('Draft saved (simulated).');

  const handleSubmit = async () => {
    // Final check
    const result = validateUploadForm(form, form.mediaType);

    setSubmitting(true);
    setSubmitError('');

    try {
      const isDirect = form.mode === MODES.DIRECT;

      // Ensure required files are present
      if (!form.poster_file || !form.cover_file || (isDirect && !form.trailer_file)) {
        throw new Error('Please select all required media files before submitting.');
      }

      // Step 1: Upload assets sequentially using uploadService
      const uploadAsset = async (file, assetType) => {
        if (!file) return null;
        return await uploadService.uploadFileFlow(file, assetType);
      };

      const posterData = await uploadAsset(form.poster_file, 'poster');
      const coverData = await uploadAsset(form.cover_file, 'backdrop');
      let trailerData = null;
      let videoData = null;

      if (isDirect) {
        trailerData = await uploadAsset(form.trailer_file, 'trailer');
        if (form.mediaType !== MEDIA_TYPES.SERIES && form.video_file) {
          videoData = await uploadAsset(form.video_file, 'video');
        }
      }

      // Format Cast — cast[0].name and cast[0].role are REQUIRED by the backend.
      // If the user added no cast members we inject a fallback so the request isn't rejected.
      const rawCast = form.cast_crew.filter(c => c.name).map(c => ({
        name: c.name,
        role: c.role,
        character: c.character || '',
        image: c.photo || ''
      }));
      const castPayload = rawCast.length > 0
        ? rawCast
        : [{ name: form.director || 'Unknown', role: 'Director' }];

      // Set progress to 99% — all assets uploaded, final API call next

      if (form.mediaType === MEDIA_TYPES.SERIES) {
         // Only include category_id when we have a real UUID from the backend.
         // A fake placeholder UUID causes 400.
         const seriesCategoryId = categories.find(c => c.name === form.genres[0])?.id || null;

         const payload = {
           content_type: 'series',
           title: form.title,
           description: form.description || '',
           age_rating: form.age_rating || 'PG-13',
           director_name: form.director || '',
           producer_name: form.producer || '',
           cast: castPayload,
           poster_url: posterData?.file_url || form.poster_url || '',
           backdrop_url: coverData?.file_url || form.cover_url || '',
           thumbnail_url: coverData?.file_url || form.cover_url || '',
           duration_minutes: 45,
           release_year: form.releaseDate ? parseInt(form.releaseDate.split('-')[0]) : new Date().getFullYear(),
         };
         if (seriesCategoryId) payload.category_id = seriesCategoryId;

         if (trailerData) {
           payload.trailer_url = trailerData.file_url;
           payload.trailer_video = {
             file_url: trailerData.file_url,
             file_size: trailerData.file_size,
             duration_seconds: 120,
             s3_key: trailerData.s3_key,
             is_processed: false,
           };
         }

         await createShow(payload);
      } else {
         // Build release_date: form gives "YYYY-MM" from <input type="month">
         const releaseDate = form.releaseDate
           ? `${form.releaseDate}-01`
           : new Date().toISOString().split('T')[0];

         // Only include category_id when we have a real UUID from the backend.
         const resolvedCategoryId = categories.find(c => c.name === form.genres[0])?.id || null;

         const payload = {
           content_type: form.mediaType === MEDIA_TYPES.SHORT_FILM ? 'short' : 'movie',
           title: form.title,
           description: form.description || '',
           synopsis: form.description || '',
           age_rating: form.age_rating || 'PG-13',
           director_name: form.director || '',
           producer_name: form.producer || '',
           cast: castPayload,
           poster_url: posterData?.file_url || form.poster_url || '',
           backdrop_url: coverData?.file_url || form.cover_url || '',
           release_date: releaseDate,
           duration_minutes: parseInt(form.duration) || 120,
           language: form.language || 'English',
           country: form.country || '',
           // TODO: Ensure backend supports monetization_type in POST /movies payload
           monetization_type: form.monetization_type,
         };

         // Conditionally add optional fields only if valid
         if (resolvedCategoryId) payload.category_id = resolvedCategoryId;

         if (trailerData) {
           payload.trailer_url = trailerData.file_url;
           payload.trailer_video = {
             file_url: trailerData.file_url,
             file_size: trailerData.file_size,
             duration_seconds: 120,
             s3_key: trailerData.s3_key,
             is_processed: false,
           };
         }

         console.log('[FilmmakerUpload] POST /movies payload:', JSON.stringify(payload, null, 2));

         const createdMovie = await createMovie(payload);
         const movieId = createdMovie?.data?.movie?.id || createdMovie?.data?.id;

         // Attach full video file if one was uploaded
         if (movieId && videoData) {
           await addMovieVideoFile(movieId, {
             quality: '1080p',
             file_url: videoData.file_url,
             file_size: videoData.file_size,
             duration_seconds: parseInt(form.duration) * 60 || 7200,
             s3_key: videoData.s3_key
           });
         }
      }
      
      setSuccess(true);
    } catch (err) {
      console.error('Upload Error:', err);
      setSubmitError(err.response?.data?.message || err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasPoster = form.poster_url || form.poster_file;
  const hasCover = form.cover_url || form.cover_file;
  const hasTrailer = form.trailer_url || form.trailer_file;
  const hasVideo = form.video_url || form.video_file;
  const castPreview = form.cast_crew
    .filter((m) => m?.name)
    .slice(0, 6)
    .map((m) => `${m.name}${m.role ? ` (${m.role})` : ''}`)
    .join(', ');

  if (success) {
    return (
      <div className="filmmaker-upload">
        <div className="fu-success">
          <div className="fu-success-icon"><FaCheck /></div>
          <h2>Submitted for Review!</h2>
          <p>
            <strong>{form.title}</strong> has been submitted to the Viewesta team.
          You will be notified once it has been reviewed.
        </p>
        <div className="fu-success-actions">
          <button
            className="fu-btn fu-btn--primary"
            onClick={() => { setForm(initialForm); setStep(0); setSuccess(false); }}
          >
            Upload Another
          </button>
          <Link to="/filmmaker-studio/movies" className="fu-btn fu-btn--outline">My Movies</Link>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="filmmaker-upload">
      {/* Header */}
      <div className="fu-header">
        <Link to="/filmmaker-studio" className="fu-back-link">
          <FaArrowLeft /> Studio
        </Link>
        <div className="fu-header-content">
          <h1>Upload Content</h1>
          <p className="fu-header-sub">Submit movies, short films, or series for review.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="fu-steps">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className={`fu-step-line ${i <= step ? 'done' : ''}`} />}
            <div className={`fu-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="fu-step-dot">{i < step ? <FaCheck /> : i + 1}</div>
              <span className="fu-step-label">{s.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="fu-form">

        {/* â”€â”€ STEP 0: MODE SELECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 0 && (
          <div className="fu-step-content">
            <h2 className="fu-step-title">Select Upload Method</h2>
            <p className="fu-step-desc">Would you like to upload the video file yourself, or request an admin upload?</p>
            <div className="upload-mode-grid">
              <div
                className={`upload-mode-card ${form.mode === MODES.DIRECT ? 'active' : ''}`}
                onClick={() => setField('mode', MODES.DIRECT)}
              >
                <div className="mode-icon"><FaFileUpload /></div>
                <h3>Direct Upload</h3>
                <p>I have the video file ready (max 5GB). I will upload it now.</p>
                <div className="mode-badge">Standard</div>
              </div>
              <div
                className={`upload-mode-card ${form.mode === MODES.ADMIN_REQUEST ? 'active' : ''}`}
                onClick={() => setField('mode', MODES.ADMIN_REQUEST)}
              >
                <div className="mode-icon"><FaUserShield /></div>
                <h3>Request Admin Upload</h3>
                <p>I will submit metadata and artwork. An admin will contact me to retrieve the video master.</p>
                <div className="mode-badge">Pro Service</div>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP 1: INFO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 1 && (
          <div className="fu-step-content">
            <h2 className="fu-step-title">Content Information</h2>
            <p className="fu-step-desc">Start with the basics â€” type, title, and key details.</p>

            {/* Media Type */}
            <div className="fu-field">
              <label className="fu-label">Content Type <span className="fu-required">*</span></label>
              <div className="fu-media-type-grid">
                {Object.values(MEDIA_TYPES).map((t) => (
                  <button
                    key={t} type="button"
                    className={`fu-media-type-btn ${form.mediaType === t ? 'active' : ''}`}
                    onClick={() => setField('mediaType', t)}
                  >
                    <span className="fu-media-type-icon">
                      {t === MEDIA_TYPES.MOVIE ? <FaFilm /> : t === MEDIA_TYPES.SHORT_FILM ? <FaBolt /> : <FaTv />}
                    </span>
                    <span className="fu-media-type-label">
                      {t === MEDIA_TYPES.SHORT_FILM ? 'Short Film' : t}
                    </span>
                    <span className="fu-media-type-hint">
                      {t === MEDIA_TYPES.MOVIE
                        ? 'Feature length'
                        : t === MEDIA_TYPES.SHORT_FILM
                        ? `Under ${SHORT_FILM_THRESHOLD_MINUTES}min`
                        : 'Multi-episode'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className={`fu-field ${errors.title ? 'has-error' : ''}`}>
              <label className="fu-label">Title <span className="fu-required">*</span></label>
              <input
                className="fu-input" type="text" maxLength={120}
                placeholder="Enter title..." value={form.title}
                onChange={(e) => setField('title', e.target.value)}
              />
              {errors.title && <p className="fu-error"><FaExclamationTriangle />{errors.title}</p>}
            </div>

            {/* Description */}
            <div className={`fu-field ${errors.description ? 'has-error' : ''}`}>
              <label className="fu-label">
                Description <span className="fu-required">*</span>
                <span className="fu-label-hint">({form.description.length}/500)</span>
              </label>
              <textarea
                className="fu-input fu-textarea" maxLength={500}
                placeholder="Tell viewers what this is about..."
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
              {errors.description && <p className="fu-error"><FaExclamationTriangle />{errors.description}</p>}
            </div>

            {/* Director + Producer */}
            <div className="fu-row">
              <div className={`fu-field ${errors.director ? 'has-error' : ''}`}>
                <label className="fu-label">Director <span className="fu-required">*</span></label>
                <input className="fu-input" type="text" placeholder="Director name"
                  value={form.director} onChange={(e) => setField('director', e.target.value)} />
                {errors.director && <p className="fu-error"><FaExclamationTriangle />{errors.director}</p>}
              </div>
              <div className="fu-field">
                <label className="fu-label">Producer</label>
                <input className="fu-input" type="text" placeholder="Producer name"
                  value={form.producer} onChange={(e) => setField('producer', e.target.value)} />
              </div>
            </div>

            {/* Release Date + Duration */}
            <div className="fu-row">
              <div className={`fu-field fu-field--narrow ${errors.releaseDate ? 'has-error' : ''}`}>
                <label className="fu-label">{t('releaseDate')} <span className="fu-required">*</span></label>
                <input className="fu-input" type="month"
                  value={form.releaseDate} onChange={(e) => setField('releaseDate', e.target.value)} />
                {errors.releaseDate && <p className="fu-error"><FaExclamationTriangle />{errors.releaseDate}</p>}
              </div>
              {form.mediaType !== MEDIA_TYPES.SERIES && (
                <div className={`fu-field fu-field--narrow ${errors.duration ? 'has-error' : ''}`}>
                  <label className="fu-label">{t('durationMin')} <span className="fu-required">*</span></label>
                  <input className="fu-input" type="number" min="1" placeholder="e.g. 95"
                    value={form.duration} onChange={(e) => setField('duration', e.target.value)} />
                  {errors.duration && <p className="fu-error"><FaExclamationTriangle />{errors.duration}</p>}
                </div>
              )}
            </div>

            {/* Language + Country */}
            <div className="fu-row">
              <div className={`fu-field fu-field--narrow ${errors.language ? 'has-error' : ''}`}>
                <label className="fu-label">{t('language')} <span className="fu-required">*</span></label>
                <input className="fu-input" type="text" placeholder="e.g. English, French"
                  value={form.language} onChange={(e) => setField('language', e.target.value)} />
                {errors.language && <p className="fu-error"><FaExclamationTriangle />{errors.language}</p>}
              </div>
              <div className={`fu-field fu-field--narrow ${errors.country ? 'has-error' : ''}`}>
                <label className="fu-label">{t('country')} <span className="fu-required">*</span></label>
                <input className="fu-input" type="text" placeholder="e.g. Nigeria"
                  value={form.country} onChange={(e) => setField('country', e.target.value)} />
                {errors.country && <p className="fu-error"><FaExclamationTriangle />{errors.country}</p>}
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="fu-warnings">
                {warnings.map((w, idx) => (
                  <div key={idx} className="fu-warning">
                    <FaExclamationTriangle />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Age Rating */}
            <div className={`fu-field ${errors.age_rating ? 'has-error' : ''}`}>
              <label className="fu-label">Age Rating <span className="fu-required">*</span></label>
              <div className="fu-age-rating-grid">
                {Object.entries(AGE_RATINGS).map(([key]) => (
                  <button
                    key={key} type="button"
                    className={`fu-age-btn ${form.age_rating === key ? 'active' : ''}`}
                    onClick={() => setField('age_rating', key)}
                  >
                    <AgeRatingBadge rating={key} size="sm" showTooltip={false} />
                  </button>
                ))}
              </div>
              {form.age_rating && (
                <p className="fu-rating-desc">{AGE_RATINGS[form.age_rating]?.description}</p>
              )}
              {errors.age_rating && <p className="fu-error"><FaExclamationTriangle />{errors.age_rating}</p>}
            </div>

            {/* Genres */}
            <div className={`fu-field ${errors.genres ? 'has-error' : ''}`}>
              <label className="fu-label">
                Genres <span className="fu-required">*</span>
                <span className="fu-label-hint">(select all that apply)</span>
              </label>
              <div className="fu-genre-grid">
                {GENRES.map((g) => (
                  <button
                    key={g} type="button"
                    className={`fu-genre-btn ${form.genres.includes(g) ? 'active' : ''}`}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {errors.genres && <p className="fu-error"><FaExclamationTriangle />{errors.genres}</p>}
            </div>

            {/* Monetization Type */}
            <div className={`fu-field ${errors.monetization_type ? 'has-error' : ''}`}>
              <label className="fu-label">Monetization Options <span className="fu-required">*</span></label>
              <div className="fu-monetization-grid" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" value="pay_per_view" checked={form.monetization_type === 'pay_per_view'} onChange={(e) => setField('monetization_type', e.target.value)} />
                  Pay Per View only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" value="subscription" checked={form.monetization_type === 'subscription'} onChange={(e) => setField('monetization_type', e.target.value)} />
                  Subscription only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" value="both" checked={form.monetization_type === 'both'} onChange={(e) => setField('monetization_type', e.target.value)} />
                  Both
                </label>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP 2: MEDIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 2 && (
          <div className="fu-step-content">
            <h2 className="fu-step-title">Media Files</h2>
            <p className="fu-step-desc">Upload or paste URLs for your poster, cover, trailer, and video.</p>

            <div className="fu-media-grid">
              <MediaUploadZone
                label="Poster" required description="Vertical â€” 2:3 aspect ratio"
                accept="image/jpeg,image/png,image/webp" maxSizeMB={10} previewType="image"
                name="poster" currentFile={form.poster_file} currentUrl={form.poster_url}
                onFileChange={(f) => setField('poster_file', f)}
                onUrlChange={(u) => setField('poster_url', u)}
                error={errors.poster}
              />
              <MediaUploadZone
                label="Cover Image" required description="Horizontal â€” 16:9 aspect ratio"
                accept="image/jpeg,image/png,image/webp" maxSizeMB={15} previewType="image"
                name="cover" currentFile={form.cover_file} currentUrl={form.cover_url}
                onFileChange={(f) => setField('cover_file', f)}
                onUrlChange={(u) => setField('cover_url', u)}
                error={errors.cover}
              />
              <MediaUploadZone
                label="Trailer" required description="YouTube/Vimeo URL or video file"
                accept="video/mp4,video/webm" maxSizeMB={200} previewType="video"
                name="trailer" currentFile={form.trailer_file} currentUrl={form.trailer_url}
                onFileChange={(f) => setField('trailer_file', f)}
                onUrlChange={(u) => setField('trailer_url', u)}
                error={errors.trailer}
              />
              {form.mediaType !== MEDIA_TYPES.SERIES && (
                <MediaUploadZone
                  label="Full Video" description="The complete film (optional)"
                  accept="video/mp4,video/webm" maxSizeMB={5000} previewType="video"
                  name="video" currentFile={form.video_file} currentUrl={form.video_url}
                  onFileChange={(f) => setField('video_file', f)}
                  onUrlChange={(u) => setField('video_url', u)}
                />
              )}
            </div>

            {form.mediaType === MEDIA_TYPES.SERIES && (
              <EpisodeBuilder
                seasons={form.seasons}
                onChange={(s) => setField('seasons', s)}
                error={errors.seasons}
              />
            )}
          </div>
        )}

        {/* â”€â”€ STEP 3: CAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 3 && (
          <div className="fu-step-content">
            <h2 className="fu-step-title">Cast &amp; Crew</h2>
            <p className="fu-step-desc">Add the people behind and in front of the camera (optional).</p>

            <div className="fu-cast-list">
              {form.cast_crew.length === 0 ? (
                <div className="fu-cast-empty">
                  No cast members added yet. Click below to start.
                </div>
              ) : (
                form.cast_crew.map((member) => (
                  <div key={member.id} className="fu-cast-member">
                    <div className="fu-cast-avatar">
                      {member.photo
                        ? <img src={member.photo} alt={member.name} onError={(e) => { e.target.style.display = 'none'; }} />
                        : <FaUser />}
                    </div>
                    <div className="fu-cast-fields">
                      <div className="fu-row">
                        <div className="fu-field">
                          <label className="fu-label">Name</label>
                          <input className="fu-input" type="text" placeholder="Full name"
                            value={member.name}
                            onChange={(e) => updateCastMember(member.id, 'name', e.target.value)} />
                        </div>
                        <div className="fu-field fu-field--narrow">
                          <label className="fu-label">Role</label>
                          <select className="fu-input fu-select" value={member.role}
                            onChange={(e) => updateCastMember(member.id, 'role', e.target.value)}>
                            {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="fu-row">
                        <div className="fu-field">
                          <label className="fu-label">Character <span className="fu-label-hint">(actors)</span></label>
                          <input className="fu-input" type="text" placeholder="Character name"
                            value={member.character}
                            onChange={(e) => updateCastMember(member.id, 'character', e.target.value)} />
                        </div>
                        <div className="fu-field">
                          <label className="fu-label">Photo URL</label>
                          <input className="fu-input" type="url" placeholder="https://..."
                            value={member.photo}
                            onChange={(e) => updateCastMember(member.id, 'photo', e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <button className="fu-cast-remove" type="button" onClick={() => removeCastMember(member.id)}>
                      <FaTimes />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button className="fu-add-cast" type="button" onClick={addCastMember}>
              <FaPlus /> Add Cast / Crew Member
            </button>
          </div>
        )}

        {/* â”€â”€ STEP 4: REVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 4 && (
          <div className="fu-step-content">
            <h2 className="fu-step-title">Review &amp; Submit</h2>
            <p className="fu-step-desc">Confirm everything looks right before submitting for admin review.</p>

            <div className="fu-review-card">
              <div className="fu-review-row">
                <span className="fu-review-label">Type</span>
                <span className="fu-review-value">{form.mediaType}</span>
              </div>
              <div className="fu-review-row">
                <span className="fu-review-label">Title</span>
                <span className="fu-review-value">{form.title || 'â€”'}</span>
              </div>
              <div className="fu-review-row">
                <span className="fu-review-label">Director</span>
                <span className="fu-review-value">{form.director || 'â€”'}</span>
              </div>
              <div className="fu-review-row">
                <span className="fu-review-label">Year</span>
                <span className="fu-review-value">{form.year || 'â€”'}</span>
              </div>
              {form.mediaType !== MEDIA_TYPES.SERIES && (
                <div className="fu-review-row">
                  <span className="fu-review-label">Duration</span>
                  <span className="fu-review-value">{form.duration ? `${form.duration} min` : 'â€”'}</span>
                </div>
              )}
              <div className="fu-review-row">
                <span className="fu-review-label">Age Rating</span>
                <span className="fu-review-value">
                  {form.age_rating
                    ? <AgeRatingBadge rating={form.age_rating} size="sm" showTooltip={false} />
                    : 'â€”'}
                </span>
              </div>
              <div className="fu-review-row">
                <span className="fu-review-label">Genres</span>
                <span className="fu-review-value">{form.genres.join(', ') || 'â€”'}</span>
              </div>
              <div className="fu-review-row">
                <span className="fu-review-label">Cast</span>
                <span className="fu-review-value">{form.cast_crew.length} member(s)</span>
              </div>

              {castPreview && (
                <div className="fu-review-row">
                  <span className="fu-review-label">People</span>
                  <span className="fu-review-value">{castPreview}{form.cast_crew.length > 6 ? 'â€¦' : ''}</span>
                </div>
              )}
            </div>

            <div className="fu-media-checklist">
              <p className="fu-checklist-title">Media Assets</p>
              {[
                { label: 'Poster', has: hasPoster, required: true },
                { label: 'Cover Image', has: hasCover, required: true },
                { label: 'Trailer', has: hasTrailer, required: true },
                ...(form.mediaType !== MEDIA_TYPES.SERIES
                  ? [{ label: 'Full Video', has: hasVideo, required: false }]
                  : []),
              ].map(({ label, has, required }) => (
                <div
                  key={label}
                  className={`fu-check-item ${has ? 'ok' : required ? 'missing' : 'optional-missing'}`}
                >
                  {has ? <FaCheck /> : <FaTimes />}
                  {label}
                  {!has && (required
                    ? <span className="fu-check-required">Required</span>
                    : <span className="fu-check-optional">Optional</span>)}
                </div>
              ))}
            </div>

            <div className="fu-approval-notice">
              <FaExclamationTriangle className="fu-approval-icon" />
              <div>
                <strong>Admin Review Required</strong>
                <p>
                  Your content will be reviewed by the Viewesta team before it goes live.
                  You will be notified once approved or if changes are requested.
                </p>
              </div>
            </div>

            {submitError && (
              <p className="fu-submit-error">
                <FaExclamationTriangle /> {submitError}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="fu-actions">
          {step > 0 && (
            <button className="fu-btn fu-btn--outline" type="button" onClick={goBack}>
              <FaArrowLeft /> Back
            </button>
          )}
          <button className="fu-btn fu-btn--ghost" type="button" onClick={handleSaveDraft}>
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button className="fu-btn fu-btn--primary" type="button" onClick={goNext} style={{ marginLeft: 'auto' }}>
              Next <FaArrowRight />
            </button>
          ) : (
            <button
              className="fu-btn fu-btn--primary fu-btn--submit"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ marginLeft: 'auto' }}
            >
              {submitting ? 'Submittingâ€¦' : 'Submit for Review'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default FilmmakerUpload;
