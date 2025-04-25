import React, { useState, useEffect } from "react";
import "./App.css";
import Navbar, { ActiveView } from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import DocumentList from "./components/DocumentList";
import GenerationView from "./components/GenerationView";
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
} from "./utils/indexedDB.js";
import { Button } from "./components/ui/button.js";
import { Label } from "./components/ui/label";
import { Checkbox } from "./components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [incomingJobDescription, setIncomingJobDescription] = useState('');


  // Function to load letters (used in useEffect and after clearing)
  const loadLetters = async () => {
    setIsLoading(true);
    try {
      const [letters, resumes] = await Promise.all([
        getAllCoverLetters(),
        getAllResumes()
      ]);
      setCoverLetters(letters.map((l: { id: number; name: string; }) => ({ id: l.id, name: l.name })));
      setResumes(resumes.map((r: { id: number; name: string; }) => ({ id: r.id, name: r.name })));

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

  useEffect(() => {
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'JOB_DESCRIPTION_TEXT') {
        console.log('[App.tsx] Message received from background:', message.payload?.text);
        if (message.payload?.text) {
          setIncomingJobDescription(message.payload.text);
        }
      }
    };
  
    chrome.runtime.onMessage.addListener(handleMessage);
  
    // Clean up the listener when component unmounts
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  
  useEffect(() => {
    const interval = setInterval(() => {
      chrome.storage.local.get(['jobDescription', 'jobDescriptionSource'], (result) => {
        if (result.jobDescription) {
          console.log('[App] Detected job description from storage:', result.jobDescription);
          setIncomingJobDescription(result.jobDescription);
          chrome.storage.local.remove(['jobDescription']); // clear so it doesn’t keep firing
        }
      });
    }, 500); // check every half second
  
    return () => clearInterval(interval); // cleanup on unmount
  }, []);
  
  

  
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
    <div className="App flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground rounded-lg shadow-md">
      {/* Loading State */}
      {isLoading && <div className="loading-indicator flex-grow flex items-center justify-center">Loading...</div>}
      {/*
      {incomingJobDescription && (
        <div className="p-4 bg-white rounded-lg shadow text-black">
          <h2 className="text-xl font-bold mb-2">Job Description Found:</h2>
          <p>{incomingJobDescription}</p>
        </div>
      )}
      */}
      {/* Content Area - Render based on loading and letters state */}
      {!isLoading && (
        <>
          {/* Show initial upload only if no documents AND not trying to access generate/settings page */}
          {/* Check both resumes and letters length */} 
          {(coverLetters.length === 0 && resumes.length === 0) && activeView !== 'generate' && activeView !== 'settings' ? (
             <UploadSection 
               onFileUpload={handleCoverLetterUpload} // Or a combined handler if needed initially?
               title="Upload Document to Start"
               fullscreen={true} // Enable fullscreen mode
             />
          ) : (
            // Render Navbar and content if documents exist OR if viewing Generate/Settings page
            <>
              <Navbar activeView={activeView} onNavClick={setActiveView} />

              {/* Content area with padding and scrolling */}
              <div className="content-area flex-grow overflow-y-auto p-4"> 
                {/* Conditionally render content based on activeView */}

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
                  // This section now ONLY uploads cover letters - Consider adding resume upload here too?
                  <UploadSection
                    title="Upload Cover Letter" 
                    onFileUpload={(file: File) => handleFileUpload(file, 'letter')}
                    // fullscreen is implicitly false here (default)
                  />
                }

                {/* Combined Generation View */}
                {activeView === 'generate' && 
                  <GenerationView 
                    autoDownload={autoDownload} // Pass down autoDownload prop
                    injectedJobDescription={incomingJobDescription}
                  />
                }

                {/* Settings Page - Apply Tailwind classes */}
                {activeView === 'settings' &&
                  <div className="settings-page p-5 space-y-6"> 
                    <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>

                    {/* Tone Selection Setting */}
                    <div className="flex items-center space-x-4">
                      <Label htmlFor="tone-select" className="w-32 text-right flex-shrink-0"> 
                        Generation Tone
                      </Label>
                      <Select 
                        value={tone}
                        onValueChange={(value: ToneSetting) => handleToneChange(value)}
                      >
                        <SelectTrigger id="tone-select" className="w-[180px]">
                          <SelectValue placeholder="Select tone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Auto-copy Setting */}
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id="auto-copy-checkbox" 
                        checked={autoCopy}
                        onCheckedChange={(checked) => {
                          const isChecked = !!checked; // Convert CheckedState to boolean
                          setAutoCopy(isChecked);
                          chrome.storage.local.set({ autoCopy: isChecked }, () => {
                            console.log('Auto-copy setting saved:', isChecked);
                          });
                        }}
                      />
                      <Label htmlFor="auto-copy-checkbox" className="font-normal"> 
                        Automatically copy generated text to clipboard
                      </Label>
                    </div>

                    {/* Auto-download Setting */}
                    <div className="flex items-center space-x-3">
                       <Checkbox 
                        id="auto-download-checkbox" 
                        checked={autoDownload}
                        onCheckedChange={(checked) => {
                          const isChecked = !!checked; // Convert CheckedState to boolean
                          setAutoDownload(isChecked);
                          chrome.storage.local.set({ autoDownload: isChecked }, () => {
                            console.log('Auto-download setting saved:', isChecked);
                          });
                        }}
                      />
                      <Label htmlFor="auto-download-checkbox" className="font-normal">
                        Automatically download generated cover letter as PDF
                      </Label>
                    </div>
                    
                    {/* Divider (Optional but adds visual separation) */}
                    <div className="border-t border-border pt-6 space-y-6"> 
                      {/* Clear Data Button Setting - Align items */}
                      <div className="flex items-center justify-between"> {/* Use justify-between */} 
                        <Label className="w-32 flex-shrink-0">Manage Data</Label> {/* Remove text-right */} 
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleClearDatabase}
                        >
                          Clear All Data
                        </Button>
                      </div>

                      {/* Clear API Key Button Setting - Align items */}
                      <div className="flex items-center justify-between"> {/* Use justify-between */} 
                        <Label className="w-32 flex-shrink-0">API Key</Label> {/* Remove text-right */} 
                        <Button
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            chrome.storage.local.remove(['openaiApiKey'], () => {
                              if (chrome.runtime.lastError) {
                                console.error('Error clearing API key:', chrome.runtime.lastError);
                              } else {
                                console.log('API key cleared successfully');
                              }
                            });
                          }}
                        >
                          Clear Saved API Key
                        </Button>
                      </div>
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
