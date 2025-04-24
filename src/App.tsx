import React, { useState, useEffect } from "react";
import "./App.css";
import Navbar, { ActiveView } from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import DocumentList from "./components/DocumentList";
import GeneratePage from "./components/GeneratePage";
import AutomaticPage from "./components/AutomaticPage";
import {
  addCoverLetter,
  getAllCoverLetters,
  clearDatabase,
  getAllResumes,
  addResume,
  deleteResume,
  deleteCoverLetter,
  renameResume,
  renameCoverLetter,
} from "./utils/indexedDB";

interface Document {
  id: number;
  name: string;
  // Content is not needed in the main App state if only showing names in CoverLetterList
}

export type ToneSetting = 'professional' | 'friendly' | 'casual'; // Define possible tones

function App() {
  const [coverLetters, setCoverLetters] = useState<Document[]>([]);
  const [resumes, setResumes] = useState<Document[]>([]); // Add resumes state
  const [activeView, setActiveView] = useState<ActiveView>("generate"); // Default to 'generate' letters
  const [isLoading, setIsLoading] = useState(true); // Track initial loading
  const [tone, setTone] = useState<ToneSetting>('professional'); // Add state for tone
  const [autoCopy, setAutoCopy] = useState<boolean>(false); // Add state for auto-copy setting
  const [autoDownload, setAutoDownload] = useState<boolean>(false); // Add state for auto-download setting

  // Function to load letters (used in useEffect and after clearing)
  const loadLetters = async () => {
    setIsLoading(true);
    try {
      const [letters, resumes] = await Promise.all([
        getAllCoverLetters(),
        getAllResumes()
      ]);
      setCoverLetters(letters.map(l => ({ id: l.id, name: l.name }))); // Map to simple Document for state
      setResumes(resumes.map(r => ({ id: r.id, name: r.name }))); // Add this line to update resumes state

      // Load saved tone and settings
      chrome.storage.local.get(['tone', 'autoCopy', 'autoDownload'], (result) => {
        if (result.tone) {
           // Validate loaded tone against defined types
           const validTones: ToneSetting[] = ['professional', 'friendly', 'casual'];
           if (validTones.includes(result.tone)) {
              setTone(result.tone as ToneSetting);
              console.log('Loaded tone:', result.tone);
           } else {
              console.warn('Loaded invalid tone from storage:', result.tone, 'Defaulting to professional.');
              setTone('professional'); // Default if invalid
              chrome.storage.local.set({ tone: 'professional' }); // Save default
           }
        } else {
           console.log('No tone found in storage, defaulting to professional.');
           setTone('professional'); // Default if not found
           chrome.storage.local.set({ tone: 'professional' }); // Save default
        }
        
        // Load auto-copy setting
        setAutoCopy(!!result.autoCopy);
        console.log('Loaded auto-copy setting:', !!result.autoCopy);

        // Load auto-download setting
        setAutoDownload(!!result.autoDownload);
        console.log('Loaded auto-download setting:', !!result.autoDownload);
      });
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setCoverLetters([]); // Ensure empty state on error
      setResumes([]); // Also reset resumes on error
    } finally {
      setIsLoading(false);
    }
  };

  // Load letters from IndexedDB on mount
  useEffect(() => {
    loadLetters();
  }, []);

  // This handler now *only* adds Cover Letters
  const handleCoverLetterUpload = async (file: File) => {
    try {
      const newLetterId = await addCoverLetter(file); // Use specific addCoverLetter
      const newLetter: Document = { id: newLetterId, name: file.name };
      setCoverLetters(prevLetters => [...prevLetters, newLetter]);
      setActiveView('view'); // Switch to view letters after successful upload
    } catch (error) {
      console.error('Failed to add cover letter:', error);
    }
  };

  // Add new handler for resumes
  const handleResumeUpload = async (file: File) => {
    try {
      const newResumeId = await addResume(file);
      const newResume: Document = { id: newResumeId, name: file.name };
      setResumes(prevResumes => [...prevResumes, newResume]);
    } catch (error) {
      console.error('Failed to add resume:', error);
    }
  };

  // Combined file upload handler for the DocumentList component
  const handleFileUpload = async (file: File, type: 'resume' | 'letter') => {
    if (type === 'resume') {
      await handleResumeUpload(file);
    } else {
      await handleCoverLetterUpload(file);
    }
  };

  // Handler for clearing the DB (now clears both stores)
  const handleClearDatabase = async () => {
    if (window.confirm('Are you sure you want to clear ALL cover letters and resumes? This cannot be undone.')) {
      try {
        await clearDatabase(); // Clears both stores by default
        setCoverLetters([]);
        setResumes([]); // Uncomment this line
        setActiveView('upload'); // Force back to upload view if needed
      } catch (error) {
        console.error('Failed to clear database:', error);
      }
    }
  };

  const handleDeleteDocument = async (id: number, type: 'resume' | 'letter') => {
    try {
      if (type === 'resume') {
        await deleteResume(id);
        setResumes(prev => prev.filter(r => r.id !== id));
      } else {
        await deleteCoverLetter(id);
        setCoverLetters(prev => prev.filter(l => l.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleRenameDocument = async (id: number, newName: string, type: 'resume' | 'letter') => {
    try {
      if (type === 'resume') {
        await renameResume(id, newName);
        setResumes(prev => prev.map(r => r.id === id ? { ...r, name: newName } : r));
      } else {
        await renameCoverLetter(id, newName);
        setCoverLetters(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
      }
    } catch (error) {
      console.error('Failed to rename document:', error);
    }
  };

  // Handler to change and save tone
  const handleToneChange = (newTone: ToneSetting) => {
    setTone(newTone);
    chrome.storage.local.set({ tone: newTone }, () => {
      console.log('Tone saved:', newTone);
    });
  };

  return (
    <div className="App">
      {/* Loading State */}
      {isLoading && <div className="loading-indicator">Loading...</div>}

      {/* Content Area - Render based on loading and letters state */}
      {!isLoading && (
        <>
          {/* Show initial upload only if no letters AND not trying to access generate page */} 
          {/* TODO: Fix this to 0 when we have a way to check if the DB is empty */}
          {coverLetters.length === 0 && activeView !== 'generate' && activeView !== 'settings' ? ( 
             <UploadSection onFileUpload={handleCoverLetterUpload} title="Upload Cover Letter to Start"/>
          ) : (
            // Render Navbar and content if letters exist OR if viewing Generate/Settings page
            <>
              <Navbar activeView={activeView} onNavClick={setActiveView} />
              
              {/* Wrap conditional content in a div with content-area class */}
              <div className="content-area">
                {/* Conditionally render content based on activeView */} 
                
                {activeView === 'automatic' && <AutomaticPage autoDownload={autoDownload} />}
                
                {activeView === 'view' && (coverLetters.length > 0 || resumes.length > 0) && 
                  <DocumentList 
                    letters={coverLetters}
                    resumes={resumes}
                    onFileUpload={handleFileUpload}
                    onDelete={handleDeleteDocument}
                    onRename={handleRenameDocument}
                  />
                }
                
                {activeView === 'upload' && 
                  // This section now ONLY uploads cover letters
                  <UploadSection 
                    title="Upload Cover Letter" 
                    onFileUpload={(file) => handleFileUpload(file, 'letter')} 
                  />
                }

                {/* Add Generate Page */}
                {activeView === 'generate' && <GeneratePage />} 

                {activeView === 'settings' && 
                  <div className="settings-page" style={{padding: '20px'}}> 
                    <h2>Settings</h2>
                    
                    {/* Tone Selection Setting */}
                    <div className="setting-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '15px'
                    }}>
                      <label htmlFor="tone-select" style={{
                        marginRight: '10px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        Generation Tone:
                      </label>
                      <select 
                        id="tone-select"
                        value={tone} 
                        onChange={(e) => handleToneChange(e.target.value as ToneSetting)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="casual">Casual</option>
                      </select>
                    </div>
                    
                    {/* Auto-copy Setting */}
                    <div className="setting-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '15px'
                    }}>
                      <label htmlFor="auto-copy-checkbox" style={{
                        marginRight: '10px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        Auto-copy:
                      </label>
                      <input
                        id="auto-copy-checkbox"
                        type="checkbox"
                        checked={autoCopy}
                        onChange={(e) => {
                          setAutoCopy(e.target.checked);
                          chrome.storage.local.set({ autoCopy: e.target.checked }, () => {
                            console.log('Auto-copy setting saved:', e.target.checked);
                          });
                        }}
                      />
                    </div>

                    {/* Auto-download Setting */}
                    <div className="setting-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '15px'
                    }}>
                      <label htmlFor="auto-download-checkbox" style={{
                        marginRight: '10px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        Auto-download PDF:
                      </label>
                      <input
                        id="auto-download-checkbox"
                        type="checkbox"
                        checked={autoDownload}
                        onChange={(e) => {
                          setAutoDownload(e.target.checked);
                          chrome.storage.local.set({ autoDownload: e.target.checked }, () => {
                            console.log('Auto-download setting saved:', e.target.checked);
                          });
                        }}
                      />
                    </div>
                    
                    {/* Clear Data Button Setting */}
                    <div className="setting-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '15px'
                     }}>
                      <label style={{
                        marginRight: '10px',
                        fontWeight: 'bold',
                         flexShrink: 0
                      }}>
                        Manage Data:
                      </label>
                      <button 
                        onClick={handleClearDatabase} 
                        style={{
                          padding: '8px 15px',
                          fontSize: '0.9em',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear All Data (Letters & Resumes)
                      </button>
                    </div>

                    {/* Clear API Key Button Setting */}
                    <div className="setting-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '15px'
                     }}>
                      <label style={{
                        marginRight: '10px',
                        fontWeight: 'bold',
                         flexShrink: 0
                      }}>
                        API Key:
                      </label>
                      <button 
                        onClick={() => {
                          chrome.storage.local.remove(['openaiApiKey'], () => {
                            if (chrome.runtime.lastError) {
                              console.error('Error clearing API key:', chrome.runtime.lastError);
                            } else {
                              console.log('API key cleared successfully');
                            }
                          });
                        }}
                        style={{
                          padding: '8px 15px',
                          fontSize: '0.9em',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear API Key
                      </button>
                    </div>

                  </div>
                }
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
