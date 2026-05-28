import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaCog, FaPlay, FaPause, FaVolumeUp, FaVolumeMute,
  FaExpand, FaCompress, FaClosedCaptioning
} from 'react-icons/fa';
import { MdReplay10, MdForward10, MdPictureInPicture } from 'react-icons/md';
import './VideoPlayer.css';

import Hls from 'hls.js';

function isHlsUrl(url = '') {
  return url.includes('.m3u8') || url.includes('hls') || url.includes('application/x-mpegURL');
}

function isDashUrl(url = '') {
  return url.includes('.mpd') || url.includes('dash');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/**
 * Professional production-ready VideoPlayer.
 *
 * Props:
 *   src           {string}   – single video URL (mp4/m3u8/mpd)
 *   sources       {object}   – { quality: url } map (e.g. { '1080p': '...' })
 *   initialQuality{string}   – default quality key
 *   title         {string}   – shown in top bar
 *   poster        {string}   – poster image URL
 *   onEnded       {function} – called when video finishes (for autoplay chaining)
 *   onProgress    {function} – called with { currentTime, duration, percent }
 *   // DRM/Widevine-ready architecture:
 *   drmConfig     {object}   – { servers: { 'com.widevine.alpha': '...' }, ... }
 */
const VideoPlayer = ({
  src,
  sources = {},
  initialQuality = '1080p',
  title = '',
  poster = '',
  onEnded,
  onProgress,
  drmConfig = null,
  onRequestRefresh,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const progressSaveRef = useRef(null);

  const [quality, setQuality] = useState(initialQuality);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef(null);

  // ─── Resolve active source URL ────────────────────────────────────────────
  const availableQualities = Object.keys(sources).length > 0 ? Object.keys(sources) : (src ? ['default'] : []);
  const activeSrc = (() => {
    if (Object.keys(sources).length > 0) {
      return sources[quality] || sources[initialQuality] || Object.values(sources)[0] || src || '';
    }
    return src || '';
  })();

  // ─── HLS / native source setup ────────────────────────────────────────────
  const attachSource = useCallback((url) => {
    const video = videoRef.current;
    if (!video || !url) return;

    setError('');
    setIsLoading(true);

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(url)) {
      if (Hls && Hls.isSupported()) {
        const hls = new Hls({
          // DRM-ready: maxBufferLength, xhrSetup can be extended for token auth
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('[VideoPlayer] HLS fatal error:', data.type, data.details);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              const status = data.response?.code || data.response?.status;
              if (
                status === 401 ||
                status === 403 ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR
              ) {
                console.warn('[VideoPlayer] Signed URL may be expired. Requesting refresh...', { status, details: data.details });
                if (onRequestRefresh) {
                  onRequestRefresh();
                  return; // Stop here, wait for parent to pass new sources
                }
              }
              // Attempt standard network recovery for other issues
              console.warn('[VideoPlayer] Network error, attempting to start load again...');
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              console.warn('[VideoPlayer] Media error, attempting recovery...');
              hls.recoverMediaError();
            } else {
              setError('Stream error. Please try again.');
              setIsLoading(false);
            }
          }
        });
        hlsRef.current = hls;
        return;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url;
        return;
      }
      setError('HLS streaming is not supported in this browser.');
      return;
    }

    if (isDashUrl(url)) {
      // DASH/Widevine hook — requires shaka-player or dash.js (future integration)
      // For now, attempt native playback and note DRM config presence
      if (drmConfig) {
        console.info('[VideoPlayer] DRM config present — Widevine/DASH integration ready:', drmConfig);
      }
      video.src = url;
      return;
    }

    // Standard MP4 / WebM
    video.src = url;
  }, [drmConfig]);

  // ─── Attach source when activeSrc changes ─────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const wasPlaying = !video.paused;
    const savedTime = video.currentTime || 0;

    attachSource(activeSrc);

    if (!activeSrc) {
      setIsLoading(false);
      return;
    }

    // Restore position after quality switch
    const onMetadata = () => {
      if (savedTime > 0 && wasPlaying) {
        video.currentTime = savedTime;
        video.play().catch(() => {});
      }
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', onMetadata, { once: true });
    return () => {
      video.removeEventListener('loadedmetadata', onMetadata);
    };
  }, [activeSrc, attachSource]);

  // ─── Video event listeners ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onProgress && video.duration) {
        onProgress({
          currentTime: video.currentTime,
          duration: video.duration,
          percent: (video.currentTime / video.duration) * 100,
        });
      }
    };
    const onLoaded = () => { setDuration(video.duration); setIsLoading(false); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolume = () => { setVolume(video.volume); setIsMuted(video.muted); };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onEnded_ = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };
    const onError_ = () => {
      const code = video.error?.code;
      if (code === 4) setError('Format not supported. The video file may be missing or incompatible.');
      else if (code === 2) setError('Network error. Check your connection and try again.');
      else setError('Unable to play this video. Please try again.');
      setIsLoading(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolume);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEnded_);
    video.addEventListener('error', onError_);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolume);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEnded_);
      video.removeEventListener('error', onError_);
    };
  }, [onEnded, onProgress]);

  // ─── Fullscreen listener ──────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── Auto-hide controls ───────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      clearTimeout(hideControlsTimer.current);
      clearInterval(progressSaveRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  // ─── Controls ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const handleVolumeChange = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    v.muted = val === 0;
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(e.target.value);
  };

  const seekBackward = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - 10);
  };

  const seekForward = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  const toggleCaptions = () => {
    const v = videoRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = v.textTracks[i].mode === 'showing' ? 'hidden' : 'showing';
    }
  };

  // ─── No source state ──────────────────────────────────────────────────────
  if (!activeSrc) {
    return (
      <div className="video-player">
        <div className="video-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, background: '#111', borderRadius: 12 }}>
          <div style={{ textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
            <p style={{ margin: 0 }}>No video source available for this title yet.</p>
            <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>The filmmaker may not have uploaded a video file yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`video-player${isFullscreen ? ' fullscreen' : ''}`}
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div className="video-wrapper">
        {/* Prevent downloading / exposing raw URL via right-click */}
        <video
          ref={videoRef}
          className="video"
          playsInline
          poster={poster}
          onContextMenu={(e) => e.preventDefault()}
          controlsList="nodownload"
          disablePictureInPicture={false}
        />

        {/* Loading spinner */}
        {isLoading && !error && (
          <div className="player-loading-overlay">
            <div className="player-spinner" />
          </div>
        )}

        {/* Top bar */}
        <div className={`player-topbar${showControls ? ' visible' : ''}`}>
          <div className="title">{title}</div>
        </div>

        {/* Controls overlay */}
        <div className={`player-controls-overlay${showControls ? ' visible' : ''}`}>
          {/* Progress */}
          <div className="progress-bar-container">
            <input
              type="range"
              className="progress-bar"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{ '--progress': duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>

          {/* Control bar */}
          <div className="control-bar">
            <div className="control-left">
              <button className="control-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              <div className="volume-control">
                <button className="control-btn" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
                <div className="volume-slider-container">
                  <input
                    type="range"
                    className="volume-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume"
                    style={{ '--volume-progress': `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>
              <span className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>

            <div className="control-right">
              <button className="control-btn seek-btn" onClick={seekBackward} aria-label="Rewind 10s">
                <MdReplay10 className="seek-icon" />
              </button>
              <button className="control-btn seek-btn" onClick={seekForward} aria-label="Forward 10s">
                <MdForward10 className="seek-icon" />
              </button>
              <button className="control-btn" onClick={toggleCaptions} aria-label="Captions">
                <FaClosedCaptioning />
              </button>

              {/* Quality selector */}
              {availableQualities.length > 1 && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="control-btn"
                    aria-label="Settings"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                    <FaCog />
                  </button>
                  {isSettingsOpen && (
                    <div className="settings-panel" onMouseLeave={() => setIsSettingsOpen(false)}>
                      <div className="settings-group">
                        <div className="settings-label">Quality</div>
                        <div className="quality-options">
                          {availableQualities.map((q) => (
                            <button
                              key={q}
                              className={`quality-option${quality === q ? ' active' : ''}`}
                              onClick={() => { setQuality(q); setIsSettingsOpen(false); }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button className="control-btn" onClick={togglePiP} aria-label="Picture-in-Picture">
                <MdPictureInPicture />
              </button>
              <button className="control-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="player-error">
          <span>⚠️ {error}</span>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
