/**
 * PDF Loader
 * This script loads PDF.js dynamically to ensure it's available before being used
 */

// Function to load script asynchronously and return a promise
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Function to initialize PDF.js
async function initPdfJs() {
  try {
    console.log('Loading PDF.js...');
    
    // First load the main PDF.js library
    await loadScript(chrome.runtime.getURL('pdf.min.js'));
    
    // Check if pdfjsLib is available
    if (typeof pdfjsLib !== 'undefined') {
      // Set the worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
      
      // Store on window for access by other scripts
      window.pdfjsLib = pdfjsLib;
      
      console.log('PDF.js loaded successfully!');
      
      // Dispatch an event to notify that PDF.js is ready
      document.dispatchEvent(new CustomEvent('pdfjs-loaded'));
      
      return true;
    } else {
      console.error('PDF.js library failed to initialize properly');
      return false;
    }
  } catch (error) {
    console.error('Error loading PDF.js:', error);
    return false;
  }
}

// Initialize immediately
initPdfJs();