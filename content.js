/**
 * Content Script - JobFiller Pro
 * Improved version with robust error handling and form detection
 */

// Global variables
let fieldMapper = null;
let storageManager = null;
let openaiParser = null;
let isInitialized = false;

// Initialize when content script is loaded
(function() {
  console.log('JobFiller Pro: Content script loaded');
  
  // Set up message listener immediately to catch any messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('JobFiller Pro: Message received', message.action);
    
    // Handle the message even if initialization isn't complete
    handleMessage(message, sender, sendResponse);
    return true; // Keep the message channel open for async response
  });
  
  // Initialize the extension
  initializeExtension().then(() => {
    console.log('JobFiller Pro: Initialization complete');
  }).catch(error => {
    console.error('JobFiller Pro: Initialization failed', error);
  });
})();

/**
 * Initialize the extension components
 */
async function initializeExtension() {
  try {
    // Inject necessary scripts
    await injectScripts();
    
    // Create instances of required classes
    if (typeof ResumeStorageManager !== 'undefined') {
      storageManager = new ResumeStorageManager();
    } else {
      console.warn('JobFiller Pro: ResumeStorageManager not found, using fallback');
      storageManager = createFallbackStorageManager();
    }
    
    if (typeof FieldMapper !== 'undefined') {
      fieldMapper = new FieldMapper();
    } else {
      console.warn('JobFiller Pro: FieldMapper not found, using fallback');
      fieldMapper = createFallbackFieldMapper();
    }
    
    if (typeof OpenAIResumeParser !== 'undefined') {
      openaiParser = new OpenAIResumeParser();
    } else {
      console.warn('JobFiller Pro: OpenAIResumeParser not found, using fallback');
      openaiParser = createFallbackParser();
    }
    
    // Check if we should auto-fill on page load
    const settings = await chrome.storage.sync.get('jobfiller_settings');
    if (settings.jobfiller_settings?.autofillOnLoad) {
      // Get the delay setting, default to 2 seconds
      const delay = settings.jobfiller_settings?.autofillDelay || 2000;
      
      // Give the page time to fully load
      setTimeout(async () => {
        const activeResumeName = await storageManager.getActiveResumeName();
        
        if (activeResumeName) {
          await handleFillForm(activeResumeName);
        }
      }, delay);
    }
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('JobFiller Pro: Error initializing', error);
    isInitialized = false;
    throw error;
  }
}

/**
 * Handle messages from popup or background script
 */
function handleMessage(message, sender, sendResponse) {
  // Always respond to ping messages immediately
  if (message.action === 'ping') {
    sendResponse({ success: true, status: 'alive' });
    return;
  }
  
  // For other actions, ensure initialization or initialize on demand
  const responsePromise = (async () => {
    try {
      // Try to initialize if not already done
      if (!isInitialized) {
        await initializeExtension();
      }
      
      // Process the message based on action
      switch (message.action) {
        case 'fillForm':
          return await handleFillForm(message.resumeName);
        
        case 'smartFill':
          return await handleSmartFill(message.resumeName, message.apiKey, message.model);
        
        case 'analyzePage':
          return await handleAnalyzePage();
        
        case 'getFieldMappings':
          return await handleGetFieldMappings();
        
        case 'saveFieldMappings':
          return await handleSaveFieldMappings(message.mappings);
        
        default:
          return { 
            success: false, 
            message: `Unknown action: ${message.action}` 
          };
      }
    } catch (error) {
      console.error(`JobFiller Pro: Error handling message ${message.action}`, error);
      return {
        success: false,
        message: `Error processing ${message.action}: ${error.message}`
      };
    }
  })();
  
  // Handle the promise and send response
  responsePromise.then(response => {
    console.log(`JobFiller Pro: Sending response for ${message.action}`, response);
    sendResponse(response);
  }).catch(error => {
    console.error(`JobFiller Pro: Error in responsePromise for ${message.action}`, error);
    sendResponse({
      success: false,
      message: `Unexpected error: ${error.message}`
    });
  });
}

/**
 * Inject necessary scripts into the page
 */
async function injectScripts() {
  try {
    // Add scripts to the page
    const scripts = ['resume-storage.js', 'field-mapper.js', 'openai-parser.js'];
    
    for (const script of scripts) {
      try {
        await injectScript(script);
        console.log(`JobFiller Pro: Successfully injected ${script}`);
      } catch (error) {
        console.error(`JobFiller Pro: Failed to inject ${script}`, error);
        // Continue with other scripts even if one fails
      }
    }
  } catch (error) {
    console.error('JobFiller Pro: Error injecting scripts', error);
    throw error;
  }
}

/**
 * Inject a single script
 */
function injectScript(src) {
  return new Promise((resolve, reject) => {
    // First check if the script is already in the DOM
    if (document.querySelector(`script[src*="${src}"]`)) {
      resolve();
      return;
    }
    
    try {
      const scriptUrl = chrome.runtime.getURL(src);
      const script = document.createElement('script');
      script.src = scriptUrl;
      
      script.onload = () => {
        resolve();
      };
      
      script.onerror = (error) => {
        reject(new Error(`Failed to load script: ${src} - ${error.message}`));
      };
      
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Handle form filling request
 */
async function handleFillForm(resumeName) {
  console.log('JobFiller Pro: Filling form with resume', resumeName);
  
  try {
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
    
    // Analyze the page to detect fields
    const fields = await analyzePageFields();
    
    if (Object.keys(fields).length === 0) {
      return {
        success: false,
        message: 'No form fields detected on this page.'
      };
    }
    
    // Get domain mappings
    const domain = window.location.hostname;
    const mappings = await fieldMapper.getMappings(domain);
    
    // Fill the form with resume data
    let filledCount = 0;
    let failedCount = 0;
    
    for (const [fieldId, element] of Object.entries(fields)) {
      try {
        const resumeField = fieldMapper.matchFieldToResume(fieldId, mappings);
        
        if (resumeField) {
          let value = getValueFromResume(resumeData, resumeField);
          
          // Handle special cases
          if (resumeField === 'personal.name' && fieldId.toLowerCase().includes('first')) {
            value = splitName(value).firstName;
          } else if (resumeField === 'personal.name' && fieldId.toLowerCase().includes('last')) {
            value = splitName(value).lastName;
          }
          
          const success = setFieldValue(element, value);
          if (success) {
            filledCount++;
          } else {
            failedCount++;
          }
        }
      } catch (fieldError) {
        console.error(`JobFiller Pro: Error filling field ${fieldId}`, fieldError);
        failedCount++;
      }
    }
    
    return { 
      success: filledCount > 0,
      filled: filledCount,
      failed: failedCount,
      total: Object.keys(fields).length
    };
  } catch (error) {
    console.error('JobFiller Pro: Error filling form', error);
    return { 
      success: false, 
      message: `Error filling form: ${error.message}` 
    };
  }
}

/**
 * Analyze the page to find form fields
 */
async function analyzePageFields() {
  const fields = {};
  
  // Find all form elements
  const formElements = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea');
  
  for (const element of formElements) {
    // Skip invisible elements
    if (!isVisibleElement(element) || element.disabled) {
      continue;
    }
    
    const fieldId = getFieldIdentifier(element);
    if (fieldId) {
      fields[fieldId] = element;
    }
  }
  
  return fields;
}

/**
 * Check if an element is visible
 */
function isVisibleElement(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 &&
         element.offsetHeight > 0;
}

/**
 * Get a unique identifier for a form field
 */
function getFieldIdentifier(element) {
  // Try to use ID, name, or other attributes
  if (element.id) {
    return `id:${element.id}`;
  }
  
  if (element.name) {
    return `name:${element.name}`;
  }
  
  // Try to use label text
  const labelForElement = element.id ? document.querySelector(`label[for="${element.id}"]`) : null;
  if (labelForElement && labelForElement.textContent.trim()) {
    return `label:${labelForElement.textContent.trim()}`;
  }
  
  // Try to use placeholder
  if (element.placeholder) {
    return `placeholder:${element.placeholder}`;
  }
  
  // Try to use aria-label
  if (element.getAttribute('aria-label')) {
    return `aria:${element.getAttribute('aria-label')}`;
  }
  
  // Try to find a parent label
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent.trim()) {
    return `parent:${parentLabel.textContent.trim().substring(0, 50)}`;
  }
  
  // Use position as last resort
  const allInputs = Array.from(document.querySelectorAll('input, select, textarea'));
  const index = allInputs.indexOf(element);
  if (index !== -1) {
    return `position:${index}`;
  }
  
  return null;
}

/**
 * Get value from resume data using a path
 */
function getValueFromResume(resume, path) {
  try {
    // Handle array notation like "experience[0].title"
    const parts = path.split('.');
    
    // Navigate through the object
    let current = resume;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Handle array notation
      if (part.includes('[') && part.includes(']')) {
        const arrayName = part.substring(0, part.indexOf('['));
        const index = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
        
        if (!current[arrayName] || !Array.isArray(current[arrayName]) || index >= current[arrayName].length) {
          return '';
        }
        
        current = current[arrayName][index];
      } else {
        if (current[part] === undefined) {
          return '';
        }
        
        current = current[part];
      }
    }
    
    // Handle specific cases
    if (Array.isArray(current)) {
      return current.join(', ');
    }
    
    return current || '';
  } catch (error) {
    console.error(`JobFiller Pro: Error getting value from resume at path ${path}`, error);
    return '';
  }
}

/**
 * Split a full name into first and last name
 */
function splitName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const parts = fullName.trim().split(' ');
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

/**
 * Set value on a form element
 */
function setFieldValue(element, value) {
  if (!element || value === undefined) return false;
  
  try {
    // Different handling based on element type
    if (element.tagName.toLowerCase() === 'select') {
      // For select elements, find the matching option
      return setSelectValue(element, value);
    } else if (element.type === 'checkbox') {
      // For checkboxes, check if the value is truthy
      element.checked = Boolean(value);
      triggerChangeEvent(element);
      return true;
    } else if (element.type === 'radio') {
      // For radio buttons, find the matching value in the group
      return setRadioValue(element, value);
    } else {
      // For text inputs and textareas
      element.value = value;
      triggerChangeEvent(element);
      return true;
    }
  } catch (error) {
    console.error('JobFiller Pro: Error setting field value', error);
    return false;
  }
}

/**
 * Set value on a select element
 */
function setSelectValue(selectElement, value) {
  // Convert value to string
  const stringValue = String(value).toLowerCase();
  
  // Try to find an exact match first
  for (const option of selectElement.options) {
    if (option.value.toLowerCase() === stringValue || 
        option.text.toLowerCase() === stringValue) {
      selectElement.value = option.value;
      triggerChangeEvent(selectElement);
      return true;
    }
  }
  
  // If no exact match, try partial match
  for (const option of selectElement.options) {
    if (option.value.toLowerCase().includes(stringValue) || 
        option.text.toLowerCase().includes(stringValue)) {
      selectElement.value = option.value;
      triggerChangeEvent(selectElement);
      return true;
    }
  }
  
  return false;
}

/**
 * Set value on a radio button group
 */
function setRadioValue(radioElement, value) {
  // Get all radio buttons in the same group
  const name = radioElement.name;
  const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  
  // Convert value to string
  const stringValue = String(value).toLowerCase();
  
  // Try to find a matching radio button
  for (const radio of radioGroup) {
    if (radio.value.toLowerCase() === stringValue || 
        (radio.labels && radio.labels[0] && 
         radio.labels[0].textContent.toLowerCase().includes(stringValue))) {
      radio.checked = true;
      triggerChangeEvent(radio);
      return true;
    }
  }
  
  return false;
}

/**
 * Trigger change events on an element
 */
function triggerChangeEvent(element) {
  try {
    // Create and dispatch events
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
  } catch (error) {
    console.error('JobFiller Pro: Error triggering event', error);
  }
}

/**
 * Handle page analysis request
 */
async function handleAnalyzePage() {
  try {
    // Analyze form fields on the page
    const fields = await analyzePageFields();
    
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
        label: getElementLabel(element) || fieldId.split(':')[1] || 'Unknown Field',
        mapped: resumeField
      };
    }
    
    return {
      success: true,
      fields: matchedFields,
      domain: domain
    };
  } catch (error) {
    console.error('JobFiller Pro: Error analyzing page', error);
    return {
      success: false,
      message: `Error analyzing page: ${error.message}`
    };
  }
}

/**
 * Get the label text for a form element
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
  
  // Try to use nearby text as a label
  const parent = element.parentElement;
  if (parent) {
    // Look for text nodes or spans/divs with field-like names
    const siblings = Array.from(parent.childNodes);
    for (const sibling of siblings) {
      if (sibling !== element) {
        if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) {
          return sibling.textContent.trim();
        } else if (sibling.nodeType === Node.ELEMENT_NODE && 
                  ['span', 'div', 'label', 'p'].includes(sibling.tagName.toLowerCase())) {
          const text = sibling.textContent.trim();
          if (text && text.length < 50) {
            return text;
          }
        }
      }
    }
  }
  
  // Try to use placeholder or aria-label
  return element.placeholder || element.getAttribute('aria-label') || null;
}

/**
 * Handle AI-powered smart form filling
 */
async function handleSmartFill(resumeName, apiKey, model) {
  try {
    // Set the API key
    if (openaiParser) {
      openaiParser.setApiKey(apiKey);
    }
    
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
    
    // Analyze the page
    const analyzeResult = await handleAnalyzePage();
    
    if (!analyzeResult.success || Object.keys(analyzeResult.fields).length === 0) {
      return {
        success: false,
        message: 'No form fields found on this page to fill.'
      };
    }
    
    // Generate AI mappings for form fields
    try {
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        fields: analyzeResult.fields
      };
      
      // Use OpenAI to suggest mappings
      const aiResult = await window.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          messages: [
            {
              role: "system",
              content: "Generate field mappings between resume data and job application form fields. Return only a valid JSON object with form field IDs as keys and resume field paths as values."
            },
            {
              role: "user",
              content: `Form fields: ${JSON.stringify(analyzeResult.fields)}\n\nResume data structure: ${JSON.stringify(resumeData)}`
            }
          ],
          temperature: 0.1
        })
      });
      
      const aiResponse = await aiResult.json();
      
      if (!aiResult.ok) {
        throw new Error(`OpenAI API Error: ${aiResponse.error?.message || 'Unknown error'}`);
      }
      
      // Parse the mapping suggestions
      const aiContent = aiResponse.choices[0].message.content;
      let aiMappings = {};
      
      try {
        // Try to parse as JSON directly
        aiMappings = JSON.parse(aiContent);
      } catch (jsonError) {
        // Extract JSON object if embedded in text
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            aiMappings = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('JobFiller Pro: Could not parse AI response as JSON', e);
          }
        }
      }
      
      // Save the mappings for future use
      await storageManager.saveFieldMappings(window.location.hostname, aiMappings);
      
      // Fill the form using the AI mappings
      let filledCount = 0;
      let failedCount = 0;
      
      for (const [fieldId, resumePath] of Object.entries(aiMappings)) {
        try {
          const element = document.querySelector(`#${fieldId}`) || 
                         document.querySelector(`[name="${fieldId}"]`) ||
                         document.querySelector(`[id="${fieldId.split(':')[1]}"]`) ||
                         document.querySelector(`[name="${fieldId.split(':')[1]}"]`);
          
          if (element) {
            const value = getValueFromResume(resumeData, resumePath);
            const success = setFieldValue(element, value);
            
            if (success) {
              filledCount++;
            } else {
              failedCount++;
            }
          }
        } catch (fieldError) {
          console.error(`JobFiller Pro: Error filling field ${fieldId}`, fieldError);
          failedCount++;
        }
      }
      
      return {
        success: filledCount > 0,
        filled: filledCount,
        failed: failedCount,
        total: Object.keys(analyzeResult.fields).length,
        tokenUsage: aiResponse.usage?.total_tokens || 0
      };
    } catch (aiError) {
      console.error('JobFiller Pro: Error with AI form filling', aiError);
      
      // Fall back to regular form filling
      const regularResult = await handleFillForm(resumeName);
      return {
        ...regularResult,
        message: `AI form filling failed: ${aiError.message}. Used regular filling instead.`
      };
    }
  } catch (error) {
    console.error('JobFiller Pro: Error with smart fill', error);
    return { 
      success: false, 
      message: `Error with AI form filling: ${error.message}` 
    };
  }
}

/**
 * Handle getting field mappings
 */
async function handleGetFieldMappings() {
  try {
    const domain = window.location.hostname;
    const mappings = await storageManager.getFieldMappings(domain);
    
    return {
      success: true,
      mappings: mappings || {},
      domain: domain
    };
  } catch (error) {
    console.error('JobFiller Pro: Error getting field mappings', error);
    return {
      success: false,
      message: `Error getting field mappings: ${error.message}`
    };
  }
}

/**
 * Handle saving field mappings
 */
async function handleSaveFieldMappings(mappings) {
  try {
    const domain = window.location.hostname;
    const success = await storageManager.saveFieldMappings(domain, mappings);
    
    return {
      success: success,
      domain: domain
    };
  } catch (error) {
    console.error('JobFiller Pro: Error saving field mappings', error);
    return {
      success: false,
      message: `Error saving field mappings: ${error.message}`
    };
  }
}

/**
 * Create a fallback storage manager if the real one fails to load
 */
function createFallbackStorageManager() {
  return {
    async getResume(name) {
      try {
        const result = await chrome.storage.sync.get('jobfiller_resumes');
        const resumes = result.jobfiller_resumes || {};
        return resumes[name]?.data || null;
      } catch (error) {
        console.error(`Error retrieving resume "${name}":`, error);
        return null;
      }
    },
    
    async getActiveResume() {
      try {
        const activeNameResult = await chrome.storage.sync.get('jobfiller_active_resume');
        const activeName = activeNameResult.jobfiller_active_resume;
        
        if (!activeName) return null;
        
        return this.getResume(activeName);
      } catch (error) {
        console.error('Error getting active resume:', error);
        return null;
      }
    },
    
    async getActiveResumeName() {
      try {
        const result = await chrome.storage.sync.get('jobfiller_active_resume');
        return result.jobfiller_active_resume || null;
      } catch (error) {
        console.error('Error getting active resume name:', error);
        return null;
      }
    },
    
    async getFieldMappings(domain) {
      try {
        const result = await chrome.storage.sync.get('jobfiller_field_mappings');
        const mappings = result.jobfiller_field_mappings || {};
        return mappings[domain] || null;
      } catch (error) {
        console.error(`Error retrieving field mappings for "${domain}":`, error);
        return null;
      }
    },
    
    async saveFieldMappings(domain, mappings) {
      try {
        const result = await chrome.storage.sync.get('jobfiller_field_mappings');
        const allMappings = result.jobfiller_field_mappings || {};
        
        allMappings[domain] = mappings;
        
        await chrome.storage.sync.set({ 'jobfiller_field_mappings': allMappings });
        return true;
      } catch (error) {
        console.error(`Error saving field mappings for "${domain}":`, error);
        return false;
      }
    }
  };
}

/**
 * Create a fallback field mapper if the real one fails to load
 */
function createFallbackFieldMapper() {
  // Default mappings that work on most sites
  const defaultMappings = {
    'personal.name': ['name', 'fullname', 'full-name', 'full_name'],
    'personal.firstName': ['first-name', 'firstname', 'first_name', 'fname', 'first'],
    'personal.lastName': ['last-name', 'lastname', 'last_name', 'lname', 'last', 'surname'],
    'personal.email': ['email', 'email-address', 'emailaddress', 'email_address'],
    'personal.phone': ['phone', 'phonenumber', 'phone-number', 'phone_number', 'mobile', 'cell'],
    'personal.address': ['address', 'street-address', 'streetaddress', 'street_address'],
    'personal.city': ['city', 'locality'],
    'personal.state': ['state', 'province', 'region'],
    'personal.zip': ['zip', 'zipcode', 'zip-code', 'postal', 'postal-code', 'postalcode'],
    'personal.country': ['country', 'nation'],
    'personal.linkedin': ['linkedin', 'linkedin-url', 'linkedin_url', 'socialLinkedin'],
    'personal.website': ['website', 'personal-website', 'personal_website', 'portfolio'],
    'summary': ['summary', 'professional-summary', 'professional_summary', 'about', 'about-me', 'about_me'],
    'education[0].school': ['education', 'school', 'university', 'college', 'institution'],
    'education[0].degree': ['degree', 'degree-type', 'degree_type'],
    'education[0].field': ['field', 'major', 'field-of-study', 'field_of_study'],
    'education[0].graduationDate': ['graduation-date', 'graduation_date', 'grad-date', 'grad_date'],
    'education[0].gpa': ['gpa', 'grade-point-average', 'grade_point_average'],
    'experience[0].company': ['company', 'employer', 'organization'],
    'experience[0].title': ['job-title', 'job_title', 'title', 'position'],
    'experience[0].startDate': ['start-date', 'start_date', 'employment-start-date', 'employment_start_date'],
    'experience[0].endDate': ['end-date', 'end_date', 'employment-end-date', 'employment_end_date'],
    'experience[0].description': ['job-description', 'job_description', 'description', 'responsibilities'],
    'skills': ['skills', 'skill-list', 'skill_list', 'key-skills', 'key_skills']
  };
  
  return {
    async getMappings(domain) {
      try {
        // Try to get site-specific mappings
        const storageManager = createFallbackStorageManager();
        const customMappings = await storageManager.getFieldMappings(domain);
        
        // Combine with default mappings (custom mappings take precedence)
        return { ...defaultMappings, ...(customMappings || {}) };
      } catch (error) {
        console.error('Error getting mappings:', error);
        return defaultMappings;
      }
    },
    
    matchFieldToResume(fieldId, mappings) {
      // Extract the actual field identifier without the prefix
      const [prefix, ...rest] = fieldId.split(':');
      const identifier = rest.join(':').toLowerCase();
      
      // Try to match with each mapping
      for (const [resumeField, possibleMatches] of Object.entries(mappings)) {
        if (possibleMatches.some(match => {
          if (typeof match === 'string') {
            return identifier.includes(match.toLowerCase());
          } else if (match instanceof RegExp) {
            return match.test(identifier);
          }
          return false;
        })) {
          return resumeField;
        }
      }
      
      // Try more general matching for common fields
      if (/first.*name|fname|first$/i.test(identifier)) {
        return 'personal.firstName';
      }
      
      if (/last.*name|lname|surname|last$/i.test(identifier)) {
        return 'personal.lastName';
      }
      
      if (/city/i.test(identifier)) {
        return 'personal.city';
      }
      
      if (/state|province/i.test(identifier)) {
        return 'personal.state';
      }
      
      if (/zip|postal/i.test(identifier)) {
        return 'personal.zip';
      }
      
      // No match found
      return null;
    }
  };
}

/**
 * Create a fallback parser if the real one fails to load
 */
function createFallbackParser() {
  return {
    setApiKey(apiKey) {
      this.apiKey = apiKey;
    }
  };
}