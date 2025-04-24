import React, { useState, useEffect } from 'react';
import { ToneSetting } from '../App';
import {
  getAllCoverLetters,
  getCoverLetterContent,
  getAllResumes,
  getResumeContent
} from '../utils/indexedDB';
import OpenAI from 'openai';
import { jsPDF } from 'jspdf';
import './AutomaticPage.css';

interface DocumentInfo {
  id: number;
  name: string;
}

interface AutomaticPageProps {
  autoDownload: boolean;
}

const AutomaticPage: React.FC<AutomaticPageProps> = ({ autoDownload }) => {
  const [coverLetters, setCoverLetters] = useState<DocumentInfo[]>([]);
  const [resumes, setResumes] = useState<DocumentInfo[]>([]);
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [promptOutput, setPromptOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [tone, setTone] = useState<ToneSetting>('professional');
  const [jobDescriptionText, setJobDescriptionText] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyError, setApiKeyError] = useState<string>('');

  const validateApiKey = (key: string): boolean => {
    return /^sk-/.test(key);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value && !validateApiKey(value)) {
      setApiKeyError("Please enter a valid OpenAI API key");
    } else {
      setApiKeyError('');
    }
  };

  const handleSaveApiKey = () => {
    if (validateApiKey(apiKey)) {
      chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving API key:', chrome.runtime.lastError);
          setApiKeyError('Failed to save API key');
        } else {
          setApiKeyError('');
        }
      });
    } else {
      setApiKeyError("Please enter a valid OpenAI API key");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clData, resumeData] = await Promise.all([
          getAllCoverLetters(),
          getAllResumes()
        ]);
        setCoverLetters(clData.map(d => ({ id: d.id, name: d.name })));
        setResumes(resumeData.map(d => ({ id: d.id, name: d.name })));

        // Load saved API key
        chrome.storage.local.get(['openaiApiKey'], (result) => {
          if (result.openaiApiKey) {
            setApiKey(result.openaiApiKey);
            if (!validateApiKey(result.openaiApiKey)) {
              setApiKeyError("Saved API key is invalid");
            }
          }
        });

        chrome.storage.session.get(['tone', 'selectedCoverLetterId', 'selectedResumeId', 'jobDescriptionText'], (result) => {
          if (result.tone) {
            const validTones: ToneSetting[] = ['professional', 'friendly', 'casual'];
            if (validTones.includes(result.tone)) {
              setTone(result.tone as ToneSetting);
            }
          }

          if (result.selectedCoverLetterId) {
            setSelectedCoverLetterId(result.selectedCoverLetterId);
          }
          if (result.selectedResumeId) {
            setSelectedResumeId(result.selectedResumeId);
          }
          if (result.jobDescriptionText) {
            setJobDescriptionText(result.jobDescriptionText);
          }
        });
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Failed to load initial data.");
      }
    };
    loadData();

    const messageListener = (message: any) => {
      if (message.type === 'JOB_DESCRIPTION_TEXT' && message.payload?.text) {
        if (message.payload.source === 'highlight' || !jobDescriptionText) {
          setJobDescriptionText(message.payload.text);
          chrome.storage.session.set({ jobDescriptionText: message.payload.text });
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const generatePDF = (text: string) => {
    const doc = new jsPDF();
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    
    const lines = text.split('\n');
    let y = 20;
    const lineHeight = 6;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    lines.forEach(line => {
      const splitLines = doc.splitTextToSize(line.trim(), pageWidth - (margin * 2));
      splitLines.forEach((splitLine: string) => {
        doc.text(splitLine, margin, y);
        y += lineHeight;
      });
    });

    return doc;
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setApiKeyError("Please enter your OpenAI API key");
      return;
    }
    if (!validateApiKey(apiKey)) {
      setApiKeyError("Please enter a valid OpenAI API key");
      return;
    }
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
        return;
      }

      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      const systemPrompt = `You are an expert cover letter writer. You have access to the following information:
      - The original cover letter: ${coverLetterContent}
      - The user's resume: ${resumeContent}
      - The job description: ${jobDescriptionText || 'N/A'}
      - The desired tone: ${tone}

      Your task is to generate a concise, professional cover letter that:
      1. Matches the job requirements
      2. Highlights relevant experience from the resume
      3. Maintains the style of the original cover letter
      4. Uses the specified tone (${tone})
      5. Is exactly 270 words or less
      
      Make sure to:
      - Keep the same general structure as the original cover letter
      - Use specific examples from the resume
      - Address key requirements from the job description
      - Maintain professional formatting
      - Be concise and impactful
      - Include all essential sections: header, date, salutation, body paragraphs, and closing
      - Focus on quality over quantity
      - Count words carefully to ensure the total is 270 or less`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Please generate a tailored cover letter based on the provided information." }
        ],
        temperature: 0.7
      }).catch((error) => {
        if (error.response?.status === 401) {
          throw new Error("Invalid API key. Please check your API key and try again.");
        }
        throw error;
      });

      const generatedCoverLetter = completion.choices[0]?.message?.content || '';
      setPromptOutput(generatedCoverLetter);
      
      if (autoDownload) {
        const doc = generatePDF(generatedCoverLetter);
        doc.save('cover_letter.pdf');
      }
      
    } catch (err: any) {
      console.error("Error generating cover letter:", err);
      if (err.message === "Invalid API key. Please check your API key and try again.") {
        setApiKeyError(err.message);
      } else {
        setError("Failed to generate cover letter. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="automatic-page">
      <h2>Automatic Generation</h2>

      <div className="api-key-section">
        <h3>OpenAI API Key</h3>
        <div className="api-key-input" style={{ 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <div style={{ flex: 1 , alignItems: 'center', justifyContent: 'center'}}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Enter your OpenAI API key"
              spellCheck="false"
              autoComplete="off"
              style={{ 
                flex: 1,
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                height: '32px',
                lineHeight: '20px',
                marginRight: '10px'
              }}
            />
            <button 
              onClick={handleSaveApiKey}
              className="generate-button"
              style={{ 
                padding: '6px 12px',
                height: '32px',
                whiteSpace: 'nowrap',
                lineHeight: '20px'
              }}
              disabled={!validateApiKey(apiKey)}
            >
              Save Key
            </button>
          </div>
        </div>
        {apiKeyError && <p className="error-message">{apiKeyError}</p>}
        {(!apiKey || apiKeyError) && (
          <div className="api-key-info">
            <p>ℹ️ Your API key is required for automatic generation</p>
          </div>
        )}
      </div>

      <div className="job-description-display">
        <h3>Job Description</h3>
        <textarea 
          value={jobDescriptionText} 
          onChange={(e) => setJobDescriptionText(e.target.value)}
          rows={5} 
          style={{ width: '100%', marginBottom: '15px' }} 
          placeholder="Job description will appear here. You can paste or type a job description, or it will be automatically extracted from LinkedIn job pages."
        /> 
      </div>

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

      <button 
        className="generate-button" 
        onClick={handleGenerate}
        disabled={isLoading || !selectedCoverLetterId || !selectedResumeId}
      >
        {isLoading ? 'Generating...' : 'Generate Automatic Cover Letter'}
      </button>

      {error && <p className="error-message">{error}</p>}

      {promptOutput && (
        <div className="download-section">
          <h3>Cover Letter Generated!</h3>
          <button 
            onClick={() => {
              const doc = generatePDF(promptOutput);
              doc.save('cover_letter.pdf');
            }}
            className="generate-button"
            style={{ marginBottom: '20px' }}
          >
            Download PDF
          </button>

          <div className="prompt-output" style={{ position: 'relative' }}>
            <h3>Generated Cover Letter</h3>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(promptOutput)
                  .then(() => {
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
                  })
                  .catch(err => console.error('Failed to copy text:', err));
              }}
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
        </div>
      )}
    </div>
  );
};

export default AutomaticPage;