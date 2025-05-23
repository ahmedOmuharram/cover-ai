import React, { useState, useEffect } from "react";
import "./App.css";
import Navbar, { ActiveView } from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import DocumentList from "./components/DocumentList";
import GenerationView from "./components/GenerationView";
import HistoryView from "./components/HistoryView";
import SettingsView from "./components/SettingsView";
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
  getAllHistoryEntries,
  clearHistory,
  HistoryEntry,
  deleteHistoryEntry,
  addHistoryEntry,
  handleVersionError,
  deleteDatabase
} from "./utils/indexedDB.js";

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
  const [dbError, setDbError] = useState<string | null>(null); // Add state for database errors
  const [tone, setTone] = useState<ToneSetting>('professional'); // Add state for tone
  const [autoCopy, setAutoCopy] = useState<boolean>(false); // Add state for auto-copy setting
  const [autoDownload, setAutoDownload] = useState<boolean>(false); // Add state for auto-download setting
  const [useAdditionalContext, setUseAdditionalContext] = useState<boolean>(false); // Add state for additional context setting
  const [selectedFont, setSelectedFont] = useState<'times' | 'helvetica'>('times'); // Add state for PDF font
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]); // Add state for history
  const [useCustomDefaultFilename, setUseCustomDefaultFilename] = useState<boolean>(false); // State for checkbox
  const [customDefaultFilename, setCustomDefaultFilename] = useState<string>(''); // State for saved filename
  const [maxWords, setMaxWords] = useState<number>(270); // Update default state to 270
  const [pdfFontSize, setPdfFontSize] = useState<number>(12); // Add state for font size
  const [incomingJobDescription, setIncomingJobDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState<'openai-gpt4' | 'openai-o4mini' | 'gemini-pro' | 'gemini-1.5-flash'>('openai-gpt4');


  // Function to load letters (used in useEffect and after clearing)
  const loadLetters = async () => {
    setIsLoading(true);
    setDbError(null); // Reset any previous errors
    try {
      const [letters, resumes] = await Promise.all([
        getAllCoverLetters(),
        getAllResumes()
      ]);
      setCoverLetters(letters.map((l: { id: number; name: string; }) => ({ id: l.id, name: l.name })));
      setResumes(resumes.map((r: { id: number; name: string; }) => ({ id: r.id, name: r.name })));

      // Load saved tone and settings
      chrome.storage.local.get([
        'tone', 
        'autoCopy', 
        'autoDownload', 
        'useAdditionalContext', 
        'selectedFont', 
        'useCustomDefaultFilename', 
        'customDefaultFilename',
        'maxWords',
        'pdfFontSize',
        'selectedModel'
      ], (result) => {
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

        // Load additional context setting
        setUseAdditionalContext(!!result.useAdditionalContext); // Default to false if not found
        console.log('Loaded use additional context setting:', !!result.useAdditionalContext);

        // Load selected font setting
        const validFonts: Array<'times' | 'helvetica'> = ['times', 'helvetica'];
        if (result.selectedFont && validFonts.includes(result.selectedFont)) {
            setSelectedFont(result.selectedFont);
            console.log('Loaded PDF font:', result.selectedFont);
        } else {
            setSelectedFont('times'); // Default if not found or invalid
            console.log('No valid PDF font found in storage, defaulting to Times New Roman.');
            // Optionally save the default back if it wasn't found
            if (result.selectedFont === undefined) {
                chrome.storage.local.set({ selectedFont: 'times' });
            }
        }

        // Load custom default filename settings
        setUseCustomDefaultFilename(!!result.useCustomDefaultFilename);
        const loadedFilename = result.customDefaultFilename || '';
        setCustomDefaultFilename(loadedFilename); 
        console.log('Loaded custom default filename setting:', !!result.useCustomDefaultFilename, 'Name:', loadedFilename );

        // Load max words setting
        const loadedMaxWords = parseInt(result.maxWords, 10);
        if (!isNaN(loadedMaxWords) && loadedMaxWords > 0) {
          setMaxWords(loadedMaxWords);
          console.log('Loaded max words setting:', loadedMaxWords);
        } else {
          setMaxWords(270); // Update default fallback to 270
          console.log('No valid max words setting found, defaulting to 270.');
          // Optionally save default back if not found
          if (result.maxWords === undefined) {
            chrome.storage.local.set({ maxWords: 270 }); // Update storage default to 270
          }
        }

        // Load PDF font size setting
        const loadedFontSize = parseInt(result.pdfFontSize, 10);
        if (!isNaN(loadedFontSize)) { // Example range validation
           setPdfFontSize(loadedFontSize);
           console.log('Loaded PDF font size setting:', loadedFontSize);
        } else {
           setPdfFontSize(12); // Default if not found or invalid
           console.log('No valid PDF font size setting found, defaulting to 12.');
           // Optionally save default back if not found
           if (result.pdfFontSize === undefined) {
             chrome.storage.local.set({ pdfFontSize: 12 });
           }
        }

        // Load selected model setting
        const validModels: Array<'openai-gpt4' | 'openai-o4mini' | 'gemini-pro' | 'gemini-1.5-flash'> = ['openai-gpt4', 'openai-o4mini', 'gemini-pro', 'gemini-1.5-flash'];
        if (result.selectedModel && validModels.includes(result.selectedModel)) {
            setSelectedModel(result.selectedModel);
            console.log('Loaded selected model:', result.selectedModel);
        } else {
            setSelectedModel('openai-gpt4'); // Default if not found or invalid
            console.log('No valid selected model found in storage, defaulting to openai-gpt4.');
            // Optionally save the default back if it wasn't found
            if (result.selectedModel === undefined) {
                chrome.storage.local.set({ selectedModel: 'openai-gpt4' });
            }
        }
      });
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setCoverLetters([]); // Ensure empty state on error
      setResumes([]); // Also reset resumes on error
      
      // Check for specific version error
      if (typeof error === 'string' && error.includes('version conflict')) {
        setDbError('Database version conflict detected. Please click "Reset Database" to fix this issue.');
      } else {
        // Set general user-friendly error message
        if (typeof error === 'string') {
          setDbError(error);
        } else if (error instanceof Error) {
          setDbError(error.message);
        } else {
          setDbError('Failed to load data from storage. Try refreshing the extension.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'JOB_DESCRIPTION_TEXT' || message.type === 'SCRAPED_JOB_DESCRIPTION') {
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
          chrome.storage.local.remove(['jobDescription']); // clear so it doesn't keep firing
        }
      });
    }, 500); // check every half second
  
    return () => clearInterval(interval); // cleanup on unmount
  }, []);
  
  

  
  // Function to load history entries
  const loadHistory = async () => {
     // No need for setIsLoading here as loadLetters handles the main loading state
     try {
       const entries = await getAllHistoryEntries();
       setHistoryEntries(entries);
     } catch (error) {
       console.error('Failed to load history entries:', error);
       setHistoryEntries([]); // Ensure empty state on error
     }
  };

  // Load letters and history from IndexedDB on mount
  useEffect(() => {
    // Check if IndexedDB is available
    if (!window.indexedDB) {
      setDbError('Your browser does not support or has disabled IndexedDB, which is required for this extension.');
      setIsLoading(false);
      return;
    }
    
    // Load data
    loadLetters();
    loadHistory();
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

  // Handler for clearing the history store
  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear ALL generation history? This cannot be undone.')) {
      try {
        await clearHistory();
        setHistoryEntries([]); // Clear state
        // Optionally show a success message
      } catch (error) {
        console.error('Failed to clear history:', error);
        // Optionally show an error message
      }
    }
  };

  // Handler for deleting a single history entry
  const handleDeleteHistoryEntry = async (id: number) => {
    // Optional: Confirm before deleting
    // if (!window.confirm('Are you sure you want to delete this history entry?')) {
    //   return;
    // }
    try {
      await deleteHistoryEntry(id);
      setHistoryEntries(prevEntries => prevEntries.filter(entry => entry.id !== id));
    } catch (error) {
      console.error(`Failed to delete history entry ${id}:`, error);
      // Optionally show an error message to the user
    }
  };

  // --- Handlers for simple boolean settings with storage update ---
  const createSettingHandler = (setter: React.Dispatch<React.SetStateAction<boolean>>, storageKey: string) => {
    return (enabled: boolean) => {
      setter(enabled);
      chrome.storage.local.set({ [storageKey]: enabled });
      console.log(`${storageKey} setting saved:`, enabled);
    };
  };

  const handleSetAutoCopy = createSettingHandler(setAutoCopy, 'autoCopy');
  const handleSetAutoDownload = createSettingHandler(setAutoDownload, 'autoDownload');
  const handleSetUseAdditionalContext = createSettingHandler(setUseAdditionalContext, 'useAdditionalContext');
  const handleSetUseCustomDefaultFilename = createSettingHandler(setUseCustomDefaultFilename, 'useCustomDefaultFilename');

  // Handler for font selection
  const handleSetSelectedFont = (font: 'times' | 'helvetica') => {
    setSelectedFont(font);
    chrome.storage.local.set({ selectedFont: font }, () => {
      console.log('PDF font saved:', font);
    });
  };

  // Handler for setting custom default filename (passed to SettingsView)
  const handleSetCustomDefaultFilename = (filename: string) => {
    setCustomDefaultFilename(filename);
    // The saving to chrome.storage.local is handled within SettingsView now
  };

  // Handler for setting max words
  const handleSetMaxWords = (words: number) => {
    setMaxWords(words);
    chrome.storage.local.set({ maxWords: words }, () => {
      console.log('Max words saved:', words);
    });
  };

  // Handler for setting PDF font size
  const handleSetPdfFontSize = (size: number) => {
    setPdfFontSize(size);
    chrome.storage.local.set({ pdfFontSize: size }, () => {
      console.log('PDF font size saved:', size);
    });
  };

  // Add handler for model selection
  const handleSetSelectedModel = (model: 'openai-gpt4' | 'openai-o4mini' | 'gemini-pro' | 'gemini-1.5-flash') => {
    setSelectedModel(model);
    chrome.storage.local.set({ selectedModel: model });
  };

  // Callback function for when generation is complete in GenerationView
  const handleGenerationComplete = async (data: { content: string; font: 'times' | 'helvetica'; filename: string }) => {
    try {
      console.log('Generation complete, adding to history:', data.filename);
      await addHistoryEntry(data.content, data.font, data.filename);
      // After successfully adding, reload the history state
      await loadHistory();
      console.log('History reloaded after generation.');
    } catch (error) {
      console.error('Failed to add history entry or reload history:', error);
      // Optionally show an error to the user
    }
  };

  // Handle database reset (for version conflicts)
  const handleResetDatabase = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      // Delete the database entirely
      await deleteDatabase();
      // Then attempt to reload the data which will create a fresh database
      await loadLetters();
      await loadHistory();
      console.log('Database reset and reloaded successfully');
    } catch (error) {
      console.error('Failed to reset database:', error);
      if (typeof error === 'string') {
        setDbError(error);
      } else if (error instanceof Error) {
        setDbError(error.message);
      } else {
        setDbError('Failed to reset database. Please try reinstalling the extension.');
      }
    } finally {
      setIsLoading(false);
    }
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
      {/* Display database error message if one exists */}
      {dbError && (
        <div className="error-banner">
          <p>Database Error: {dbError}</p>
          <div>
            <button onClick={() => loadLetters()} className="mr-2">Try Again</button>
            {dbError.includes('version conflict') && (
              <button onClick={handleResetDatabase} className="reset-db-btn">Reset Database</button>
            )}
          </div>
        </div>
      )}
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
                    autoDownload={autoDownload}
                    injectedJobDescription={incomingJobDescription}
                    useAdditionalContext={useAdditionalContext}
                    useCustomDefaultFilename={useCustomDefaultFilename}
                    customDefaultFilename={customDefaultFilename}
                    maxWords={maxWords}
                    pdfFontSize={pdfFontSize}
                    onGenerationComplete={handleGenerationComplete}
                    selectedModel={selectedModel}
                    setSelectedModel={handleSetSelectedModel}
                  />
                }

                {/* History View */} 
                {activeView === 'history' &&
                  <HistoryView 
                    entries={historyEntries}
                    onClearHistory={handleClearHistory}
                    onDeleteEntry={handleDeleteHistoryEntry}
                    pdfFontSize={pdfFontSize} // Pass font size prop
                  />
                }

                {/* Settings Page - Now using SettingsView component */}
                {activeView === 'settings' &&
                  <SettingsView 
                    tone={tone}
                    handleToneChange={handleToneChange}
                    selectedFont={selectedFont}
                    setSelectedFont={handleSetSelectedFont}
                    autoCopy={autoCopy}
                    setAutoCopy={handleSetAutoCopy}
                    autoDownload={autoDownload}
                    setAutoDownload={handleSetAutoDownload}
                    useAdditionalContext={useAdditionalContext}
                    setUseAdditionalContext={handleSetUseAdditionalContext}
                    useCustomDefaultFilename={useCustomDefaultFilename}
                    setUseCustomDefaultFilename={handleSetUseCustomDefaultFilename}
                    customDefaultFilename={customDefaultFilename}
                    setCustomDefaultFilename={handleSetCustomDefaultFilename}
                    handleClearDatabase={handleClearDatabase}
                    maxWords={maxWords}
                    handleSetMaxWords={handleSetMaxWords}
                    pdfFontSize={pdfFontSize}
                    handleSetPdfFontSize={handleSetPdfFontSize}
                    selectedModel={selectedModel}
                    setSelectedModel={handleSetSelectedModel}
                  />
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
