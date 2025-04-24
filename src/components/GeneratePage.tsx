// src/components/GeneratePage.tsx
import React, { useState, useEffect } from 'react';
import { ToneSetting } from '../App'; // Import ToneSetting type from App
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
  const [tone, setTone] = useState<ToneSetting>('professional'); // Add state for tone
  const [jobDescriptionText, setJobDescriptionText] = useState<string>(''); // State for received job description

  // Effect to load initial data (documents, tone, and persisted state)
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load documents
        const [clData, resumeData] = await Promise.all([
          getAllCoverLetters(),
          getAllResumes()
        ]);
        setCoverLetters(clData.map(d => ({ id: d.id, name: d.name })));
        setResumes(resumeData.map(d => ({ id: d.id, name: d.name })));

        // Load saved tone and selections from session storage
        chrome.storage.session.get(['tone', 'selectedCoverLetterId', 'selectedResumeId', 'jobDescriptionText'], (result) => {
          // Load Tone
          if (result.tone) {
            const validTones: ToneSetting[] = ['professional', 'friendly', 'casual'];
            if (validTones.includes(result.tone)) {
              setTone(result.tone as ToneSetting);
              console.log('GeneratePage loaded tone:', result.tone);
            } else {
              setTone('professional'); // Default if invalid
            }
          } else {
            setTone('professional'); // Default if not found
          }

          // Load Selections and Job Description Text
          if (result.selectedCoverLetterId) {
            setSelectedCoverLetterId(result.selectedCoverLetterId);
            console.log('GeneratePage loaded selectedCoverLetterId:', result.selectedCoverLetterId);
          }
          if (result.selectedResumeId) {
            setSelectedResumeId(result.selectedResumeId);
             console.log('GeneratePage loaded selectedResumeId:', result.selectedResumeId);
          }
           if (result.jobDescriptionText) {
            setJobDescriptionText(result.jobDescriptionText);
            console.log('GeneratePage loaded jobDescriptionText:', result.jobDescriptionText);
          }
        });
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Failed to load initial data.");
      }
    };
    loadData();

    // --- Add Message Listener ---
    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        console.log("Message received in GeneratePage:", message); // Log received messages
        if (message.type === 'JOB_DESCRIPTION_TEXT' && message.payload?.text) {
            console.log("Setting job description text:", message.payload.text);
            setJobDescriptionText(message.payload.text);
        }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    console.log("GeneratePage message listener added.");

    // Cleanup listener on component unmount
    return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.log("GeneratePage message listener removed.");
    };
    // --- End Message Listener ---

  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to save selections and job description to session storage on change
  useEffect(() => {
    const dataToSave: { [key: string]: any } = {};
    if (selectedCoverLetterId) dataToSave.selectedCoverLetterId = selectedCoverLetterId;
    if (selectedResumeId) dataToSave.selectedResumeId = selectedResumeId;
    // Save jobDescriptionText even if empty to clear it if needed
    dataToSave.jobDescriptionText = jobDescriptionText;

    if (Object.keys(dataToSave).length > 0) {
        chrome.storage.session.set(dataToSave, () => {
           if (chrome.runtime.lastError) {
               console.error("Error saving session state:", chrome.runtime.lastError);
           }
        });
    }
  }, [selectedCoverLetterId, selectedResumeId, jobDescriptionText]); // Dependencies trigger save

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
        Job Description:
        ${jobDescriptionText || 'N/A'} 

        Tone: ${tone}
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

      {/* Display Received Job Description */}
      {jobDescriptionText && (
        <div className="job-description-display">
          <h3>Job Description Context:</h3>
          <textarea 
            value={jobDescriptionText} 
            onChange={(e) => setJobDescriptionText(e.target.value)}
            rows={5} // Adjust rows as needed
            style={{ width: '100%', marginBottom: '15px' }} // Basic styling
            placeholder="Job description text will appear here or paste it manually"
          /> 
        </div>
      )}

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