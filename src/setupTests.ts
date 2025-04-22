import '@testing-library/jest-dom';
import { vi } from 'vitest';
import 'fake-indexeddb/auto'; // Automatically replaces global indexedDB

// --- Mock pdfjs-dist ---
// Mock the entire module *before* it's imported by indexedDB.ts
vi.mock('pdfjs-dist', () => {
  console.log('Mocking pdfjs-dist module');
  // Provide a minimal mock structure to satisfy the import and usage in indexedDB.ts

  const mockTextContent = {
    items: [{ str: 'Mock PDF text content line 1 ' }, { str: 'line 2' }],
  };
  const mockGetTextContent = vi.fn().mockResolvedValue(mockTextContent);

  const mockPage = {
    getTextContent: mockGetTextContent,
  };
  const mockGetPage = vi.fn().mockResolvedValue(mockPage);

  // This is the object the awaited promise MUST resolve to
  const mockPdfDocument = {
    numPages: 1, // Ensure this is present
    getPage: mockGetPage,
  };

  // This is the proxy object returned by getDocument()
  // It ONLY needs the 'promise' property for the original code path
  const mockDocumentProxy = {
    promise: Promise.resolve(mockPdfDocument),
  };

  const mockGetDocument = vi.fn().mockImplementation((options) => {
      console.log('---> MOCKED pdfjsLib.getDocument called with options:', options);
      // Return ONLY the proxy containing the promise
      return mockDocumentProxy;
  });

  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: mockGetDocument,
  };
});

// --- Mock chrome APIs ---
// Use a type assertion for globalThis to define chrome if needed
// This avoids direct 'global' usage which can be environment-specific
const globalObj = globalThis as any;

if (typeof globalObj.chrome === 'undefined') {
  globalObj.chrome = {};
}
if (typeof globalObj.chrome.runtime === 'undefined') {
  globalObj.chrome.runtime = {};
}
// No need for @ts-expect-error if we define the property directly
globalObj.chrome.runtime.getURL = vi.fn((path: string) => {
  console.log(`Mock chrome.runtime.getURL called for: ${path}`);
  // Return a dummy URL
  return `chrome-extension://mock-id/${path}`;
});

console.log('Test setup: fake-indexeddb and mocks initialized.');