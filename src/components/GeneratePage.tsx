// src/components/GeneratePage.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  const [autoCopy, setAutoCopy] = useState<boolean>(false); // State for auto-copy setting
  const [showToast, setShowToast] = useState<boolean>(false); // State for toast notification
  const [toastMessage, setToastMessage] = useState<string>(''); // State for toast message

  // Toast timeout ref to clear on unmount
  const toastTimeoutRef = useRef<number | null>(null);

  // Function to show toast notification
  const showToastNotification = (message: string = 'Copied to clipboard') => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    
    // Set toast message and show it
    setToastMessage(message);
    setShowToast(true);
    
    // Hide toast after 3 seconds
    toastTimeoutRef.current = window.setTimeout(() => {
      setShowToast(false);
    }, 3000) as unknown as number;
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
        setResumes(resumeData.map(r => ({ id: r.id, name: r.name })));

        // Load saved selections from session storage
        chrome.storage.session.get(['selectedCoverLetterId', 'selectedResumeId', 'jobDescriptionText'], (result) => {
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
        
        // Load tone from local storage
        chrome.storage.local.get(['tone'], (result) => {
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
        });
        
        // Load auto-copy setting from local storage (shared with Settings page)
        chrome.storage.local.get(['autoCopy'], (result) => {
          setAutoCopy(!!result.autoCopy);
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
            console.log("Setting job description text:", message.payload.text.substring(0, 50) + "...");
            
            // If this is from highlighting, it always overwrites (user selection takes priority)
            // If it's from scraping, only overwrite if there isn't already text (preserves user edits)
            if (message.payload.source === 'highlight' || !jobDescriptionText) {
                setJobDescriptionText(message.payload.text);
                
                // Save to session storage
                chrome.storage.session.set({ jobDescriptionText: message.payload.text }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving job description to session:", chrome.runtime.lastError);
                    }
                });
            } else {
                console.log("Not overwriting existing job description with scraped content");
            }
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
      const trimmedPrompt = generatedPrompt.trim();
      setPromptOutput(trimmedPrompt);
      
      // Auto-copy to clipboard if enabled
      if (autoCopy) {
        try {
          await navigator.clipboard.writeText(trimmedPrompt);
          console.log('Prompt automatically copied to clipboard');
          showToastNotification('Automatically copied to clipboard');
        } catch (copyError) {
          console.error('Failed to auto-copy prompt:', copyError);
        }
      }

    } catch (err) {
      console.error("Error generating prompt:", err);
      setError("Failed to generate prompt.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log('Prompt copied to clipboard');
        // Show temporary feedback on button
        const button = document.getElementById('copy-button');
        if (button) {
          const originalText = button.innerHTML;
          button.innerHTML = '✓';
          button.style.backgroundColor = '#4CAF50';
          setTimeout(() => {
            button.innerHTML = originalText;
            button.style.backgroundColor = '';
          }, 1500);
        }
        
        // Show toast notification
        showToastNotification('Copied to clipboard');
      })
      .catch(err => console.error('Failed to copy prompt:', err));
  };

  return (
    <div className="generate-page">
      <h2>Generate Prompt</h2>

      {/* Display Job Description */}
      <div className="job-description-display">
        <h3>Job Description</h3>
        <textarea 
          value={jobDescriptionText} 
          onChange={(e) => setJobDescriptionText(e.target.value)}
          rows={5} 
          style={{ width: '100%', marginBottom: '15px' }} 
          placeholder="Job description will appear here. You can paste or type a job description, or it will be automatically extracted from LinkedIn job pages. You can also highlight text on any page and right click to generate a prompt with the highlighted text as the job description."
        /> 
      </div>

      {/* Selections */}
      <div className="selections">
        <div className="select-group">
          <label htmlFor="cover-letter-select">Select Cover Letter</label>
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
          <label htmlFor="resume-select">Select Resume</label>
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
        style={{ marginBottom: '20px' }}
      >
        {isLoading ? 'Generating...' : 'Generate Prompt'}
      </button>

      {/* Error Message */}
      {error && <p className="error-message">{error}</p>}

      {/* Output Area */}
      {promptOutput && (
        <div className="prompt-output" style={{ position: 'relative' }}>
          <h3>Generated Prompt</h3>
          <button 
            onClick={() => copyToClipboard(promptOutput)} 
            id="copy-button"
            style={{
              position: 'absolute',
              top: '12px',
              right: '10px',
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
          <pre style={{ 
            marginTop: '30px', 
            whiteSpace: 'pre-wrap',
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>{promptOutput}</pre>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div 
          className="toast-notification"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#4CAF50', // Green color
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            animation: 'toastLifecycle 3s ease-out forwards'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Add the animation styles */}
      <style>
        {`
          @keyframes toastLifecycle {
            0% {
              transform: translate(-50%, 100%);
              opacity: 0;
            }
            10% {
              transform: translate(-50%, 0);
              opacity: 1;
            }
            90% {
              transform: translate(-50%, 0);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, 0);
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
};

export default GeneratePage;