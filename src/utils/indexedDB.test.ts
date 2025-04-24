// src/utils/indexedDB.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Import *only* the functions we intend to test directly now
import {
  addCoverLetter,
  addResume,
  getAllCoverLetters,
  getCoverLetterContent,
  deleteCoverLetter,
  renameCoverLetter,
  getAllResumes,
  getResumeContent,
  deleteResume,
  renameResume,
  clearDatabase,
  closeDb,
} from './indexedDB.js';

// Define constants locally
const DB_NAME = 'CoverLetterDB';
const COVER_LETTER_STORE = 'coverLetters';
const RESUME_STORE = 'resumes';

interface DocumentRecord {
  id: number;
  name: string;
  content: string;
}

// Helper to manually add data for tests
const seedDatabase = async (data: { store: string; records: Omit<DocumentRecord, 'id'>[] }[]) => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME); // Use fake indexedDB

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      try {
        const stores = data.map(d => d.store);
        const transaction = db.transaction(stores, 'readwrite');
        let completedStores = 0;

        transaction.oncomplete = () => {
          console.log('Seed transaction complete.');
          db.close(); // Close connection after seeding
          resolve();
        };
        transaction.onerror = (errEvent) => {
          console.error('Seed transaction error:', transaction.error || errEvent);
          db.close();
          reject('Seed transaction failed');
        };

        data.forEach(({ store: storeName, records }) => {
          const store = transaction.objectStore(storeName);
          let addedCount = 0;
          records.forEach(record => {
            const addRequest = store.add(record);
            addRequest.onsuccess = () => {
              addedCount++;
              if (addedCount === records.length) {
                 completedStores++;
              }
            };
            addRequest.onerror = (err) => {
              console.error(`Error seeding record into ${storeName}:`, addRequest.error || err);
            };
          });
        });

      } catch (e) {
        console.error(`Error during seeding setup:`, e);
        db.close();
        reject(`Seed setup failed: ${e}`);
      }
    };
    request.onerror = (event) => {
      console.error(`Seed DB open error:`, (event.target as IDBOpenDBRequest).error);
      reject('Seed failed to open DB');
    };
    // No onupgradeneeded needed here, clearDatabase in beforeEach handles setup
  });
};


const createMockFile = (name: string, content: string = 'file content'): File => {
  // Create a simple object mimicking File properties needed by extractTextFromPDF
  const mockFile = {
    name: name,
    size: content.length,
    type: 'text/plain', // Or 'application/pdf' might be more realistic if needed
    lastModified: Date.now(),
    // Provide an async function that returns an ArrayBuffer
    arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(content).buffer),
    // Add other File/Blob methods as placeholders if needed by other code paths
    slice: vi.fn(() => new Blob()),
    stream: vi.fn(() => new ReadableStream()),
    text: vi.fn().mockResolvedValue(content),
    // Ensure it adheres to the File interface as much as possible
    webkitRelativePath: '', 
  };
  // Cast to File type for type checking, but understand it's a mock object
  return mockFile as unknown as File;
};

// Define a type for the documents returned by getAll*
interface StoredDocument {
  id: number;
  name: string;
  content?: string; // Content might not always be present depending on the function
}

describe('IndexedDB Utility Functions', () => {

  // Sample data to seed
  const coverLetter1: Omit<DocumentRecord, 'id'> = { name: 'CL1.txt', content: 'Content for CL1' };
  const coverLetter2: Omit<DocumentRecord, 'id'> = { name: 'CL2.pdf', content: 'Content for CL2 PDF' };
  const resume1: Omit<DocumentRecord, 'id'> = { name: 'Resume1.pdf', content: 'Content for Resume 1' };
  const mockExtractedContent = 'Mock PDF text content line 1  line 2'; // <-- Added extra space

  beforeEach(async () => {
    // Delete the database entirely first to reset auto-increment counters
    console.log(`Deleting database ${DB_NAME}...`);
    await new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      deleteRequest.onsuccess = () => {
        console.log(`Database ${DB_NAME} deleted successfully.`);
        resolve();
      };
      deleteRequest.onerror = (event) => {
        console.error(`Error deleting database ${DB_NAME}:`, deleteRequest.error);
        reject(`Failed to delete database: ${deleteRequest.error?.message}`);
      };
      deleteRequest.onblocked = () => {
        console.warn(`Database ${DB_NAME} delete blocked. Retrying after potential close.`);
        // This might happen if a previous connection wasn't closed.
        // Attempting delete again might work, or requires more complex handling.
        // For fake-indexeddb, it's usually less of an issue.
        reject('Database delete blocked');
      };
    });

    // Clear stores first (this also sets up the stores via onupgradeneeded)
    await clearDatabase();
    console.log('Database cleared/initialized for test.');

    // Seed with test data
    await seedDatabase([
        { store: COVER_LETTER_STORE, records: [coverLetter1, coverLetter2] },
        { store: RESUME_STORE, records: [resume1] }
    ]);
    console.log('Database seeded for test.');
  });

  // Add afterEach block to close the connection
  afterEach(async () => {
    console.log('Running afterEach to close DB connection...');
    await closeDb();
  });

  // --- Add Functions Tests ---
  describe('Add Functions', () => {
    it('should add a cover letter via addCoverLetter and retrieve it', async () => {
      const mockFile = createMockFile('TestCL.txt');
      const id = await addCoverLetter(mockFile);
      expect(id).toBeGreaterThan(0);

      // Verify using getAll
      const letters = await getAllCoverLetters();
      // Note: beforeEach seeds 2 CLs, this adds a 3rd
      expect(letters).toHaveLength(3);
      const addedLetter = letters.find((l: StoredDocument) => l.id === id);
      expect(addedLetter).toBeDefined();
      expect(addedLetter).toEqual(expect.objectContaining({
        id: id,
        name: 'TestCL.txt',
        content: mockExtractedContent // Check for content from mock pdfjs
      }));

      // Verify using getContent
      const content = await getCoverLetterContent(id);
      expect(content).toBe(mockExtractedContent);
    });

    it('should add a resume via addResume and retrieve it', async () => {
      const mockFile = createMockFile('TestResume.pdf');
      const id = await addResume(mockFile);
      expect(id).toBeGreaterThan(0);

      // Verify using getAll
      const resumes = await getAllResumes();
      // Note: beforeEach seeds 1 Resume, this adds a 2nd
      expect(resumes).toHaveLength(2);
      const addedResume = resumes.find((r: StoredDocument) => r.id === id);
      expect(addedResume).toBeDefined();
      expect(addedResume).toEqual(expect.objectContaining({
        id: id,
        name: 'TestResume.pdf',
        content: mockExtractedContent // Check for content from mock pdfjs
      }));

      // Verify using getContent
      const content = await getResumeContent(id);
      expect(content).toBe(mockExtractedContent);
    });
  });

  // --- Cover Letter Tests (Read, Delete, Rename) ---
  describe('Cover Letters (Read/Delete/Rename)', () => {
    it('should retrieve all seeded cover letters', async () => {
      const letters = await getAllCoverLetters();
      expect(letters).toHaveLength(2);
      // Check content, ignore specific ID values initially
      expect(letters).toEqual(expect.arrayContaining([
        expect.objectContaining(coverLetter1),
        expect.objectContaining(coverLetter2),
      ]));
    });

     it('should retrieve specific cover letter content', async () => {
       const letters = await getAllCoverLetters();
       const cl1 = letters.find((l: StoredDocument) => l.name === coverLetter1.name);
       expect(cl1).toBeDefined();
       const content = await getCoverLetterContent(cl1!.id);
       expect(content).toBe(coverLetter1.content);

       const cl2 = letters.find((l: StoredDocument) => l.name === coverLetter2.name);
       expect(cl2).toBeDefined();
       const content2 = await getCoverLetterContent(cl2!.id);
       expect(content2).toBe(coverLetter2.content);
     });

    it('should return null content for non-existent cover letter ID', async () => {
      const content = await getCoverLetterContent(999);
      expect(content).toBeNull();
    });

    it('should delete a cover letter', async () => {
       let letters = await getAllCoverLetters();
       const cl1 = letters.find((l: StoredDocument) => l.name === coverLetter1.name);
       expect(cl1).toBeDefined();

       await deleteCoverLetter(cl1!.id); // Delete CL1 by its actual ID

       letters = await getAllCoverLetters();
       expect(letters).toHaveLength(1);
       expect(letters.find((l: StoredDocument) => l.id === cl1!.id)).toBeUndefined(); // Verify cl1 is gone
       expect(letters[0]).toEqual(expect.objectContaining(coverLetter2)); // Check remaining item
     });

     it('should handle deleting non-existent cover letter gracefully', async () => {
      await expect(deleteCoverLetter(999)).resolves.toBeUndefined();
      // Verify data wasn't affected
      const letters = await getAllCoverLetters();
       expect(letters).toHaveLength(2);
    });

    it('should rename a cover letter', async () => {
      const newName = 'RenamedCL1.txt';
      let letters = await getAllCoverLetters();
      const cl1 = letters.find((l: StoredDocument) => l.name === coverLetter1.name);
      expect(cl1).toBeDefined();

      await renameCoverLetter(cl1!.id, newName); // Rename CL1 by its actual ID

      letters = await getAllCoverLetters();
      expect(letters).toHaveLength(2);
      const renamedLetter = letters.find((l: StoredDocument) => l.id === cl1!.id);
      expect(renamedLetter).toBeDefined();
      expect(renamedLetter?.name).toBe(newName);
      expect(renamedLetter?.content).toBe(coverLetter1.content); // Content should remain
    });

    it('should reject renaming a non-existent cover letter', async () => {
       // Find a valid ID first to ensure the rejection is for the *correct* reason
       const letters = await getAllCoverLetters();
       const maxId = Math.max(...letters.map((l: StoredDocument) => l.id), 0);
       const nonExistentId = maxId + 100; // Get a guaranteed non-existent ID
       await expect(renameCoverLetter(nonExistentId, 'NewName.txt')).rejects.toMatch(/not found/i);
    });
  });

  // --- Resume Tests (Read, Delete, Rename) ---
  describe('Resumes (Read/Delete/Rename)', () => {
    it('should retrieve all seeded resumes', async () => {
       const resumes = await getAllResumes();
       expect(resumes).toHaveLength(1);
       // Check content, ignore specific ID
       expect(resumes[0]).toEqual(expect.objectContaining(resume1));
     });

     it('should retrieve specific resume content', async () => {
       const resumes = await getAllResumes();
       const r1 = resumes.find((r: StoredDocument) => r.name === resume1.name);
       expect(r1).toBeDefined();
       const content = await getResumeContent(r1!.id); // Use actual ID
       expect(content).toBe(resume1.content);
     });

    it('should delete a resume', async () => {
       let resumes = await getAllResumes();
       const r1 = resumes.find((r: StoredDocument) => r.name === resume1.name);
       expect(r1).toBeDefined();

       await deleteResume(r1!.id); // Delete Resume1 by its actual ID

       resumes = await getAllResumes();
       expect(resumes).toHaveLength(0);
     });

    it('should rename a resume', async () => {
       const newName = 'NewResume.pdf';
       let resumes = await getAllResumes();
       const r1 = resumes.find((r: StoredDocument) => r.name === resume1.name);
       expect(r1).toBeDefined();

       await renameResume(r1!.id, newName); // Rename Resume1 by its actual ID

       resumes = await getAllResumes();
       expect(resumes).toHaveLength(1);
       expect(resumes[0].name).toBe(newName);
       expect(resumes[0].content).toBe(resume1.content); // Content should remain
       expect(resumes[0].id).toBe(r1!.id); // ID should remain the same
     });
  });

  // --- Database Clearing Tests ---
  describe('Clear Database', () => {
    // Note: beforeEach seeds data *after* clear, so these tests re-clear
    it('should clear only the cover letter store', async () => {
      await clearDatabase(COVER_LETTER_STORE); // Clear only CLs

      const letters = await getAllCoverLetters();
      const resumes = await getAllResumes();
      expect(letters).toHaveLength(0);
      expect(resumes).toHaveLength(1); // Resume should remain
    });

    it('should clear only the resume store', async () => {
      await clearDatabase(RESUME_STORE); // Clear only Resumes

      const letters = await getAllCoverLetters();
      const resumes = await getAllResumes();
      expect(letters).toHaveLength(2); // CLs should remain
      expect(resumes).toHaveLength(0);
    });

    it('should clear all stores if no store name is provided', async () => {
      await clearDatabase(); // Clear all

      const letters = await getAllCoverLetters();
      const resumes = await getAllResumes();
      expect(letters).toHaveLength(0);
      expect(resumes).toHaveLength(0);
    });

     it('should handle clearing an unknown store name gracefully', async () => {
       // The function *should* reject if the store name is invalid
       await expect(clearDatabase('nonExistentStore')).rejects.toThrow(/No objectStore named/i);
       // Verify data wasn't affected
       const letters = await getAllCoverLetters();
       const resumes = await getAllResumes();
       expect(letters).toHaveLength(2);
       expect(resumes).toHaveLength(1);
     });
  });
});