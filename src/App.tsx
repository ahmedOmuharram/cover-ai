import { useState, useEffect } from "react";
import "./App.css";
import Navbar, { ActiveView } from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import DocumentList from "./components/DocumentList";
import GeneratePage from "./components/GeneratePage";
import {
  addCoverLetter,
  getAllCoverLetters,
  clearDatabase,
  getAllResumes,
  addResume,
} from "./utils/indexedDB";

interface Document {
  id: number;
  name: string;
  // Content is not needed in the main App state if only showing names in CoverLetterList
}

function App() {
  const [coverLetters, setCoverLetters] = useState<Document[]>([]);
  const [resumes, setResumes] = useState<Document[]>([]); // Add resumes state
  const [activeView, setActiveView] = useState<ActiveView>("generate"); // Default to 'generate' letters
  const [isLoading, setIsLoading] = useState(true); // Track initial loading

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

      if (letters.length > 0 || resumes.length > 0) { // Update condition to check for both
        setActiveView('view');
      } else {
        if(activeView !== 'generate') setActiveView('upload');
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
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
                {activeView === 'view' && (coverLetters.length > 0 || resumes.length > 0) && 
                  <DocumentList 
                    letters={coverLetters}
                    resumes={resumes}
                    onFileUpload={handleFileUpload}
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
                  <div style={{padding: '20px'}}> 
                    <h2>Settings</h2>
                    <p>Settings content will go here.</p>
                    
                    <button 
                      onClick={handleClearDatabase} 
                      style={{
                        marginTop: '20px',
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
