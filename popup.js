/**
 * Popup JavaScript
 * Handles the popup UI and user interactions with OpenAI integration
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize storage manager
  const storageManager = new ResumeStorageManager();
  
  // Get UI elements
  const resumeSelect = document.getElementById('resumeSelect');
  const fillFormBtn = document.getElementById('fillFormBtn');
  const smartFillBtn = document.getElementById('smartFillBtn');
  const mapFieldsBtn = document.getElementById('mapFieldsBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const statusMessage = document.getElementById('statusMessage');
  const helpLink = document.getElementById('helpLink');
  const apiKeyWarning = document.getElementById('apiKeyWarning');
  const setupApiLink = document.getElementById('setupApiLink');
  
  // Application info elements
  const applicationInfo = document.getElementById('applicationInfo');
  const applicationSite = document.getElementById('applicationSite');
  const formFieldsCount = document.getElementById('formFieldsCount');
  const mappedFieldsCount = document.getElementById('mappedFieldsCount');
  const confidenceScore = document.getElementById('confidenceScore');
  
  // Check for dark mode
  await applyTheme();
  
  // Check OpenAI API key
  await checkApiKey();
  
  // Load resume list
  await loadResumeList();
  
  // Get current page info
  await getCurrentPageInfo();
  
  // Set up event listeners
  fillFormBtn.addEventListener('click', handleFillForm);
  smartFillBtn.addEventListener('click', handleSmartFill);
  mapFieldsBtn.addEventListener('click', handleMapFields);
  openOptionsBtn.addEventListener('click', handleOpenOptions);
  resumeSelect.addEventListener('change', handleResumeChange);
  helpLink.addEventListener('click', handleHelp);
  setupApiLink.addEventListener('click', handleSetupApi);
  
  /**
   * Apply theme based on settings
   */
  async function applyTheme() {
    try {
      const settings = await chrome.storage.sync.get('jobfiller_settings');
      const darkMode = settings.jobfiller_settings?.darkMode || false;
      
      if (darkMode) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }
  
  /**
   * Check if OpenAI API key is configured
   */
  async function checkApiKey() {
    try {
      const apiSettings = await chrome.storage.sync.get('jobfiller_api_settings');
      
      if (!apiSettings.jobfiller_api_settings?.apiKey) {
        apiKeyWarning.classList.remove('hidden');
        smartFillBtn.disabled = true;
      } else {
        apiKeyWarning.classList.add('hidden');
        smartFillBtn.disabled = false;
      }
    } catch (error) {
      console.error('Error checking API key:', error);
    }
  }
  
  /**
   * Load the list of available resumes
   */
  async function loadResumeList() {
    try {
      const resumes = await storageManager.getAllResumes();
      const resumeNames = Object.keys(resumes);
      const activeResume = await storageManager.getActiveResumeName();
      
      // Clear the dropdown
      resumeSelect.innerHTML = '';
      
      if (resumeNames.length === 0) {
        // No resumes found, add a placeholder option
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No resumes found - Add one in Options';
        resumeSelect.appendChild(option);
        
        // Disable the fill form buttons
        fillFormBtn.disabled = true;
        smartFillBtn.disabled = true;
        
        // Show a status message
        showStatus('No resumes available. Click "Manage Resumes" to add one.', 'info');
      } else {
        // Add each resume to the dropdown
        resumeNames.forEach(name => {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          
          // Select the active resume
          if (name === activeResume) {
            option.selected = true;
          }
          
          resumeSelect.appendChild(option);
        });
        
        // Enable the fill form button
        fillFormBtn.disabled = false;
        
        // Only enable smart fill if API key is set
        const apiSettings = await chrome.storage.sync.get('jobfiller_api_settings');
        smartFillBtn.disabled = !apiSettings.jobfiller_api_settings?.apiKey;
        
        // Clear any status message
        hideStatus();
      }
    } catch (error) {
      console.error('Error loading resume list:', error);
      showStatus('Error loading resumes. Please try again.', 'error');
    }
  }
  
  /**
   * Get information about the current page
   */
  async function getCurrentPageInfo() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) return;
      
      // Extract domain
      const url = new URL(tab.url);
      applicationSite.textContent = url.hostname;
      
      // Try to get field information
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
        
        if (result && result.success) {
          // Show application info
          applicationInfo.classList.remove('hidden');
          
          // Update field counts
          const totalFields = Object.keys(result.fields).length;
          formFieldsCount.textContent = totalFields;
          
          // Count mapped fields
          let mapped = 0;
          for (const field of Object.values(result.fields)) {
            if (field.mapped) mapped++;
          }
          mappedFieldsCount.textContent = mapped;
          
          // Calculate and show confidence score
          const confidence = Math.round((mapped / totalFields) * 100);
          confidenceScore.textContent = `${confidence}%`;
          
          // Style confidence based on score
          if (confidence >= 80) {
            confidenceScore.className = 'stat-value success-text';
          } else if (confidence >= 50) {
            confidenceScore.className = 'stat-value warning-text';
          } else {
            confidenceScore.className = 'stat-value error-text';
          }
        }
      } catch (error) {
        // Content script might not be loaded yet or not on a form page
        console.log('Could not analyze page', error);
      }
    } catch (error) {
      console.error('Error getting current page info:', error);
    }
  }
  
  /**
   * Handle the fill form button click
   */
  async function handleFillForm() {
    try {
      const selectedResume = resumeSelect.value;
      
      if (!selectedResume) {
        showStatus('Please select a resume first.', 'warning');
        return;
      }
      
      // Set the selected resume as active
      await storageManager.setActiveResume(selectedResume);
      
      // Show loading status
      showStatus('Filling form...', 'info');
      
      // Get the active tab and run the content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute the field mapper in the context of the active tab
      const result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'fillForm', 
        resumeName: selectedResume 
      });
      
      if (result && result.success) {
        showStatus(`Successfully filled ${result.filled} fields!`, 'success');
      } else if (result && !result.success) {
        showStatus(`Form filling completed with issues. Filled ${result.filled} of ${result.total} fields.`, 'warning');
      } else {
        showStatus('Error communicating with the page. Try refreshing.', 'error');
      }
    } catch (error) {
      console.error('Error filling form:', error);
      showStatus('Error filling form. Please try again.', 'error');
    }
  }
  
  /**
   * Handle the smart fill button click (using AI)
   */
  async function handleSmartFill() {
    try {
      const selectedResume = resumeSelect.value;
      
      if (!selectedResume) {
        showStatus('Please select a resume first.', 'warning');
        return;
      }
      
      // Set the selected resume as active
      await storageManager.setActiveResume(selectedResume);
      
      // Show loading status
      showStatus('AI analyzing the page...', 'info');
      
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // First, get the OpenAI API settings
      const apiSettings = await chrome.storage.sync.get('jobfiller_api_settings');
      
      if (!apiSettings.jobfiller_api_settings?.apiKey) {
        showStatus('OpenAI API key not configured. Please set it up in the options.', 'error');
        return;
      }
      
      // Execute smart fill in the content script
      const result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'smartFill', 
        resumeName: selectedResume,
        apiKey: apiSettings.jobfiller_api_settings.apiKey,
        model: apiSettings.jobfiller_api_settings.model || 'gpt-4'
      });
      
      if (result && result.success) {
        // Update token usage
        await updateTokenUsage(result.tokenUsage || 0);
        
        showStatus(`AI successfully filled ${result.filled} fields!`, 'success');
      } else if (result && !result.success) {
        showStatus(`AI form filling completed with issues: ${result.message}`, 'warning');
      } else {
        showStatus('Error communicating with the page. Try refreshing.', 'error');
      }
    } catch (error) {
      console.error('Error with AI form filling:', error);
      showStatus('Error with AI form filling. Please try again.', 'error');
    }
  }
  
  /**
   * Update token usage count in storage
   */
  async function updateTokenUsage(newTokens) {
    try {
      const apiSettings = await chrome.storage.sync.get('jobfiller_api_settings');
      
      if (apiSettings.jobfiller_api_settings) {
        const currentUsage = apiSettings.jobfiller_api_settings.tokenUsage || 0;
        
        await chrome.storage.sync.set({
          jobfiller_api_settings: {
            ...apiSettings.jobfiller_api_settings,
            tokenUsage: currentUsage + newTokens
          }
        });
      }
    } catch (error) {
      console.error('Error updating token usage:', error);
    }
  }
  
  /**
   * Handle the map fields button click
   */
  async function handleMapFields() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Open the field mapping interface in a new tab
      await chrome.tabs.create({
        url: `field-mapper.html?url=${encodeURIComponent(tab.url)}&domain=${encodeURIComponent(new URL(tab.url).hostname)}&tabId=${tab.id}`
      });
      
      // Close the popup
      window.close();
    } catch (error) {
      console.error('Error opening field mapper:', error);
      showStatus('Error opening field mapper. Please try again.', 'error');
    }
  }
  
  /**
   * Handle the open options button click
   */
  function handleOpenOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
  }
  
  /**
   * Handle resume selection change
   */
  async function handleResumeChange() {
    const selectedResume = resumeSelect.value;
    
    if (selectedResume) {
      await storageManager.setActiveResume(selectedResume);
      hideStatus();
    }
  }
  
  /**
   * Handle the help link click
   */
  function handleHelp() {
    chrome.tabs.create({ url: 'help.html' });
    window.close();
  }
  
  /**
   * Handle the setup API link click
   */
  function handleSetupApi() {
    chrome.runtime.openOptionsPage();
    // Add a small delay before sending message to ensure options page is loaded
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'showApiSettings' });
    }, 100);
    window.close();
  }
  
  /**
   * Show a status message
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, warning, info)
   */
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.classList.remove('hidden');
    statusMessage.classList.add('animate-slide-in');
  }
  
  /**
   * Hide the status message
   */
  function hideStatus() {
    statusMessage.classList.add('hidden');
  }
});