/**
 * PDF.js Wrapper
 * This script wraps the ES module version of PDF.js and exposes it to non-module scripts
 */

// Import PDF.js modules 
import * as pdfjs from './pdf.min.mjs';

// Expose the pdfjs library globally for non-module scripts
window.pdfjs = pdfjs;

// This ensures pdf.worker.min.mjs is properly set
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
}

// Add an event that signals when this wrapper is fully loaded
document.dispatchEvent(new Event('pdf-wrapper-loaded'));

// Set a flag that indicates PDF.js is available
window.pdfWrapperLoaded = true;

console.log('PDF.js wrapper loaded successfully!');