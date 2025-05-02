import * as pdfjsLib from 'pdfjs-dist';

const DB_NAME = 'CoverLetterDB';
const COVER_LETTER_STORE = 'coverLetters';
const RESUME_STORE = 'resumes';
const HISTORY_STORE = 'generationHistory';
const DB_VERSION = 3;

interface DocumentRecord {
  id: number;
  name: string;
  content: string;
  // TODO: Add other fields as needed
}

// Define interface for History Entry
export interface HistoryEntry {
  id: number;
  timestamp: number;
  pdfContent: string;
  font: 'times' | 'helvetica';
  filename: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

// Initialize PDF worker safely
const initPdfWorker = () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
      console.log('PDF worker initialized with Chrome runtime URL');
    } else {
      console.warn('Chrome runtime not available, using default PDF worker path');
      // Fallback for non-extension environments (like testing)
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  } catch (error) {
    console.error('Error initializing PDF worker:', error);
  }
};

// Initialize worker
initPdfWorker();

/**
 * Opens and returns the IndexedDB database instance.
 * Handles database creation and upgrades.
 * Caches the promise to avoid reopening the database unnecessarily.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
const getDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  
  dbPromise = new Promise((resolve, reject) => {
    try {
      console.log('Opening IndexedDB database:', DB_NAME, 'version:', DB_VERSION);
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        console.log('Database upgrade needed.');
        const db = (event.target as IDBOpenDBRequest).result;
        // Create cover letter store if it doesn't exist
        if (!db.objectStoreNames.contains(COVER_LETTER_STORE)) {
          db.createObjectStore(COVER_LETTER_STORE, { keyPath: 'id', autoIncrement: true });
          console.log(`Object store ${COVER_LETTER_STORE} created.`);
        }
        // Create resume store if it doesn't exist (handles version upgrade)
        if (!db.objectStoreNames.contains(RESUME_STORE)) {
          db.createObjectStore(RESUME_STORE, { keyPath: 'id', autoIncrement: true });
          console.log(`Object store ${RESUME_STORE} created.`);
        }
        // Create history store if it doesn't exist (handles version upgrade)
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false }); // Index for sorting
          console.log(`Object store ${HISTORY_STORE} created with timestamp index.`);
        }
      };

      request.onsuccess = (event) => {
        console.log('Database opened successfully.');
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        console.error('IndexedDB error opening database:', error);
        console.error('Error name:', error?.name, 'Error message:', error?.message);
        
        // Reset the dbPromise so subsequent attempts can try again
        dbPromise = null;
        
        // Check for specific errors
        if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') {
          reject('IndexedDB access was blocked by browser security settings or permissions. Try refreshing or checking privacy settings.');
        } else if (error?.name === 'VersionError') {
          reject('IndexedDB version conflict. Please reload the extension.');
        } else {
          reject(`Error opening IndexedDB: ${error?.message || 'Unknown error'}`);
        }
      };

      request.onblocked = (event) => {
        console.warn('IndexedDB open request was blocked. Close other tabs with this extension open.');
        // You might want to prompt the user to close other tabs
      };
    } catch (error) {
      console.error('Exception during IndexedDB initialization:', error);
      dbPromise = null;
      reject(`Failed to initialize IndexedDB: ${error}`);
    }
  });
  
  return dbPromise;
};

/**
 * Extracts text content from a PDF file.
 * Uses pdf.js library with disabled worker for local processing.
 * @param {File} file - The PDF file to extract text from.
 * @returns {Promise<string>} A promise that resolves with the extracted text content.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise;

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');

      fullText += pageText + '\n';
    }

    console.log(`Successfully extracted text from PDF: ${file.name}`);
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Generic function to add a document (File) to a specified object store.
 * Reads the file content as text before storing.
 * @param {string} storeName - The name of the object store (e.g., 'coverLetters', 'resumes').
 * @param {File} file - The file object to add.
 * @returns {Promise<number>} A promise that resolves with the ID (key) of the newly added document.
 */
const addDocument = async (storeName: string, file: File): Promise<number> => {
  const db = await getDb();
  console.log(`Adding document to ${storeName}:`, file.name);
  const content = await extractTextFromPDF(file); // Read file content as text
  console.log(content);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const documentData = { name: file.name, content: content }; 
    const request = store.add(documentData);

    request.onsuccess = (event) => {
      console.log(`Document added to ${storeName} with id:`, (event.target as IDBRequest).result);
      resolve((event.target as IDBRequest).result as number);
    };
    request.onerror = (event) => {
      console.error(`Error adding document to ${storeName}:`, (event.target as IDBRequest).error);
      reject(`Error adding document to ${storeName}`);
    };
  });
};

/**
 * Generic function to retrieve all documents from a specified object store.
 * @param {string} storeName - The name of the object store.
 * @returns {Promise<DocumentRecord[]>} A promise that resolves with an array of all document records in the store.
 */
const getAllDocuments = async (storeName: string): Promise<DocumentRecord[]> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll(); // Note: This gets the full record including content

      request.onsuccess = (event) => {
        const records = (event.target as IDBRequest).result as DocumentRecord[];
        // We only need id and name for the dropdowns usually
        // const namesAndIds = records.map(record => ({ id: record.id, name: record.name }));
        // For simplicity now, return full record, but consider optimizing later
        console.log(`Successfully retrieved documents from ${storeName}.`);
        resolve(records);
      };
      request.onerror = (event) => {
        console.error(`Error getting documents from ${storeName}:`, (event.target as IDBRequest).error);
        reject(`Error getting documents from ${storeName}`);
      };
    });
};

/**
 * Generic function to retrieve the content of a specific document by its ID from a specified object store.
 * @param {string} storeName - The name of the object store.
 * @param {number} id - The ID of the document to retrieve.
 * @returns {Promise<string | null>} A promise that resolves with the document content (string) or null if not found.
 */
const getDocumentContent = async (storeName: string, id: number): Promise<string | null> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = (event) => {
        const record = (event.target as IDBRequest).result as DocumentRecord | undefined;
        console.log(`Retrieved record from ${storeName} for id ${id}:`, !!record);
        resolve(record ? record.content : null);
      };
      request.onerror = (event) => {
        console.error(`Error getting document content from ${storeName} with id ${id}:`, (event.target as IDBRequest).error);
        reject(`Error getting document content from ${storeName}`);
      };
    });
};

/**
 * Generic function to delete a single document by its ID from a specified store.
 * @param {string} storeName - The name of the object store.
 * @param {number} id - The ID of the document to delete.
 * @returns {Promise<void>} A promise that resolves when the document is deleted.
 */
const deleteDocument = async (storeName: string, id: number): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Document with id ${id} deleted from ${storeName}`);
      resolve();
    };
    request.onerror = (event) => {
      console.error(`Error deleting document from ${storeName}:`, (event.target as IDBRequest).error);
      reject(`Error deleting document from ${storeName}`);
    };
  });
};

/**
 * Generic function to rename a document by its ID in a specified store.
 * @param {string} storeName - The name of the object store.
 * @param {number} id - The ID of the document to rename.
 * @param {string} newName - The new name for the document.
 * @returns {Promise<void>} A promise that resolves when the document is renamed.
 */
const renameDocument = async (storeName: string, id: number, newName: string): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // First get the existing document
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const document = getRequest.result;
      if (!document) {
        reject(`Document with id ${id} not found in ${storeName}`);
        return;
      }

      // Update the name
      document.name = newName;
      
      // Put the updated document back
      const putRequest = store.put(document);
      
      putRequest.onsuccess = () => {
        console.log(`Document ${id} renamed to ${newName} in ${storeName}`);
        resolve();
      };
      
      putRequest.onerror = (event) => {
        console.error(`Error renaming document in ${storeName}:`, (event.target as IDBRequest).error);
        reject(`Error renaming document in ${storeName}`);
      };
    };
    
    getRequest.onerror = (event) => {
      console.error(`Error getting document for rename from ${storeName}:`, (event.target as IDBRequest).error);
      reject(`Error getting document for rename from ${storeName}`);
    };
  });
};

// --- Specific Functions ---

/**
 * Adds a cover letter file to the database.
 * @param {File} file - The cover letter file object.
 * @returns {Promise<number>} A promise that resolves with the ID of the newly added cover letter.
 */
export const addCoverLetter = (file: File) => addDocument(COVER_LETTER_STORE, file);

/**
 * Retrieves all cover letters from the database.
 * @returns {Promise<DocumentRecord[]>} A promise that resolves with an array of all cover letter records.
 */
export const getAllCoverLetters = () => getAllDocuments(COVER_LETTER_STORE);

/**
 * Retrieves the content of a specific cover letter by its ID.
 * @param {number} id - The ID of the cover letter.
 * @returns {Promise<string | null>} A promise that resolves with the cover letter content or null if not found.
 */
export const getCoverLetterContent = (id: number) => getDocumentContent(COVER_LETTER_STORE, id);

/**
 * Adds a resume file to the database.
 * @param {File} file - The resume file object.
 * @returns {Promise<number>} A promise that resolves with the ID of the newly added resume.
 */
export const addResume = (file: File) => addDocument(RESUME_STORE, file);

/**
 * Retrieves all resumes from the database.
 * @returns {Promise<DocumentRecord[]>} A promise that resolves with an array of all resume records.
 */
export const getAllResumes = () => getAllDocuments(RESUME_STORE);

/**
 * Retrieves the content of a specific resume by its ID.
 * @param {number} id - The ID of the resume.
 * @returns {Promise<string | null>} A promise that resolves with the resume content or null if not found.
 */
export const getResumeContent = (id: number) => getDocumentContent(RESUME_STORE, id);

/**
 * Clears all entries from one or all document stores.
 * If no storeName is provided, clears both cover letters and resumes.
 * @param {string} [storeName] - Optional. The specific store to clear (e.g., 'coverLetters', 'resumes').
 * @returns {Promise<void>} A promise that resolves when the clearing operation is complete or rejects on error.
 */
export const clearDatabase = async (storeName?: string): Promise<void> => {
  const db = await getDb();
  const storesToClear = storeName ? [storeName] : [COVER_LETTER_STORE, RESUME_STORE]; // Clear specific or all

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storesToClear, 'readwrite');
    let clearedCount = 0;

    storesToClear.forEach(currentStoreName => { // Renamed inner variable
        const store = transaction.objectStore(currentStoreName); // Use renamed variable
        const request = store.clear();
        request.onsuccess = () => {
            console.log(`Store ${currentStoreName} cleared successfully.`); // Use renamed variable
            clearedCount++;
            if (clearedCount === storesToClear.length) {
                resolve();
            }
        };
        request.onerror = (event) => {
            console.error(`Error clearing store ${currentStoreName}:`, (event.target as IDBRequest).error); // Use renamed variable
            // Don't reject immediately, let transaction complete or error out
        };
    });

    transaction.oncomplete = () => {
        console.log('Clear transaction complete.');
        if (clearedCount === storesToClear.length) {
            resolve(); // Resolve only if all clears succeeded or completed
        } else {
            reject('Failed to clear one or more stores.');
        }
    };

    transaction.onerror = (event) => {
        console.error('Error in clear transaction:', event);
        reject('Error clearing database stores');
    };
  });
};

/**
 * Closes the cached database connection, if open.
 */
export const closeDb = async (): Promise<void> => {
  if (!dbPromise) {
    console.log('closeDb: No active DB promise to close.');
    return;
  }
  try {
    console.log('closeDb: Attempting to close DB connection...');
    const db = await dbPromise;
    db.close();
    dbPromise = null; // Reset the promise cache
    console.log('closeDb: DB connection closed and promise reset.');
  } catch (error) {
    console.error('closeDb: Error closing database:', error);
    // Also reset promise even if close failed?
    dbPromise = null; 
  }
};

// Export specific functions for cover letters
export const deleteCoverLetter = (id: number) => deleteDocument(COVER_LETTER_STORE, id);
export const renameCoverLetter = (id: number, newName: string) => renameDocument(COVER_LETTER_STORE, id, newName);

// Export specific functions for resumes
export const deleteResume = (id: number) => deleteDocument(RESUME_STORE, id);
export const renameResume = (id: number, newName: string) => renameDocument(RESUME_STORE, id, newName);

// --- History Functions ---

/**
 * Adds a generation history entry to the database.
 * @param {string} pdfContent - The generated text content of the PDF.
 * @param {'times' | 'helvetica'} font - The font used for the PDF.
 * @param {string} filename - The filename used when saving the PDF.
 * @returns {Promise<number>} A promise that resolves with the ID of the new history entry.
 */
export const addHistoryEntry = async (pdfContent: string, font: 'times' | 'helvetica', filename: string): Promise<number> => {
  const db = await getDb();
  const timestamp = Date.now();
  console.log(`Adding history entry at ${new Date(timestamp).toISOString()} with filename: ${filename}`);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const historyData = { timestamp, pdfContent, font, filename };
    const request = store.add(historyData);

    request.onsuccess = (event) => {
      console.log(`History entry added with id:`, (event.target as IDBRequest).result);
      resolve((event.target as IDBRequest).result as number);
    };
    request.onerror = (event) => {
      console.error(`Error adding history entry:`, (event.target as IDBRequest).error);
      reject(`Error adding history entry`);
    };
  });
};

/**
 * Retrieves all history entries from the database, sorted by timestamp descending.
 * @returns {Promise<HistoryEntry[]>} A promise that resolves with an array of history entries.
 */
export const getAllHistoryEntries = async (): Promise<HistoryEntry[]> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE);
    const index = store.index('timestamp'); // Use the timestamp index
    const request = index.getAll(); // Get all entries, sorted by index is default but we reverse

    request.onsuccess = (event) => {
      const records = (event.target as IDBRequest).result as HistoryEntry[];
      console.log(`Successfully retrieved ${records.length} history entries.`);
      resolve(records.reverse()); // Reverse for descending order (newest first)
    };
    request.onerror = (event) => {
      console.error(`Error getting history entries:`, (event.target as IDBRequest).error);
      reject(`Error getting history entries`);
    };
  });
};

/**
 * Clears all entries from the history store.
 * @returns {Promise<void>} A promise that resolves when the history store is cleared.
 */
export const clearHistory = async (): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.clear();

    request.onsuccess = () => {
      console.log(`History store cleared.`);
      resolve();
    };
    request.onerror = (event) => {
      console.error(`Error clearing history store:`, (event.target as IDBRequest).error);
      reject(`Error clearing history store`);
    };
  });
};

/**
 * Deletes a single history entry by its ID.
 * @param {number} id - The ID of the history entry to delete.
 * @returns {Promise<void>} A promise that resolves when the entry is deleted.
 */
export const deleteHistoryEntry = async (id: number): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`History entry with id ${id} deleted.`);
      resolve();
    };
    request.onerror = (event) => {
      console.error(`Error deleting history entry ${id}:`, (event.target as IDBRequest).error);
      reject(`Error deleting history entry`);
    };
  });
};

/**
 * Deletes the IndexedDB database completely.
 * This is useful for resolving version conflicts by removing the database entirely.
 * @returns {Promise<void>} A promise that resolves when the database is deleted.
 */
export const deleteDatabase = (): Promise<void> => {
  // Reset our cached promise to ensure we create a new connection after deletion
  dbPromise = null;
  
  return new Promise((resolve, reject) => {
    console.log(`Attempting to delete IndexedDB database: ${DB_NAME}`);
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => {
      console.log(`Successfully deleted database: ${DB_NAME}`);
      resolve();
    };
    
    request.onerror = (event) => {
      console.error(`Error deleting database: ${DB_NAME}`, (event.target as IDBOpenDBRequest).error);
      reject(`Failed to delete database: ${(event.target as IDBOpenDBRequest).error?.message || 'Unknown error'}`);
    };
    
    request.onblocked = () => {
      console.warn(`Database deletion blocked. Close all other tabs using this extension.`);
      // Still resolve, as the user can try again after closing tabs
      resolve();
    };
  });
};

/**
 * Handles version error by deleting the database and then reopening it.
 * This acts as a "reset" when version conflicts occur.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
export const handleVersionError = async (): Promise<IDBDatabase> => {
  try {
    await deleteDatabase();
    return await getDb();
  } catch (error) {
    console.error('Failed to handle version error:', error);
    throw error;
  }
};