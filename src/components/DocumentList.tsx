import React, { useRef, ChangeEvent } from 'react';
import './DocumentList.css';

interface Document {
  id: number;
  name: string;
}

interface DocumentListProps {
  resumes: Document[];
  letters: Document[];
  onFileUpload: (file: File, type: 'resume' | 'letter') => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ resumes, letters, onFileUpload }) => {
  const coverLetterInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'resume' | 'letter') => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file, type);
    }
    if (event.target) event.target.value = '';
  };

  const handleUploadClick = (inputRef: React.RefObject<HTMLInputElement>) => {
    inputRef.current?.click();
  };

  return (
    <div className="document-list">
      {/* Resume Section */}
      <div className="list-section">
        <div className="list-header">
          <h2>Uploaded Resumes</h2>
        </div>

        <input 
          type="file" 
          ref={resumeInputRef} 
          onChange={(e) => handleFileChange(e, 'resume')} 
          style={{ display: 'none' }} 
          accept=".pdf,.doc,.docx,.txt"
        />
        
        {resumes.length === 0 ? (
          <p className="no-letters-message">No resumes uploaded yet.</p>
        ) : (
          <ul>
            {resumes.map((resume) => (
              <li key={resume.id}>{resume.name}</li>
            ))}
          </ul>
        )}
        
        <div className="list-footer">
          <button onClick={() => handleUploadClick(resumeInputRef)} className="upload-new-button">
            + Upload New Resume
          </button>
        </div>
      </div>

      {/* Cover Letter Section */}
      <div className="list-section">
        <div className="list-header">
          <h2>Uploaded Cover Letters</h2>
        </div>

        <input 
          type="file" 
          ref={coverLetterInputRef} 
          onChange={(e) => handleFileChange(e, 'letter')} 
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
          <button onClick={() => handleUploadClick(coverLetterInputRef)} className="upload-new-button">
            + Upload New Cover Letter
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentList;