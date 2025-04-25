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
  deleteHistoryEntry
} from "./utils/indexedDB.js";
import { Button } from "./components/ui/button.js";
import { Label } from "./components/ui/label";
import { Checkbox } from "./components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Pencil, Trash2 } from 'lucide-react';

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
  const [useAdditionalContext, setUseAdditionalContext] = useState<boolean>(false); // Add state for additional context setting
  const [selectedFont, setSelectedFont] = useState<'times' | 'helvetica'>('times'); // Add state for PDF font
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]); // Add state for history
  const [useCustomDefaultFilename, setUseCustomDefaultFilename] = useState<boolean>(false); // State for checkbox
  const [customDefaultFilename, setCustomDefaultFilename] = useState<string>(''); // State for saved filename
  const [maxWords, setMaxWords] = useState<number>(270); // Update default state to 270

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
      chrome.storage.local.get([
        'tone', 
        'autoCopy', 
        'autoDownload', 
        'useAdditionalContext', 
        'selectedFont', 
        'useCustomDefaultFilename', 
        'customDefaultFilename', // Load new settings
        'maxWords' // Load max words setting
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
      });
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setCoverLetters([]); // Ensure empty state on error
      setResumes([]); // Also reset resumes on error
    } finally {
      setIsLoading(false);
    }
  };

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
    loadLetters();
    loadHistory(); // Load history as well
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

  return (
    <div className="App flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground rounded-lg shadow-md">
      {/* Loading State */}
      {isLoading && <div className="loading-indicator flex-grow flex items-center justify-center">Loading...</div>}

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
                    useAdditionalContext={useAdditionalContext} // Pass down additional context setting
                    useCustomDefaultFilename={useCustomDefaultFilename}
                    customDefaultFilename={customDefaultFilename}
                    maxWords={maxWords} // Pass maxWords prop
                  />
                }

                {/* History View */} 
                {activeView === 'history' &&
                  <HistoryView 
                    entries={historyEntries}
                    onClearHistory={handleClearHistory}
                    onDeleteEntry={handleDeleteHistoryEntry}
                  />
                }

                {/* Settings Page - Now using SettingsView component */}
                {activeView === 'settings' &&
                  <SettingsView 
                    tone={tone}
                    handleToneChange={handleToneChange}
                    selectedFont={selectedFont}
                    setSelectedFont={handleSetSelectedFont} // Pass wrapped handler
                    autoCopy={autoCopy}
                    setAutoCopy={handleSetAutoCopy} // Pass wrapped handler
                    autoDownload={autoDownload}
                    setAutoDownload={handleSetAutoDownload} // Pass wrapped handler
                    useAdditionalContext={useAdditionalContext}
                    setUseAdditionalContext={handleSetUseAdditionalContext} // Pass wrapped handler
                    useCustomDefaultFilename={useCustomDefaultFilename}
                    setUseCustomDefaultFilename={handleSetUseCustomDefaultFilename} // Pass wrapped handler
                    customDefaultFilename={customDefaultFilename}
                    setCustomDefaultFilename={handleSetCustomDefaultFilename} // Pass specific setter
                    handleClearDatabase={handleClearDatabase}
                    maxWords={maxWords} // Pass maxWords state
                    handleSetMaxWords={handleSetMaxWords} // Pass handler
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
