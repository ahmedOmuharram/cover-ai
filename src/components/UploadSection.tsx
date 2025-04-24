import React, { ChangeEvent } from 'react';

interface UploadSectionProps {
  onFileUpload: (file: File) => void;
  title?: string; // Make title optional
}

const UploadSection: React.FC<UploadSectionProps> = ({ 
  onFileUpload, 
  title = "Upload a Cover Letter to Start" // Default title
}) => {

  const inputId = "file-upload-input"; // Unique ID for the input

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    // Optional: Reset input value to allow uploading the same file again
    event.target.value = ''
  };

  return (
    <div className="upload-section">
      <h2>{title}</h2>
      {/* Label now acts as the dropzone/clickable area */}
      <label htmlFor={inputId} className="file-upload-box">
        {/* Icon Placeholder - Correct path */}
        <img src="/images/icons/upload.png" alt="Upload Icon" className="upload-icon-placeholder" /> 
        <span className="upload-text">Click to choose file</span>
      </label>
      <input 
        id={inputId} // Add id to the input
        type="file" 
        onChange={handleFileChange} 
        accept=".pdf,.doc,.docx,.txt" // Optional: specify accepted file types
      />
    </div>
  );
};

export default UploadSection; 