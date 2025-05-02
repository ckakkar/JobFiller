/**
 * Content Script
 * Runs on job application pages to fill out forms with OpenAI integration
 */

// Global variables for our key classes
let fieldMapper = null;
let storageManager = null;
let openaiParser = null;

// Initialize when the content script is loaded
(async function initialize() {
  try {
    // Listen for messages from the popup or background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle different message types
      if (message.action === 'fillForm') {
        handleFillForm(message.resumeName).then(sendResponse);
        return true; // Required for async sendResponse
      } else if (message.action === 'smartFill') {
        handleSmartFill(message.resumeName, message.apiKey, message.model).then(sendResponse);
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
      // Get the delay setting, default to 2 seconds
      const delay = settings.jobfiller_settings?.autofillDelay || 2000;
      
      // Give the page time to fully load
      setTimeout(async () => {
        const storageManager = new ResumeStorageManager();
        const activeResumeName = await storageManager.getActiveResumeName();
        
        if (activeResumeName) {
          await handleFillForm(activeResumeName);
        }
      }, delay); 
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
  if (fieldMapper && storageManager && openaiParser) {
    return; // Already loaded
  }

  try {
    // Inject necessary scripts in order
    await injectScript('resume-storage.js');
    await injectScript('field-mapper.js');
    await injectScript('openai-parser.js');
    
    // Initialize the objects
    storageManager = new ResumeStorageManager();
    fieldMapper = new FieldMapper();
    openaiParser = new OpenAIResumeParser();
  } catch (error) {
    console.error('Error loading JobFiller dependencies:', error);
    throw error;
  }
}

/**
 * Handle standard form filling request
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
 * Handle AI-powered smart form filling
 * @param {string} resumeName - Name of the resume to use
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - OpenAI model to use
 * @returns {Promise<Object>} - Results of form filling
 */
async function handleSmartFill(resumeName, apiKey, model) {
  try {
    await loadDependencies();
    
    // Set the API key
    openaiParser.setApiKey(apiKey);
    
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
    
    // Create a description of the page and form fields
    const analyzeResult = await handleAnalyzePage();
    
    if (!analyzeResult.success || Object.keys(analyzeResult.fields).length === 0) {
      return {
        success: false,
        message: 'No form fields found on this page to fill.'
      };
    }
    
    // Prepare data for OpenAI to analyze
    const pageData = {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      fields: analyzeResult.fields
    };
    
    // Use OpenAI to suggest mappings
    const aiMappings = await generateAIMappings(pageData, resumeData, apiKey, model);
    
    if (!aiMappings || !aiMappings.mappings) {
      return {
        success: false,
        message: 'Failed to generate AI mappings for this page.'
      };
    }
    
    // Save the AI-generated mappings for future use
    await storageManager.saveFieldMappings(window.location.hostname, aiMappings.mappings);
    
    // Use the new mappings to fill the form
    fieldMapper.customMappings = aiMappings.mappings;
    const results = await fieldMapper.fillForm(resumeData);
    
    return { 
      success: results.filled > 0,
      filled: results.filled,
      skipped: results.skipped,
      failed: results.failed,
      total: results.total,
      tokenUsage: aiMappings.tokenUsage || 0
    };
  } catch (error) {
    console.error('Error with AI form filling:', error);
    return { 
      success: false, 
      message: `Error with AI form filling: ${error.message}` 
    };
  }
}

/**
 * Generate AI mappings for form fields
 * @param {Object} pageData - Information about the page and its form fields
 * @param {Object} resumeData - The user's resume data
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - OpenAI model to use
 * @returns {Promise<Object>} - Field mappings generated by AI
 */
async function generateAIMappings(pageData, resumeData, apiKey, model) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are an expert at matching resume data to form fields on job application pages. 
            Analyze the page data and resume data provided, then create mappings between form fields and resume fields.
            Only return a JSON object with mappings. The keys should be the field IDs and the values should be the paths to the data in the resume object.
            Don't map fields that don't have corresponding data in the resume. Be very precise with the mapping paths.`
          },
          {
            role: "user",
            content: `Here is the job application form data:\n${JSON.stringify(pageData, null, 2)}\n\nHere is the resume data:\n${JSON.stringify(resumeData, null, 2)}\n\nGenerate field mappings in JSON format.`
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${result.error?.message || 'Unknown error'}`);
    }
    
    // Parse the OpenAI response to extract the JSON mappings
    const content = result.choices[0].message.content;
    
    // Try to extract JSON from the content
    try {
      // First, try to parse the whole response as JSON
      const mappings = JSON.parse(content);
      return {
        mappings,
        tokenUsage: result.usage.total_tokens
      };
    } catch (e) {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        return {
          mappings: JSON.parse(jsonMatch[1]),
          tokenUsage: result.usage.total_tokens
        };
      }
      
      // If still no JSON found, try to find anything that looks like JSON
      const jsonObjectMatch = content.match(/{[\s\S]*}/);
      if (jsonObjectMatch) {
        return {
          mappings: JSON.parse(jsonObjectMatch[0]),
          tokenUsage: result.usage.total_tokens
        };
      }
      
      throw new Error('Could not parse OpenAI response as JSON');
    }
  } catch (error) {
    console.error('Error generating AI mappings:', error);
    throw error;
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