/**
 * Settings JavaScript
 * Handles all settings functionality including OpenAI API configuration
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize storage manager
  const storageManager = new ResumeStorageManager();
  
  // Get UI elements - Tabs
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Get UI elements - API Settings
  const openaiApiKeyInput = document.getElementById('openaiApiKey');
  const openaiModelSelect = document.getElementById('openaiModel');
  const useOpenAIForFieldMappingCheckbox = document.getElementById('useOpenAIForFieldMapping');
  const testApiConnectionBtn = document.getElementById('testApiConnectionBtn');
  const saveApiSettingsBtn = document.getElementById('saveApiSettingsBtn');
  const toggleApiKeyVisibilityBtn = document.getElementById('toggleApiKeyVisibility');
  const apiStatusContainer = document.getElementById('apiStatusContainer');
  const apiSettingsStatus = document.getElementById('apiSettingsStatus');
  const estimatedTokenUsage = document.getElementById('estimatedTokenUsage');
  
  // Get UI elements - General Settings
  const defaultResumeSelect = document.getElementById('defaultResumeSelect');
  const autofillOnLoadCheckbox = document.getElementById('autofillOnLoadCheckbox');
  const darkModeCheckbox = document.getElementById('darkModeCheckbox');
  const autofillDelaySelect = document.getElementById('autofillDelaySelect');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  
  // Resume upload elements
  const resumeNameInput = document.getElementById('resumeName');
  const resumeFileInput = document.getElementById('resumeFile');
  const dropArea = document.getElementById('dropArea');
  const uploadResumeBtn = document.getElementById('uploadResumeBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  
  // Initialize OpenAI parser
  const parser = new OpenAIResumeParser();
  
  // Set up tab switching with animation
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => {
        tc.classList.remove('active');
        tc.style.display = 'none';
      });
      
      // Activate the clicked tab
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(`${tabId}-content`);
      if (targetContent) {
        targetContent.style.display = 'block';
        
        // Trigger animation by forcing a reflow and then adding the active class
        void targetContent.offsetWidth;
        targetContent.classList.add('active');
      } else {
        console.error(`Tab content not found: ${tabId}-content`);
      }
    });
  });
  
  // Load API settings
  await loadApiSettings();
  
  // Load general settings
  await loadSettings();
  
  // Load resume list for default selection
  await loadResumeList();
  
  // Apply dark mode if enabled
  applyTheme();
  
  // Set up drag and drop for resume upload
  if (dropArea) {
    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.classList.add('drag-over');
    });
    
    dropArea.addEventListener('dragleave', () => {
      dropArea.classList.remove('drag-over');
    });
    
    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        resumeFileInput.files = files;
        handleFileSelected();
      }
    });
    
    // Set up file selection event
    if (resumeFileInput) {
      resumeFileInput.addEventListener('change', handleFileSelected);
    }
    
    // Set up upload button
    if (uploadResumeBtn) {
      uploadResumeBtn.addEventListener('click', handleUploadResume);
    }
  }
  
  // Set up event listeners - API Settings
  if (testApiConnectionBtn) {
    testApiConnectionBtn.addEventListener('click', testApiConnection);
  }
  
  if (saveApiSettingsBtn) {
    saveApiSettingsBtn.addEventListener('click', saveApiSettings);
  }
  
  if (toggleApiKeyVisibilityBtn) {
    toggleApiKeyVisibilityBtn.addEventListener('click', toggleApiKeyVisibility);
  }
  
  // Set up event listeners - General Settings
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  if (darkModeCheckbox) {
    darkModeCheckbox.addEventListener('change', applyTheme);
  }
  
  /**
   * Load API settings from storage
   */
  async function loadApiSettings() {
    try {
      const apiSettings = await chrome.storage.sync.get('jobfiller_api_settings');
      
      if (apiSettings.jobfiller_api_settings) {
        // Set API key if available
        if (apiSettings.jobfiller_api_settings.apiKey && openaiApiKeyInput) {
          openaiApiKeyInput.value = apiSettings.jobfiller_api_settings.apiKey;
        }
        
        // Set model selection
        if (apiSettings.jobfiller_api_settings.model && openaiModelSelect) {
          openaiModelSelect.value = apiSettings.jobfiller_api_settings.model;
        }
        
        // Set use AI for field mapping checkbox
        if (useOpenAIForFieldMappingCheckbox) {
          useOpenAIForFieldMappingCheckbox.checked = 
            apiSettings.jobfiller_api_settings.useForFieldMapping || false;
        }
        
        // Show token usage if available
        if (apiSettings.jobfiller_api_settings.tokenUsage && estimatedTokenUsage) {
          estimatedTokenUsage.textContent = `~${apiSettings.jobfiller_api_settings.tokenUsage.toLocaleString()} tokens`;
          
          // Update progress bar width based on usage
          const usageMeterFill = document.querySelector('.usage-meter-fill');
          if (usageMeterFill) {
            const percentage = Math.min(
              (apiSettings.jobfiller_api_settings.tokenUsage / 100000) * 100,
              100
            );
            usageMeterFill.style.width = `${percentage}%`;
          }
        }
        
        // Update API status indicator if we have a key
        if (apiSettings.jobfiller_api_settings.apiKey) {
          updateApiStatusIndicator(apiSettings.jobfiller_api_settings.apiStatus || 'unknown');
        }
      }
    } catch (error) {
      console.error('Error loading API settings:', error);
      if (apiSettingsStatus) {
        showStatus(apiSettingsStatus, 'Error loading API settings', 'error');
      }
    }
  }
  
  /**
   * Save API settings to storage
   */
  async function saveApiSettings() {
    try {
      if (!openaiApiKeyInput) {
        console.error('API Key input not found');
        return;
      }
      
      const apiKey = openaiApiKeyInput.value.trim();
      const model = openaiModelSelect ? openaiModelSelect.value : 'gpt-4';
      const useForFieldMapping = useOpenAIForFieldMappingCheckbox ? useOpenAIForFieldMappingCheckbox.checked : false;
      
      if (!apiKey) {
        showStatus(apiSettingsStatus, 'Please enter an OpenAI API key', 'warning');
        return;
      }
      
      // Show saving status
      showStatus(apiSettingsStatus, 'Saving API settings...', 'info');
      
      // Test connection before saving
      const connectionStatus = await testConnection(apiKey, model);
      
      // Save settings
      await chrome.storage.sync.set({
        jobfiller_api_settings: {
          apiKey: apiKey,
          model: model,
          useForFieldMapping: useForFieldMapping,
          tokenUsage: 0, // Reset token usage counter when saving new settings
          apiStatus: connectionStatus,
          lastUpdated: new Date().toISOString()
        }
      });
      
      // Update parser with the new API key
      if (parser) {
        parser.setApiKey(apiKey);
      }
      
      showStatus(apiSettingsStatus, 'API settings saved successfully!', 'success');
      updateApiStatusIndicator(connectionStatus);
    } catch (error) {
      console.error('Error saving API settings:', error);
      showStatus(apiSettingsStatus, 'Error saving API settings: ' + error.message, 'error');
    }
  }
  
  /**
   * Test API connection
   */
  async function testApiConnection() {
    try {
      if (!openaiApiKeyInput) {
        console.error('API Key input not found');
        return;
      }
      
      const apiKey = openaiApiKeyInput.value.trim();
      
      if (!apiKey) {
        showStatus(apiSettingsStatus, 'Please enter an OpenAI API key', 'warning');
        return;
      }
      
      showStatus(apiSettingsStatus, 'Testing OpenAI API connection...', 'info');
      
      const model = openaiModelSelect ? openaiModelSelect.value : 'gpt-4';
      const status = await testConnection(apiKey, model);
      
      updateApiStatusIndicator(status);
      
      if (status === 'connected') {
        showStatus(apiSettingsStatus, 'OpenAI API connection successful!', 'success');
      } else {
        showStatus(apiSettingsStatus, 'OpenAI API connection failed. Please check your API key.', 'error');
      }
    } catch (error) {
      console.error('Error testing API connection:', error);
      showStatus(apiSettingsStatus, 'Error testing connection: ' + error.message, 'error');
      updateApiStatusIndicator('error');
    }
  }
  
  /**
   * Test connection to OpenAI API
   * @param {string} apiKey - OpenAI API key to test
   * @param {string} model - OpenAI model to test
   * @returns {Promise<string>} - Connection status ('connected', 'invalid', 'error')
   */
  async function testConnection(apiKey, model) {
    try {
      console.log('Testing connection with key:', apiKey.substring(0, 3) + '...');
      
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
              content: "You are a helpful assistant."
            },
            {
              role: "user",
              content: "Test connection. Respond with 'connected'."
            }
          ],
          max_tokens: 10
        })
      });
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (response.ok && data.choices && data.choices[0].message.content.includes('connected')) {
        return 'connected';
      } else if (data.error && data.error.type === 'invalid_request_error') {
        return 'invalid';
      } else {
        return 'error';
      }
    } catch (error) {
      console.error('API connection test error:', error);
      return 'error';
    }
  }
  
  /**
   * Update the API status indicator
   * @param {string} status - 'connected', 'invalid', 'error', or 'unknown'
   */
  function updateApiStatusIndicator(status) {
    if (!apiStatusContainer) {
      console.error('API status container not found');
      return;
    }
    
    const container = apiStatusContainer;
    const icon = container.querySelector('.api-status-icon svg');
    const title = container.querySelector('.api-status-title');
    const detail = container.querySelector('.api-status-detail');
    
    if (!icon || !title || !detail) {
      console.error('API status elements not found');
      return;
    }
    
    container.classList.remove('hidden');
    
    switch (status) {
      case 'connected':
        container.className = 'api-status mt-4 api-status-success';
        icon.innerHTML = `
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        `;
        title.textContent = 'API Connected';
        detail.textContent = 'Your OpenAI API key is valid and working properly.';
        break;
        
      case 'invalid':
        container.className = 'api-status mt-4 api-status-warning';
        icon.innerHTML = `
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        `;
        title.textContent = 'Invalid API Key';
        detail.textContent = 'Your API key was not accepted by OpenAI. Please check and update it.';
        break;
        
      case 'error':
        container.className = 'api-status mt-4 api-status-error';
        icon.innerHTML = `
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        `;
        title.textContent = 'API Connection Error';
        detail.textContent = 'Could not connect to OpenAI. Please try again later.';
        break;
        
      case 'unknown':
      default:
        container.className = 'api-status mt-4 api-status-neutral';
        icon.innerHTML = `
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        `;
        title.textContent = 'API Status Unknown';
        detail.textContent = 'Test your connection to verify API access.';
        break;
    }
  }
  
  /**
   * Toggle API key visibility
   */
  function toggleApiKeyVisibility() {
    if (!openaiApiKeyInput || !toggleApiKeyVisibilityBtn) {
      console.error('API key input or toggle button not found');
      return;
    }
    
    const input = openaiApiKeyInput;
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    
    // Update the icon
    const icon = toggleApiKeyVisibilityBtn.querySelector('svg');
    if (icon) {
      if (type === 'password') {
        icon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        `;
      } else {
        icon.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
      }
    }
  }
  
  /**
   * Load general settings from storage
   */
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get('jobfiller_settings');
      
      if (settings.jobfiller_settings) {
        // Autofill on load
        if (autofillOnLoadCheckbox) {
          autofillOnLoadCheckbox.checked = settings.jobfiller_settings.autofillOnLoad || false;
        }
        
        // Dark mode
        if (darkModeCheckbox) {
          darkModeCheckbox.checked = settings.jobfiller_settings.darkMode || false;
        }
        
        // Autofill delay
        if (autofillDelaySelect && settings.jobfiller_settings.autofillDelay !== undefined) {
          autofillDelaySelect.value = settings.jobfiller_settings.autofillDelay;
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      if (settingsStatus) {
        showStatus(settingsStatus, 'Error loading settings', 'error');
      }
    }
  }
  
  /**
   * Save general settings to storage
   */
  async function saveSettings() {
    try {
      const autofillOnLoad = autofillOnLoadCheckbox ? autofillOnLoadCheckbox.checked : false;
      const darkMode = darkModeCheckbox ? darkModeCheckbox.checked : false;
      const autofillDelay = autofillDelaySelect ? parseInt(autofillDelaySelect.value) : 2000;
      const defaultResume = defaultResumeSelect ? defaultResumeSelect.value : '';
      
      // Show saving status
      showStatus(settingsStatus, 'Saving settings...', 'info');
      
      // Save active resume if changed
      if (defaultResume) {
        await storageManager.setActiveResume(defaultResume);
      }
      
      // Save settings
      await chrome.storage.sync.set({
        jobfiller_settings: {
          autofillOnLoad,
          darkMode,
          autofillDelay,
          lastUpdated: new Date().toISOString()
        }
      });
      
      showStatus(settingsStatus, 'Settings saved successfully!', 'success');
      applyTheme();
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus(settingsStatus, 'Error saving settings: ' + error.message, 'error');
    }
  }
  
  /**
   * Handle file selection for resume upload
   */
  function handleFileSelected() {
    if (!resumeFileInput || !resumeNameInput) {
      console.error('Resume input elements not found');
      return;
    }
    
    const file = resumeFileInput.files[0];
    if (!file) return;
    
    // Auto-fill name field if empty
    if (!resumeNameInput.value) {
      // Use file name without extension as default name
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      resumeNameInput.value = fileName;
    }
    
    // Display file information
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    
    if (selectedFileInfo && selectedFileName && selectedFileSize) {
      selectedFileName.textContent = file.name;
      selectedFileSize.textContent = formatFileSize(file.size);
      selectedFileInfo.classList.remove('hidden');
      
      // Change drop area text
      const dropAreaText = document.querySelector('.drop-area-text');
      if (dropAreaText) {
        dropAreaText.textContent = 'File selected! Click to change file.';
      }
    }
  }
  
  /**
   * Format file size in human-readable format
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Handle resume upload button click
   */
  async function handleUploadResume() {
    try {
      if (!resumeNameInput || !resumeFileInput || !uploadStatus) {
        console.error('Resume upload elements not found');
        return;
      }
      
      const name = resumeNameInput.value.trim();
      const file = resumeFileInput.files[0];
      
      if (!name) {
        showStatus(uploadStatus, 'Please enter a name for your resume.', 'warning');
        return;
      }
      
      if (!file) {
        showStatus(uploadStatus, 'Please select a resume file to upload.', 'warning');
        return;
      }
      
      showStatus(uploadStatus, 'Processing resume...', 'info');
      
      // Check if we have an API key configured
      const apiSettings = await chrome.storage.sync.get('jobfiller_api_settings');
      const apiKey = apiSettings.jobfiller_api_settings?.apiKey;
      
      if (!apiKey) {
        showStatus(uploadStatus, 'OpenAI API key not configured. Please set it up in API Settings.', 'error');
        return;
      }
      
      // Set the API key for the parser
      parser.setApiKey(apiKey);
      
      // Check file type
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Parse PDF file using OpenAI
        const fileData = await readFileAsArrayBuffer(file);
        
        try {
          const resumeData = await parser.parsePDF(fileData);
          
          // Save to storage
          const success = await storageManager.saveResume(name, resumeData);
          
          if (success) {
            showStatus(uploadStatus, 'Resume uploaded and parsed successfully!', 'success');
            resumeNameInput.value = '';
            resumeFileInput.value = '';
            
            const selectedFileInfo = document.getElementById('selectedFileInfo');
            if (selectedFileInfo) {
              selectedFileInfo.classList.add('hidden');
            }
            
            const dropAreaText = document.querySelector('.drop-area-text');
            if (dropAreaText) {
              dropAreaText.textContent = 'Drag & drop your resume file here or click to browse';
            }
            
            // Refresh resume list
            await loadResumeList();
          } else {
            showStatus(uploadStatus, 'Error saving resume. Please try again.', 'error');
          }
        } catch (parseError) {
          console.error('Error parsing PDF:', parseError);
          showStatus(uploadStatus, 'Error parsing PDF: ' + parseError.message, 'error');
        }
      } else if (file.name.toLowerCase().endsWith('.json')) {
        // Parse JSON file
        const fileContent = await readFileAsText(file);
        
        try {
          const resumeData = JSON.parse(fileContent);
          
          // Save to storage
          const success = await storageManager.saveResume(name, resumeData);
          
          if (success) {
            showStatus(uploadStatus, 'JSON resume uploaded successfully!', 'success');
            resumeNameInput.value = '';
            resumeFileInput.value = '';
            
            const selectedFileInfo = document.getElementById('selectedFileInfo');
            if (selectedFileInfo) {
              selectedFileInfo.classList.add('hidden');
            }
            
            const dropAreaText = document.querySelector('.drop-area-text');
            if (dropAreaText) {
              dropAreaText.textContent = 'Drag & drop your resume file here or click to browse';
            }
            
            // Refresh resume list
            await loadResumeList();
          } else {
            showStatus(uploadStatus, 'Error saving resume. Please try again.', 'error');
          }
        } catch (jsonError) {
          showStatus(uploadStatus, 'Invalid JSON file. Please check the format.', 'error');
        }
      } else {
        showStatus(uploadStatus, 'Unsupported file type. Please upload a PDF or JSON file.', 'error');
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      showStatus(uploadStatus, 'Error processing resume: ' + error.message, 'error');
    }
  }
  
  /**
   * Apply theme based on dark mode setting
   */
  function applyTheme() {
    const darkMode = darkModeCheckbox ? darkModeCheckbox.checked : false;
    document.body.classList.toggle('dark-theme', darkMode);
  }
  
  /**
   * Load the list of available resumes for default selection
   */
  async function loadResumeList() {
    try {
      const resumes = await storageManager.getAllResumes();
      const resumeNames = Object.keys(resumes);
      const activeResume = await storageManager.getActiveResumeName();
      
      // Update default resume select
      if (defaultResumeSelect) {
        defaultResumeSelect.innerHTML = '';
        
        if (resumeNames.length === 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No resumes available';
          defaultResumeSelect.appendChild(option);
          defaultResumeSelect.disabled = true;
        } else {
          defaultResumeSelect.disabled = false;
          
          resumeNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            
            if (name === activeResume) {
              option.selected = true;
            }
            
            defaultResumeSelect.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Error loading resume list:', error);
    }
  }
  
  /**
   * Show a status message
   * @param {Element} element - Status message element
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, warning, info)
   */
  function showStatus(element, message, type = 'info') {
    if (!element) {
      console.error('Status element not found');
      return;
    }
    
    element.textContent = message;
    element.className = `status-message status-${type}`;
    element.classList.remove('hidden');
    
    // Auto-hide success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        element.classList.add('hidden');
      }, 5000);
    }
  }
  
  /**
   * Read a file as an ArrayBuffer
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Read a file as text
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }
  
  // Check if we're on the API settings tab via URL hash
  if (window.location.hash === '#api-settings') {
    // Find the API settings tab and click it
    const apiSettingsTab = document.querySelector('.tab[data-tab="api-settings"]');
    if (apiSettingsTab) {
      apiSettingsTab.click();
    }
  }
});