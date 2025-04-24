/**
 * Options Page JavaScript
 * Handles resume management and settings configuration
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize storage manager
  const storageManager = new ResumeStorageManager();
  
  // Get UI elements - Tabs
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Get UI elements - Manage Resumes
  const resumeList = document.getElementById('resumeList');
  const noResumesMessage = document.getElementById('noResumesMessage');
  const refreshResumeListBtn = document.getElementById('refreshResumeListBtn');
  
  // Get UI elements - Upload Resume
  const resumeNameInput = document.getElementById('resumeName');
  const resumeFileInput = document.getElementById('resumeFile');
  const dropArea = document.getElementById('dropArea');
  const uploadResumeBtn = document.getElementById('uploadResumeBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  const selectedFileInfo = document.getElementById('selectedFileInfo');
  const selectedFileName = document.getElementById('selectedFileName');
  const selectedFileSize = document.getElementById('selectedFileSize');
  
  // Get UI elements - JSON Resume
  const jsonEditor = document.getElementById('jsonEditor');
  const saveJsonResumeBtn = document.getElementById('saveJsonResumeBtn');
  const jsonStatus = document.getElementById('jsonStatus');
  
  // Get UI elements - Field Mappings
  const mappingsList = document.getElementById('mappingsList');
  const noMappingsMessage = document.getElementById('noMappingsMessage');
  
  // Get UI elements - Settings
  const defaultResumeSelect = document.getElementById('defaultResumeSelect');
  const autofillOnLoadCheckbox = document.getElementById('autofillOnLoadCheckbox');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  
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
      targetContent.style.display = 'block';
      
      // Trigger animation by forcing a reflow and then adding the active class
      void targetContent.offsetWidth;
      targetContent.classList.add('active');
    });
  });
  
  // Load initial data
  await loadResumeList();
  await loadFieldMappings();
  await loadSettings();
  
  // Set up event listeners - Manage Resumes
  refreshResumeListBtn.addEventListener('click', loadResumeList);
  
  // Set up event listeners - Upload Resume
  uploadResumeBtn.addEventListener('click', handleUploadResume);
  resumeFileInput.addEventListener('change', handleFileSelected);
  
  // Set up drag and drop for resume upload
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
  
  // Set up event listeners - JSON Resume
  saveJsonResumeBtn.addEventListener('click', handleSaveJsonResume);
  
  // Set up event listeners - Settings
  saveSettingsBtn.addEventListener('click', handleSaveSettings);
  
  /**
   * Load and display the list of resumes
   */
  async function loadResumeList() {
    try {
      const resumes = await storageManager.getAllResumes();
      const resumeNames = Object.keys(resumes);
      const activeResume = await storageManager.getActiveResumeName();
      
      // Update resume list
      resumeList.innerHTML = '';
      
      if (resumeNames.length === 0) {
        // Show "no resumes" message
        noResumesMessage.classList.remove('hidden');
      } else {
        // Hide "no resumes" message
        noResumesMessage.classList.add('hidden');
        
        // Add each resume to the list
        resumeNames.forEach(name => {
          const resumeUpdatedAt = new Date(resumes[name].updatedAt);
          const formattedDate = resumeUpdatedAt.toLocaleDateString() + ' ' + 
                               resumeUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          const resumeItem = document.createElement('div');
          resumeItem.className = 'resume-item';
          resumeItem.innerHTML = `
            <div class="resume-info">
              <div class="resume-name">
                ${name}
                ${name === activeResume ? '<span class="active-badge">Active</span>' : ''}
              </div>
              <div class="resume-date">Updated: ${formattedDate}</div>
            </div>
            <div class="resume-actions">
              <button class="action-button view-btn" title="View resume data">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="action-button edit-btn" title="Edit resume">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="action-button set-active-btn" title="Set as active resume" ${name === activeResume ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </button>
              <button class="action-button delete-btn" title="Delete resume">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          `;
          
          // Add event listeners for buttons
          resumeItem.querySelector('.view-btn').addEventListener('click', () => {
            handleViewResume(name);
          });
          
          resumeItem.querySelector('.edit-btn').addEventListener('click', () => {
            handleEditResume(name);
          });
          
          resumeItem.querySelector('.set-active-btn').addEventListener('click', () => {
            handleSetActiveResume(name);
          });
          
          resumeItem.querySelector('.delete-btn').addEventListener('click', () => {
            handleDeleteResume(name);
          });
          
          resumeList.appendChild(resumeItem);
        });
      }
      
      // Also update the default resume select in settings
      updateDefaultResumeSelect(resumeNames, activeResume);
    } catch (error) {
      console.error('Error loading resume list:', error);
      showStatus(uploadStatus, 'Error loading resume list. Please try again.', 'error');
    }
  }
  
  /**
   * Update the default resume select dropdown
   */
  function updateDefaultResumeSelect(resumeNames, activeResume) {
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
   * Handle file selection for resume upload
   */
  function handleFileSelected() {
    const file = resumeFileInput.files[0];
    if (!file) return;
    
    // Auto-fill name field if empty
    if (!resumeNameInput.value) {
      // Use file name without extension as default name
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      resumeNameInput.value = fileName;
    }
    
    // Display file information
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatFileSize(file.size);
    selectedFileInfo.classList.remove('hidden');
    
    // Change drop area text
    document.querySelector('.drop-area-text').textContent = 'File selected! Click to change file.';
  }
  
  /**
   * Handle resume upload button click
   */
  async function handleUploadResume() {
    try {
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
      
      // Check file type
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Parse PDF file
        const fileData = await readFileAsArrayBuffer(file);
        
        // Check if PDF.js is loaded
        if (!window.pdfjsLib) {
          // Wait for PDF.js to be available
          showStatus(uploadStatus, 'Waiting for PDF.js to initialize...', 'info');
          
          await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              if (window.pdfjsLib) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 200);
            
            // Timeout after 10 seconds
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 10000);
          });
        }
        
        if (!window.pdfjsLib) {
          showStatus(uploadStatus, 'Error: PDF.js library not loaded. Try refreshing the page.', 'error');
          return;
        }
        
        // Initialize parser
        const parser = new ResumeParser();
        try {
          const resumeData = await parser.parsePDF(fileData);
          
          // Save to storage
          const success = await storageManager.saveResume(name, resumeData);
          
          if (success) {
            showStatus(uploadStatus, 'Resume uploaded and parsed successfully!', 'success');
            resumeNameInput.value = '';
            resumeFileInput.value = '';
            selectedFileInfo.classList.add('hidden');
            document.querySelector('.drop-area-text').textContent = 'Drag & drop your resume file here or click to browse';
            
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
            selectedFileInfo.classList.add('hidden');
            document.querySelector('.drop-area-text').textContent = 'Drag & drop your resume file here or click to browse';
            
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
   * Handle saving JSON resume
   */
  async function handleSaveJsonResume() {
    try {
      const name = prompt('Enter a name for this resume:');
      
      if (!name || name.trim() === '') {
        return; // Cancelled
      }
      
      const jsonContent = jsonEditor.value.trim();
      
      if (!jsonContent) {
        showStatus(jsonStatus, 'Please enter resume data in JSON format.', 'warning');
        return;
      }
      
      try {
        const resumeData = JSON.parse(jsonContent);
        
        // Save to storage
        const success = await storageManager.saveResume(name.trim(), resumeData);
        
        if (success) {
          showStatus(jsonStatus, 'JSON resume saved successfully!', 'success');
          jsonEditor.value = '';
          
          // Refresh resume list
          await loadResumeList();
        } else {
          showStatus(jsonStatus, 'Error saving resume. Please try again.', 'error');
        }
      } catch (jsonError) {
        showStatus(jsonStatus, 'Invalid JSON format. Please check for syntax errors.', 'error');
      }
    } catch (error) {
      console.error('Error saving JSON resume:', error);
      showStatus(jsonStatus, 'Error saving resume: ' + error.message, 'error');
    }
  }
  
  /**
   * Handle viewing a resume
   */
  async function handleViewResume(name) {
    try {
      const resume = await storageManager.getResume(name);
      
      if (resume) {
        // Switch to the "Upload Resume" tab but just for viewing the JSON
        document.querySelector('.tab[data-tab="upload-resume"]').click();
        
        // Show the resume in the JSON editor
        jsonEditor.value = JSON.stringify(resume, null, 2);
        
        // Set focus to the editor
        jsonEditor.focus();
      }
    } catch (error) {
      console.error('Error viewing resume:', error);
      alert('Error loading resume data. Please try again.');
    }
  }
  
  /**
   * Handle editing a resume
   */
  async function handleEditResume(name) {
    try {
      const resume = await storageManager.getResume(name);
      
      if (resume) {
        // Switch to the "Upload Resume" tab
        document.querySelector('.tab[data-tab="upload-resume"]').click();
        
        // Pre-fill the resume name
        resumeNameInput.value = name;
        
        // Show the resume in the JSON editor
        jsonEditor.value = JSON.stringify(resume, null, 2);
        
        // Set focus to the editor
        jsonEditor.focus();
        
        // Scroll to the JSON editor
        saveJsonResumeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (error) {
      console.error('Error editing resume:', error);
      alert('Error loading resume data. Please try again.');
    }
  }
  
  /**
   * Handle setting a resume as active
   */
  async function handleSetActiveResume(name) {
    try {
      const success = await storageManager.setActiveResume(name);
      
      if (success) {
        // Refresh resume list to update active badge
        await loadResumeList();
      } else {
        alert('Error setting active resume. Please try again.');
      }
    } catch (error) {
      console.error('Error setting active resume:', error);
      alert('Error setting active resume. Please try again.');
    }
  }
  
  /**
   * Handle deleting a resume
   */
  async function handleDeleteResume(name) {
    try {
      const confirm = window.confirm(`Are you sure you want to delete the resume "${name}"?`);
      
      if (confirm) {
        const success = await storageManager.deleteResume(name);
        
        if (success) {
          // Refresh resume list
          await loadResumeList();
        } else {
          alert('Error deleting resume. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
      alert('Error deleting resume. Please try again.');
    }
  }
  
  /**
   * Load and display field mappings
   */
  async function loadFieldMappings() {
    try {
      const mappings = await storageManager.getAllFieldMappings();
      const domainNames = Object.keys(mappings);
      
      // Update mappings list
      mappingsList.innerHTML = '';
      
      if (domainNames.length === 0) {
        // Show "no mappings" message
        noMappingsMessage.classList.remove('hidden');
      } else {
        // Hide "no mappings" message
        noMappingsMessage.classList.add('hidden');
        
        // Create list of domains with mappings
        const mappingsList = document.createElement('ul');
        mappingsList.className = 'resume-list';
        
        domainNames.forEach(domain => {
          const mappingCount = Object.keys(mappings[domain]).length;
          
          const mappingItem = document.createElement('div');
          mappingItem.className = 'resume-item';
          mappingItem.innerHTML = `
            <div class="resume-info">
              <div class="resume-name">${domain}</div>
              <div class="resume-date">${mappingCount} custom field mappings</div>
            </div>
            <div class="resume-actions">
              <button class="action-button view-mapping-btn" title="View mappings">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="action-button delete-mapping-btn" title="Delete mappings">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          `;
          
          // Add event listeners for buttons
          mappingItem.querySelector('.view-mapping-btn').addEventListener('click', () => {
            handleViewMapping(domain, mappings[domain]);
          });
          
          mappingItem.querySelector('.delete-mapping-btn').addEventListener('click', () => {
            handleDeleteMapping(domain);
          });
          
          mappingsList.appendChild(mappingItem);
        });
        
        document.getElementById('mappingsList').appendChild(mappingsList);
      }
    } catch (error) {
      console.error('Error loading field mappings:', error);
    }
  }
  
  /**
   * Handle viewing field mappings
   */
  function handleViewMapping(domain, mappings) {
    // Create a modal or better UI for viewing mappings
    const formattedMappings = JSON.stringify(mappings, null, 2);
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
        <div style="background: white; border-radius: 8px; width: 600px; max-width: 90%; max-height: 80vh; overflow: auto; padding: 20px; position: relative;">
          <button style="position: absolute; right: 20px; top: 20px; background: none; border: none; cursor: pointer; font-size: 24px;">&times;</button>
          <h3 style="margin-top: 0;">Field mappings for ${domain}</h3>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow: auto;">${formattedMappings}</pre>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listener to close modal
    modal.querySelector('button').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }
  
  /**
   * Handle deleting field mappings
   */
  async function handleDeleteMapping(domain) {
    try {
      const confirm = window.confirm(`Are you sure you want to delete the field mappings for "${domain}"?`);
      
      if (confirm) {
        const success = await storageManager.deleteFieldMappings(domain);
        
        if (success) {
          // Refresh mappings list
          await loadFieldMappings();
        } else {
          alert('Error deleting mappings. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error deleting field mappings:', error);
      alert('Error deleting field mappings. Please try again.');
    }
  }
  
  /**
   * Load settings
   */
  async function loadSettings() {
    try {
      // Load autofill on load setting
      const settings = await chrome.storage.sync.get('jobfiller_settings');
      const autofillOnLoad = settings.jobfiller_settings?.autofillOnLoad || false;
      
      autofillOnLoadCheckbox.checked = autofillOnLoad;
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  /**
   * Handle saving settings
   */
  async function handleSaveSettings() {
    try {
      // Get settings values
      const defaultResume = defaultResumeSelect.value;
      const autofillOnLoad = autofillOnLoadCheckbox.checked;
      
      // Save active resume if changed
      if (defaultResume) {
        await storageManager.setActiveResume(defaultResume);
      }
      
      // Save other settings
      await chrome.storage.sync.set({
        jobfiller_settings: {
          autofillOnLoad
        }
      });
      
      showStatus(settingsStatus, 'Settings saved successfully!', 'success');
      
      // Refresh resume list to reflect any changes
      await loadResumeList();
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus(settingsStatus, 'Error saving settings. Please try again.', 'error');
    }
  }
  
  /**
   * Show a status message
   */
  function showStatus(element, message, type = 'info') {
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
});