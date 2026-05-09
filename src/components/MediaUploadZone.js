import React, { useState, useRef, useCallback } from 'react';
import { FaCloudUploadAlt, FaCheckCircle, FaTimesCircle, FaFilm, FaImage, FaLink } from 'react-icons/fa';
import { formatFileSize } from '../utils/uploadValidation';
import './MediaUploadZone.css';

/**
 * MediaUploadZone — dual-mode upload zone supporting:
 *   - Drag-and-drop file upload
 *   - URL input fallback
 *
 * @param {{
 *   label: string,
 *   description: string,
 *   accept: string,
 *   maxSizeMB: number,
 *   onFileChange: (file: File|null) => void,
 *   onUrlChange: (url: string) => void,
 *   currentFile: File|null,
 *   currentUrl: string,
 *   error: string,
 *   icon?: React.Node,
 *   previewType?: 'image'|'video',
 *   required?: boolean,
 * }} props
 */
const MediaUploadZone = ({
  label,
  description,
  accept,
  maxSizeMB,
  onFileChange,
  onUrlChange,
  currentFile,
  currentUrl,
  error,
  icon,
  previewType = 'image',
  required = false,
  name,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [mode, setMode] = useState('file'); // 'file' | 'url'
  const [urlInput, setUrlInput] = useState(currentUrl || '');
  const [localError, setLocalError] = useState('');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const hasContent = currentFile || (currentUrl && currentUrl.trim());

  const validateAndSetFile = useCallback(
    (file) => {
      setLocalError('');
      if (!file) return;

      // Type check
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      if (acceptedTypes.length > 0 && !acceptedTypes.some((t) => file.type.startsWith(t.replace('/*', '')))) {
        setLocalError(`Invalid file type. Accepted: ${accept}`);
        return;
      }

      // Size check
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setLocalError(`File is too large (${formatFileSize(file.size)}). Max: ${maxSizeMB} MB`);
        return;
      }

      // Generate preview
      if (previewType === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setPreview(URL.createObjectURL(file));
      }

      onFileChange(file);
      onUrlChange('');
      setUrlInput('');
    },
    [accept, maxSizeMB, onFileChange, onUrlChange, previewType]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setLocalError('Please enter a URL.');
      return;
    }
    try {
      new URL(urlInput.trim());
      onUrlChange(urlInput.trim());
      onFileChange(null);
      setPreview(null);
      setLocalError('');
    } catch {
      setLocalError('Please enter a valid URL.');
    }
  };

  const handleClear = () => {
    onFileChange(null);
    onUrlChange('');
    setUrlInput('');
    setPreview(null);
    setLocalError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayError = error || localError;
  const isSuccess = hasContent && !displayError;

  return (
    <div className={`media-upload-zone ${isDragOver ? 'drag-over' : ''} ${isSuccess ? 'has-content' : ''} ${displayError ? 'has-error' : ''}`}>
      {/* Header */}
      <div className="muz-header">
        <div className="muz-label">
          {icon || (previewType === 'image' ? <FaImage /> : <FaFilm />)}
          <span>
            {label}
            {required && <span className="muz-required"> *</span>}
          </span>
          {isSuccess && <FaCheckCircle className="muz-success-icon" />}
        </div>
        <p className="muz-description">{description}</p>
      </div>

      {/* Drop Zone / Preview */}
      <div
        className={`muz-dropzone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        aria-label={`Upload ${label}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="muz-file-input"
          name={name}
        />

        {preview && previewType === 'image' ? (
          <div className="muz-preview-image">
            <img src={preview} alt="Preview" />
          </div>
        ) : preview && previewType === 'video' ? (
          <div className="muz-preview-video">
            <video src={preview} controls muted preload="metadata" />
          </div>
        ) : (
          <div className="muz-dropzone-empty">
            <FaCloudUploadAlt className="muz-upload-icon" />
            <p className="muz-drop-text">
              <strong>Drag &amp; drop</strong> or <strong>click</strong> to browse
            </p>
            <p className="muz-file-info">Max {maxSizeMB} MB</p>
          </div>
        )}

        {currentFile && (
          <div className="muz-file-chip">
            <span className="muz-file-chip__name">{currentFile.name}</span>
            <span className="muz-file-chip__size">{formatFileSize(currentFile.size)}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {displayError && (
        <p className="muz-error" role="alert">
          <FaTimesCircle /> {displayError}
        </p>
      )}

      {/* Clear */}
      {hasContent && (
        <button type="button" className="muz-clear" onClick={handleClear}>
          Clear
        </button>
      )}
    </div>
  );
};

export default MediaUploadZone;
