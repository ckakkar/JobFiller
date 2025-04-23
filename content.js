/**
 * Content Script
 * Runs on job application pages to fill out forms
 */

// Load dependencies from extension
let fieldMapper = null;
let storageManager = null;

// Initialize when the content script is loaded
(async function initialize() {
  try {
    // Listen for messages from the popup or background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle different message types
      if (message.action === 'fillForm') {
        handleFillForm(message.resumeName).then(sendResponse);
        return true; // Required for async sendResponse
      } else if (message.action === 'analyzePage') {
        handleAnalyzePage().then(sendResponse);
        return true; // Required for async sendResponse
      } else if (message.action === 'getFieldMappings') {
        handleGetFieldMappings().then(sendResponse);
        return true; // Required for async sendResponse
      } else if (message.action === 'saveFieldMappings') {
        handleSaveFieldMappings(message.mappings).then(sendResponse);
        return true; // Required for async sendResponse
      }
    });

    // Check if we should auto-fill on page load
    const settings = await chrome.storage.sync.get('jobfiller_settings');
    if (settings.jobfiller_settings?.autofillOnLoad) {
      // Give the page time to fully load
      setTimeout(async () => {
        const storageManager = new ResumeStorageManager();
        const activeResumeName = await storageManager.getActiveResumeName();
        
        if (activeResumeName) {
          await handleFillForm(activeResumeName);
        }
      }, 2000); // Wait 2 seconds before auto-filling
    }

    console.log('JobFiller content script initialized');
  } catch (error) {
    console.error('Error initializing JobFiller content script:', error);
  }
})();

/**
 * Inject a script into the page
 * @param {string} src - Path to the script
 * @returns {Promise} - Promise that resolves when the script is loaded
 */
function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(src);
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * Load required scripts from the extension
 */
async function loadDependencies() {
  if (fieldMapper && storageManager) {
    return; // Already loaded
  }

  // Inject dependencies into the page
  try {
    await injectScript('resume-storage.js');
    await injectScript('field-mapper.js');
    
    // Initialize the objects
    storageManager = new ResumeStorageManager();
    fieldMapper = new FieldMapper();
  } catch (error) {
    console.error('Error loading JobFiller dependencies:', error);
    throw error;
  }
}

/**
 * Handle form filling request
 * @param {string} resumeName - Name of the resume to use
 * @returns {Promise<Object>} - Results of form filling
 */
async function handleFillForm(resumeName) {
  try {
    await loadDependencies();
    
    // Get the resume data
    let resumeData;
    if (resumeName) {
      resumeData = await storageManager.getResume(resumeName);
    } else {
      resumeData = await storageManager.getActiveResume();
    }
    
    if (!resumeData) {
      return { 
        success: false, 
        message: 'No resume data found. Please upload a resume in the extension options.' 
      };
    }
    
    // Fill the form with resume data
    const results = await fieldMapper.fillForm(resumeData);
    
    return { 
      success: results.filled > 0,
      filled: results.filled,
      skipped: results.skipped,
      failed: results.failed,
      total: results.total
    };
  } catch (error) {
    console.error('Error filling form:', error);
    return { 
      success: false, 
      message: `Error filling form: ${error.message}` 
    };
  }
}

/**
 * Handle page analysis request
 * @returns {Promise<Object>} - Analysis results
 */
async function handleAnalyzePage() {
  try {
    await loadDependencies();
    
    // Analyze form fields on the page
    const fields = fieldMapper.analyzeFormFields();
    
    // Get the current domain
    const domain = window.location.hostname;
    
    // Get mappings for this domain
    const mappings = await fieldMapper.getMappings(domain);
    
    // Match fields to resume fields
    const matchedFields = {};
    
    for (const [fieldId, element] of Object.entries(fields)) {
      const resumeField = fieldMapper.matchFieldToResume(fieldId, mappings);
      
      matchedFields[fieldId] = {
        id: fieldId,
        type: element.tagName.toLowerCase() + (element.type ? `[${element.type}]` : ''),
        label: getElementLabel(element) || fieldId.split(':')[1],
        mapped: resumeField
      };
    }
    
    return {
      success: true,
      fields: matchedFields,
      domain: domain
    };
  } catch (error) {
    console.error('Error analyzing page:', error);
    return {
      success: false,
      message: `Error analyzing page: ${error.message}`
    };
  }
}

/**
 * Get the label text for a form element
 * @param {Element} element - Form element
 * @returns {string|null} - Label text or null
 */
function getElementLabel(element) {
  // Try to find a label with "for" attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
  }
  
  // Try to find a parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get text excluding the input element's text
    const clone = parentLabel.cloneNode(true);
    const inputs = clone.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.remove());
    return clone.textContent.trim();
  }
  
  // Try to use placeholder or aria-label
  return element.placeholder || element.getAttribute('aria-label') || null;
}

/**
 * Handle getting field mappings
 * @returns {Promise<Object>} - Field mappings
 */
async function handleGetFieldMappings() {
  try {
    await loadDependencies();
    
    const domain = window.location.hostname;
    const mappings = await storageManager.getFieldMappings(domain);
    
    return {
      success: true,
      mappings: mappings || {},
      domain: domain
    };
  } catch (error) {
    console.error('Error getting field mappings:', error);
    return {
      success: false,
      message: `Error getting field mappings: ${error.message}`
    };
  }
}

/**
 * Handle saving field mappings
 * @param {Object} mappings - Field mappings to save
 * @returns {Promise<Object>} - Result of operation
 */
async function handleSaveFieldMappings(mappings) {
  try {
    await loadDependencies();
    
    const domain = window.location.hostname;
    const success = await storageManager.saveFieldMappings(domain, mappings);
    
    return {
      success: success,
      domain: domain
    };
  } catch (error) {
    console.error('Error saving field mappings:', error);
    return {
      success: false,
      message: `Error saving field mappings: ${error.message}`
    };
  }
}
