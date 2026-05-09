import axios from 'axios';
import client from '../api/client';

/**
 * Service for handling direct S3 uploads via presigned URLs
 */
class UploadService {
  /**
   * Get a presigned upload URL from the backend
   * @param {File} file - The file to be uploaded
   * @param {string} assetType - e.g., 'poster', 'trailer', 'video', 'backdrop'
   */
  async getPresignedUrl(file, assetType = 'video') {
    try {
      console.log(`[UploadService] Getting presigned URL for ${assetType}`, {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const payload = {
        asset_type: assetType,
        content_type: file.type || 'application/octet-stream',
        file_name: file.name,
        file_size: file.size,
      };

      // The Postman collection (Line 999) explicitly uses POST for getting the presigned URL.
      // PUT is only used for the actual S3 file transfer.
      // Changing back to POST as per collection truth.
      const response = await client.post('/movies/upload-url', payload);
      
      console.log('[UploadService] Presigned URL response:', response.data);

      if (response.data?.success && response.data?.data) {
        // Updated backend structure often wraps the upload details in an 'upload' object
        const uploadData = response.data.data.upload || response.data.data;
        
        return {
          upload_url: uploadData.upload_url || uploadData.uploadUrl || uploadData.url,
          asset_url: uploadData.asset_url || uploadData.assetUrl,
          s3_key: uploadData.s3_key || uploadData.object_key || uploadData.objectKey,
          ...uploadData
        };
      }
      throw new Error('Failed to get presigned URL: Invalid response format');
    } catch (error) {
      console.error('[UploadService] Error fetching presigned URL:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      const details = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : '';
      throw new Error(`Failed to get presigned URL: ${msg} ${details}`);
    }
  }

  /**
   * Upload a file directly to S3 using the presigned URL
   * @param {string} uploadUrl - The presigned URL
   * @param {File} file - The file to upload
   * @param {Function} onProgress - Callback for upload progress (0-100)
   */
  async uploadToS3(uploadUrl, file, onProgress) {
    try {
      console.log(`[UploadService] Uploading to S3: ${file.name}`, { uploadUrl });
      
      // We use raw axios here because our `client` might inject auth headers 
      // or interceptors that S3 will reject due to CORS/Signature mismatches.
      const response = await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      });
      console.log('[UploadService] S3 upload successful');
      return response;
    } catch (error) {
      console.error('[UploadService] Error uploading to S3:', error.response?.status, error.message);
      throw error;
    }
  }

  /**
   * Helper to perform the full upload flow for a single file
   * @param {File} file - The file to upload
   * @param {string} assetType - e.g., 'poster', 'trailer', 'video', 'backdrop'
   * @param {Function} onProgress - Callback for upload progress (0-100)
   * @returns {Object} { file_url (presigned stripped), s3_key, file_size }
   */
  async uploadFileFlow(file, assetType, onProgress) {
    if (!file) return null;
    
    // 1. Get presigned URL (using PUT as per user instruction)
    const uploadData = await this.getPresignedUrl(file, assetType);
    
    // As per user instruction: Use upload.upload_url for the S3 transfer
    const { upload_url, s3_key, asset_url } = uploadData;
    
    if (!upload_url) {
      throw new Error(`No upload_url returned for ${assetType}`);
    }

    // 2. Upload to S3
    await this.uploadToS3(upload_url, file, onProgress);
    
    // 3. As per user instruction: asset_url is for saving/displaying after success
    return {
      file_url: asset_url || upload_url.split('?')[0],
      s3_key,
      file_size: file.size,
    };
  }
}

export const uploadService = new UploadService();
export default uploadService;
