import { useState, useEffect } from "react";
import "./App.css";
import Navbar, { ActiveView } from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import CoverLetterList from "./components/CoverLetterList";
import GeneratePage from "./components/GeneratePage";
import {
  addCoverLetter,
  getAllCoverLetters,
  clearDatabase,
  getAllResumes,
} from "./utils/indexedDB";

interface Document {
  id: number;
  name: string;
  // Content is not needed in the main App state if only showing names in CoverLetterList
}

function App() {
  const [coverLetters, setCoverLetters] = useState<Document[]>([]);
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

      if (letters.length > 0) {
        setActiveView('view');
      } else {
        if(activeView !== 'generate') setActiveView('upload');
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      setCoverLetters([]); // Ensure empty state on error
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

  // Handler for clearing the DB (now clears both stores)
  const handleClearDatabase = async () => {
    if (window.confirm('Are you sure you want to clear ALL cover letters and resumes? This cannot be undone.')) {
      try {
        await clearDatabase(); // Clears both stores by default
        setCoverLetters([]);
        // setResumes([]); // TODO: Add this when we have resumes
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
                {activeView === 'view' && coverLetters.length > 0 && // Only show view if letters exist
                  <CoverLetterList 
                    letters={coverLetters} 
                    // Pass the specific cover letter upload handler
                    onFileUpload={handleCoverLetterUpload} 
                  />
                }
                
                {activeView === 'upload' && 
                  // This section now ONLY uploads cover letters
                  <UploadSection 
                    title="Upload Cover Letter" // Simplified title
                    onFileUpload={handleCoverLetterUpload} 
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
