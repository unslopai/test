import React, { useState } from 'react';

const ImageUpload: React.FC = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setImagePreview(URL.createObjectURL(file));

      // Reset the uploaded image preview
      setUploadedImage(null);
    }
  };

  const handleUpload = async () => {
    if (!imagePreview) return;

    const formData = new FormData();
    formData.append('file', imagePreview.split(',')[1]);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadedImage(imagePreview);
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('An error occurred during the upload');
    }
  };

  return (
    <div>
      <h1>Image Upload</h1>

      <input type="file" accept="image/*" onChange={handleImageChange} />

      {imagePreview && (
        <>
          <br />
          <img src={imagePreview} alt="Selected Image" style={{ maxWidth: '100%', height: 'auto' }} />
        </>
      )}

      {uploadedImage ? (
        <p>Image uploaded successfully!</p>
      ) : (
        imagePreview && (
          <button onClick={handleUpload}>Upload Image</button>
        )
      )}
    </div>
  );
};

export default ImageUpload;
