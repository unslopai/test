import React, { useState, ChangeEvent, FormEvent } from 'react';

interface ImageUploadProps {
  /** The API endpoint where the image should be uploaded */
  uploadUrl: string;
  /** Optional callback fired when the upload is successful */
  onUploadSuccess?: (response: any) => void;
  /** Optional callback fired when the upload fails */
  onUploadError?: (error: string) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  uploadUrl,
  onUploadSuccess,
  onUploadError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle file selection and generate preview
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Optional: Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file.');
        return;
      }

      setSelectedFile(file);

      // Create a local object URL for previewing
      const fileReader = new FileReader();
      fileReader.onload = () => {
        setPreviewUrl(fileReader.result as string);
      };
      fileReader.readAsDataURL(file);
    }
  };

  // Reset state to select a different image
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle the upload process using XMLHttpRequest for progress tracking
  const handleUpload = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded * 100) / event.total);
        setUploadProgress(percentComplete);
      }
    });

    // Handle successful upload
    xhr.addEventListener('load', () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setSuccessMessage('Image uploaded successfully!');
        let responseData;
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch {
          responseData = xhr.responseText;
        }
        if (onUploadSuccess) onUploadSuccess(responseData);
      } else {
        const errorText = `Upload failed with status ${xhr.status}`;
        setErrorMessage(errorText);
        if (onUploadError) onUploadError(errorText);
      }
    });

    // Handle network or request errors
    xhr.addEventListener('error', () => {
      setIsUploading(false);
      const errorText = 'A network error occurred during the upload.';
      setErrorMessage(errorText);
      if (onUploadError) onUploadError(errorText);
    });

    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  };

  return (
    <div style={styles.container}>
      <h2>Upload Image</h2>

      <form onSubmit={handleUpload} style={styles.form}>
        {/* File Input */}
        {!previewUrl && (
          <div style={styles.dropzone}>
            <label htmlFor="file-input" style={styles.fileLabel}>
              Choose an image
            </label>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={styles.hiddenInput}
            />
          </div>
        )}

        {/* Preview Section */}
        {previewUrl && (
          <div style={styles.previewContainer}>
            <img src={previewUrl} alt="Preview" style={styles.previewImage} />
            
            {!isUploading && !successMessage && (
              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.uploadButton}>
                  Upload to Server
                </button>
                <button type="button" onClick={handleReset} style={styles.cancelButton}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <div style={styles.progressContainer}>
            <div style={styles.progressBarWrapper}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${uploadProgress}%`,
                }}
              />
            </div>
            <span style={styles.progressText}>{uploadProgress}%</span>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
        {successMessage && (
          <div>
            <p style={styles.successText}>{successMessage}</p>
            <button type="button" onClick={handleReset} style={styles.uploadButton}>
              Upload Another
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

// Simple inline styles to keep the component self-contained
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '400px',
    margin: '2rem auto',
    padding: '1.5rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
    fontFamily: 'sans-serif',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  dropzone: {
    border: '2px dashed #007bff',
    borderRadius: '6px',
    padding: '2rem',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
  },
  fileLabel: {
    cursor: 'pointer',
    backgroundColor: '#007bff',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  hiddenInput: {
    display: 'none',
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '250px',
    objectFit: 'contain',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
  },
  uploadButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  progressBarWrapper: {
    flexGrow: 1,
    height: '10px',
    backgroundColor: '#e9ecef',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007bff',
    transition: 'width 0.2s ease',
  },
  progressText: {
    fontSize: '0.875rem',
    fontWeight: 'bold',
    minWidth: '35px',
  },
  errorText: {
    color: '#dc3545',
    fontSize: '0.875rem',
    margin: 0,
  },
  successText: {
    color: '#28a745',
    fontSize: '0.875rem',
    fontWeight: 'bold',
  },
};

export default ImageUpload;
