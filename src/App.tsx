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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      chrome.storage.local.get(['tone', 'autoCopy', 'autoDownload', 'useAdditionalContext', 'selectedFont'], (result) => {
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
                  />
                }

                {/* Settings Page - Apply Tailwind classes */}
                {activeView === 'settings' &&
                  <Card className="h-full gap-3"> 
                    <CardHeader>
                      <CardTitle className="text-2xl tracking-tight mb-0">Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col justify-between h-full p-5 pt-0 mt-0">
                      {/* Top settings: tone, auto-copy, auto-download */}
                      <div className="space-y-6">
                        {/* Tone Selection Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="tone-select" className="flex-shrink-0">
                            Generation Tone
                          </Label>
                          <div className="flex-grow">
                            <Select
                              value={tone}
                              onValueChange={(value: ToneSetting) => handleToneChange(value)}
                            >
                              <SelectTrigger id="tone-select" className="w-full">
                                <SelectValue placeholder="Select tone" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* PDF Font Selection Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="font-select" className="flex-shrink-0">
                            Font (PDFs)
                          </Label>
                          <div className="flex-grow">
                            <Select
                              value={selectedFont}
                              onValueChange={(value: 'times' | 'helvetica') => {
                                setSelectedFont(value);
                                chrome.storage.local.set({ selectedFont: value }, () => {
                                  console.log('PDF font saved:', value);
                                });
                              }}
                            >
                              <SelectTrigger id="font-select" className="w-full">
                                <SelectValue placeholder="Select font" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="times">Times New Roman</SelectItem>
                                <SelectItem value="helvetica">Helvetica</SelectItem> 
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Auto-copy Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="auto-copy" className="flex-grow">
                            Auto-copy prompt to clipboard?
                          </Label>
                          <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="auto-copy"
                              checked={autoCopy}
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setAutoCopy(isChecked);
                                chrome.storage.local.set({ autoCopy: isChecked });
                                console.log('Auto-copy setting saved:', isChecked);
                              }}
                            />
                          </div>
                        </div>
                        {/* Auto-download Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="auto-download" className="flex-grow">
                            Auto-download cover letter as PDF?
                          </Label>
                          <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="auto-download"
                              checked={autoDownload}
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setAutoDownload(isChecked);
                                chrome.storage.local.set({ autoDownload: isChecked });
                                console.log('Auto-download setting saved:', isChecked);
                              }}
                            />
                          </div>
                        </div>
                        {/* Use Additional Context Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="additional-context" className="flex-grow">
                            Use additional context for generation?
                          </Label>
                          <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="additional-context"
                              checked={useAdditionalContext}
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setUseAdditionalContext(isChecked);
                                chrome.storage.local.set({ useAdditionalContext: isChecked });
                                console.log('Use additional context setting saved:', isChecked);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Bottom actions: clear data & API key */}
                      <div className="space-y-6 pt-4 border-t">
                        {/* Clear API Key Setting - Grouping button and text */}
                        <div className="flex items-start space-x-4">
                          <Label className="pt-1.5 flex-shrink-0">
                            API Key
                          </Label>
                          <div className="flex flex-col items-end flex-grow">
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
                        {/* Clear Database Setting - Restructured */}
                        <div className="flex items-start space-x-4">
                          <Label className="pt-1.5 flex-shrink-0">
                            Manage Files
                          </Label>
                          <div className="flex flex-col items-end flex-grow">
                            <Button variant="destructive" size="sm" onClick={handleClearDatabase}>
                              Delete All Documents
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
