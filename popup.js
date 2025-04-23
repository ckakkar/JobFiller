/**
 * Popup JavaScript
 * Handles the popup UI and user interactions
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize storage manager
  const storageManager = new ResumeStorageManager();
  
  // Get UI elements
  const resumeSelect = document.getElementById('resumeSelect');
  const fillFormBtn = document.getElementById('fillFormBtn');
  const mapFieldsBtn = document.getElementById('mapFieldsBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const statusMessage = document.getElementById('statusMessage');
  const helpLink = document.getElementById('helpLink');
  
  // Load resume list
  await loadResumeList();
  
  // Set up event listeners
  fillFormBtn.addEventListener('click', handleFillForm);
  mapFieldsBtn.addEventListener('click', handleMapFields);
  openOptionsBtn.addEventListener('click', handleOpenOptions);
  resumeSelect.addEventListener('change', handleResumeChange);
  helpLink.addEventListener('click', handleHelp);
  
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
        
        // Disable the fill form button
        fillFormBtn.disabled = true;
        
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
        
        // Clear any status message
        hideStatus();
      }
    } catch (error) {
      console.error('Error loading resume list:', error);
      showStatus('Error loading resumes. Please try again.', 'error');
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
   * Handle the map fields button click
   */
  async function handleMapFields() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Open the field mapping interface in a new tab
      await chrome.tabs.create({
        url: `field-mapper.html?url=${encodeURIComponent(tab.url)}&domain=${encodeURIComponent(new URL(tab.url).hostname)}`
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
   * Show a status message
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, warning, info)
   */
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
  }
  
  /**
   * Hide the status message
   */
  function hideStatus() {
    statusMessage.classList.add('hidden');
  }
});
