// src/components/GeneratePage.tsx
import React, { useState, useEffect } from 'react';
import {
  getAllCoverLetters,
  getCoverLetterContent,
  getAllResumes,
  getResumeContent
} from '../utils/indexedDB';
import './GeneratePage.css'; // Create this file for styles

interface DocumentInfo {
  id: number;
  name: string;
}

const GeneratePage: React.FC = () => {
  const [coverLetters, setCoverLetters] = useState<DocumentInfo[]>([]);
  const [resumes, setResumes] = useState<DocumentInfo[]>([]);
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [promptOutput, setPromptOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const loadDocuments = async () => {
    try {
      const [clData, resumeData] = await Promise.all([
        getAllCoverLetters(),
        getAllResumes()
      ]);
      setCoverLetters(clData.map(d => ({ id: d.id, name: d.name })));
      setResumes(resumeData.map(d => ({ id: d.id, name: d.name })));
    } catch (err) {
      console.error("Error loading documents:", err);
      setError("Failed to load documents.");
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleGenerate = async () => {
    if (!selectedCoverLetterId || !selectedResumeId) {
      setError("Please select both a cover letter and a resume.");
      return;
    }
    setIsLoading(true);
    setError('');
    setPromptOutput('');

    try {
      const clId = parseInt(selectedCoverLetterId, 10);
      const resumeId = parseInt(selectedResumeId, 10);

      const [coverLetterContent, resumeContent] = await Promise.all([
        getCoverLetterContent(clId),
        getResumeContent(resumeId)
      ]);

      if (coverLetterContent === null || resumeContent === null) {
        setError("Could not retrieve content for selected documents.");
        setIsLoading(false);
        return;
      }

      // --- Start Prompt Formatting ---
      const generatedPrompt = `
        Cover Letter:
        ${coverLetterContent}

        Resume:
        ${resumeContent}

        TODO: Add more instructions here.
      `;
      // --- End Prompt Formatting ---
      setPromptOutput(generatedPrompt.trim());

    } catch (err) {
      console.error("Error generating prompt:", err);
      setError("Failed to generate prompt.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="generate-page">
      <h2>Generate Prompt</h2>

      {/* Selections */}
      <div className="selections">
        <div className="select-group">
          <label htmlFor="cover-letter-select">Select Cover Letter:</label>
          <select 
            id="cover-letter-select"
            value={selectedCoverLetterId}
            onChange={(e) => setSelectedCoverLetterId(e.target.value)}
            disabled={isLoading}
          >
            <option value="">-- Select --</option>
            {coverLetters.map(cl => (
              <option key={cl.id} value={cl.id}>{cl.name}</option>
            ))}
          </select>
        </div>

        <div className="select-group">
          <label htmlFor="resume-select">Select Resume:</label>
          <select 
            id="resume-select"
            value={selectedResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
            disabled={isLoading}
          >
            <option value="">-- Select --</option>
            {resumes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Generate Button */}
      <button 
        className="generate-button" 
        onClick={handleGenerate}
        disabled={isLoading || !selectedCoverLetterId || !selectedResumeId}
      >
        {isLoading ? 'Generating...' : 'Generate Prompt'}
      </button>

      {/* Error Message */}
      {error && <p className="error-message">{error}</p>}

      {/* Output Area */}
      {promptOutput && (
        <div className="prompt-output">
          <h3>Generated Prompt:</h3>
          <pre>{promptOutput}</pre>
        </div>
      )}
    </div>
  );
};

export default GeneratePage;