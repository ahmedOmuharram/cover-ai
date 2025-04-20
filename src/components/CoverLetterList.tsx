import React, { useRef, ChangeEvent } from 'react';
import './CoverLetterList.css';

interface CoverLetter {
  id: number;
  name: string;
}

interface CoverLetterListProps {
  letters: CoverLetter[];
  onFileUpload: (file: File) => void;
}

const CoverLetterList: React.FC<CoverLetterListProps> = ({ letters, onFileUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    if (event.target) event.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="cover-letter-list">
      <div className="list-header">
        <h2>Uploaded Cover Letters</h2>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        accept=".pdf,.doc,.docx,.txt"
      />
      
      {letters.length === 0 ? (
        <p className="no-letters-message">No cover letters uploaded yet.</p>
      ) : (
        <ul>
          {letters.map((letter) => (
            <li key={letter.id}>{letter.name}</li>
          ))}
        </ul>
      )}
      
      <div className="list-footer">
        <button onClick={handleUploadClick} className="upload-new-button">
          + Upload New
        </button>
      </div>
    </div>
  );
};

export default CoverLetterList; 