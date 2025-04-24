import React, { useRef, ChangeEvent, useState } from 'react';

interface Document {
  id: number;
  name: string;
}

interface DocumentListProps {
  resumes: Document[];
  letters: Document[];
  onFileUpload: (file: File, type: 'resume' | 'letter') => void;
  onDelete: (id: number, type: 'resume' | 'letter') => Promise<void>;
  onRename: (id: number, newName: string, type: 'resume' | 'letter') => Promise<void>;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  resumes, 
  letters, 
  onFileUpload,
  onDelete,
  onRename 
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'resume' | 'letter' | null>(null);
  const [newName, setNewName] = useState('');
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

  const handleRenameClick = (id: number, currentName: string, type: 'resume' | 'letter') => {
    setEditingId(id);
    setEditingType(type);
    setNewName(currentName);
  };

  const handleRenameSubmit = async (id: number, type: 'resume' | 'letter') => {
    try {
      await onRename(id, newName, type);
      setEditingId(null);
      setEditingType(null);
    } catch (error) {
      console.error('Error renaming document:', error);
    }
  };

  const renderDocument = (doc: Document, type: 'resume' | 'letter') => {
    const isEditing = editingId === doc.id && editingType === type;
    
    return (
      <li key={doc.id} className="document-item">
        {isEditing ? (
          <div className="edit-mode">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <button 
              onClick={() => handleRenameSubmit(doc.id, type)}
              className="action-button save"
            >
              ✓
            </button>
            <button 
              onClick={() => setEditingId(null)}
              className="action-button cancel"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <span className="document-name">{doc.name}</span>
            <div className="document-actions">
              <button 
                onClick={() => handleRenameClick(doc.id, doc.name, type)}
                className="action-button rename"
                title="Rename"
              >
                ✎
              </button>
              <button 
                onClick={() => onDelete(doc.id, type)}
                className="action-button delete"
                title="Delete"
              >
                ×
              </button>
            </div>
          </>
        )}
      </li>
    );
  };

  return (
    <div className="document-list">
      
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
            {letters.map(letter => renderDocument(letter, 'letter'))}
          </ul>
        )}
        
        <div className="list-footer">
          <button onClick={() => handleUploadClick(coverLetterInputRef)} className="upload-new-button">
            + Upload New Cover Letter
          </button>
        </div>
      </div>
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
            {resumes.map(resume => renderDocument(resume, 'resume'))}
          </ul>
        )}
        
        <div className="list-footer">
          <button onClick={() => handleUploadClick(resumeInputRef)} className="upload-new-button">
            + Upload New Resume
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentList;