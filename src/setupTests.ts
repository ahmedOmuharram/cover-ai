import '@testing-library/jest-dom';
import { vi } from 'vitest';
import 'fake-indexeddb/auto'; // Automatically replaces global indexedDB

// --- Mock pdfjs-dist ---
// Mock the entire module *before* it's imported by indexedDB.ts
vi.mock('pdfjs-dist', () => {
  console.log('Mocking pdfjs-dist module');
  // Provide a minimal mock structure to satisfy the import and usage in indexedDB.ts
  return {
    // Mock the property accessed globally in indexedDB.ts
    GlobalWorkerOptions: {
        workerSrc: '',
    },
    // We don't need a functional getDocument mock here because
    // extractTextFromPDF (which uses it) is already mocked below.
    // Add a basic placeholder just in case.
    getDocument: vi.fn().mockResolvedValue({
        promise: Promise.resolve({ numPages: 0 }),
    }),
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