/**
 * Field Mapper Interface
 * Allows users to map resume fields to form fields on job sites
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const siteUrl = urlParams.get('url') || '';
  const siteDomain = urlParams.get('domain') || '';
  
  // Initialize storage manager
  const storageManager = new ResumeStorageManager();
  
  // Get UI elements
  const siteDomainElement = document.getElementById('siteDomain');
  const siteUrlElement = document.getElementById('siteUrl');
  const fieldsTableBody = document.getElementById('fieldsTableBody');
  const noFieldsMessage = document.getElementById('noFieldsMessage');
  const refreshFieldsBtn = document.getElementById('refreshFieldsBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusMessage = document.getElementById('statusMessage');
  const searchInput = document.getElementById('searchInput');
  const showUnmappedOnlyCheckbox = document.getElementById('showUnmappedOnlyCheckbox');
  
  // Set site info
  siteDomainElement.textContent = siteDomain;
  siteUrlElement.textContent = siteUrl;
  
  // Resume fields structure for mapping
  const resumeFields = [
    { value: '', label: 'Not mapped', group: '' },
    { value: 'personal.name', label: 'Full Name', group: 'Personal' },
    { value: 'personal.firstName', label: 'First Name', group: 'Personal' },
    { value: 'personal.lastName', label: 'Last Name', group: 'Personal' },
    { value: 'personal.email', label: 'Email', group: 'Personal' },
    { value: 'personal.phone', label: 'Phone', group: 'Personal' },
    { value: 'personal.address', label: 'Full Address', group: 'Personal' },
    { value: 'personal.city', label: 'City', group: 'Personal' },
    { value: 'personal.state', label: 'State/Province', group: 'Personal' },
    { value: 'personal.zip', label: 'ZIP/Postal Code', group: 'Personal' },
    { value: 'personal.country', label: 'Country', group: 'Personal' },
    { value: 'personal.linkedin', label: 'LinkedIn URL', group: 'Personal' },
    { value: 'personal.website', label: 'Website URL', group: 'Personal' },
    { value: 'summary', label: 'Professional Summary', group: 'Summary' },
    { value: 'experience[0].company', label: 'Most Recent Company', group: 'Experience' },
    { value: 'experience[0].title', label: 'Most Recent Job Title', group: 'Experience' },
    { value: 'experience[0].startDate', label: 'Most Recent Job Start Date', group: 'Experience' },
    { value: 'experience[0].endDate', label: 'Most Recent Job End Date', group: 'Experience' },
    { value: 'experience[0].location', label: 'Most Recent Job Location', group: 'Experience' },
    { value: 'experience[0].description', label: 'Most Recent Job Description', group: 'Experience' },
    { value: 'experience[1].company', label: 'Previous Company', group: 'Experience' },
    { value: 'experience[1].title', label: 'Previous Job Title', group: 'Experience' },
    { value: 'experience[1].startDate', label: 'Previous Job Start Date', group: 'Experience' },
    { value: 'experience[1].endDate', label: 'Previous Job End Date', group: 'Experience' },
    { value: 'experience[1].location', label: 'Previous Job Location', group: 'Experience' },
    { value: 'experience[1].description', label: 'Previous Job Description', group: 'Experience' },
    { value: 'education[0].school', label: 'Most Recent School', group: 'Education' },
    { value: 'education[0].degree', label: 'Most Recent Degree', group: 'Education' },
    { value: 'education[0].field', label: 'Most Recent Field of Study', group: 'Education' },
    { value: 'education[0].graduationDate', label: 'Most Recent Graduation Date', group: 'Education' },
    { value: 'education[0].gpa', label: 'Most Recent GPA', group: 'Education' },
    { value: 'education[0].location', label: 'Most Recent School Location', group: 'Education' },
    { value: 'education[1].school', label: 'Previous School', group: 'Education' },
    { value: 'education[1].degree', label: 'Previous Degree', group: 'Education' },
    { value: 'education[1].field', label: 'Previous Field of Study', group: 'Education' },
    { value: 'education[1].graduationDate', label: 'Previous Graduation Date', group: 'Education' },
    { value: 'skills', label: 'Skills (comma-separated)', group: 'Skills' },
    { value: 'certifications[0].name', label: 'Most Recent Certification', group: 'Certifications' },
    { value: 'certifications[0].issuer', label: 'Most Recent Certification Issuer', group: 'Certifications' },
    { value: 'certifications[0].date', label: 'Most Recent Certification Date', group: 'Certifications' },
    { value: 'projects[0].name', label: 'Most Recent Project', group: 'Projects' },
    { value: 'projects[0].description', label: 'Most Recent Project Description', group: 'Projects' },
    { value: 'projects[0].technologies', label: 'Most Recent Project Technologies', group: 'Projects' }
  ];
  
  // Store field data
  let pageFields = {};
  let currentMappings = {};
  
  // Set up event listeners
  refreshFieldsBtn.addEventListener('click', loadFields);
  saveBtn.addEventListener('click', saveMappings);
  cancelBtn.addEventListener('click', () => window.close());
  searchInput.addEventListener('input', filterFields);
  showUnmappedOnlyCheckbox.addEventListener('change', filterFields);
  
  // Load fields
  await loadFields();
  
  /**
   * Load fields from the target page
   */
  async function loadFields() {
    try {
      showStatus('Analyzing form fields on the page...', 'info');
      
      // Get the tab ID from the URL
      const tabId = getTabIdFromUrl();
      
      if (!tabId) {
        showStatus('Error: Unable to determine which tab to analyze.', 'error');
        return;
      }
      
      // Get existing mappings
      currentMappings = await storageManager.getFieldMappings(siteDomain) || {};
      
      // Request field analysis from the content script
      const response = await chrome.runtime.sendMessage({
        action: 'executeInTab',
        tabId: tabId,
        function: 'analyzePage'
      });
      
      if (!response || !response.success) {
        showStatus(`Error analyzing page: ${response?.message || 'Unknown error'}`, 'error');
        return;
      }
      
      // Store fields data
      pageFields = response.fields || {};
      
      // Check if we have fields
      if (Object.keys(pageFields).length === 0) {
        fieldsTableBody.innerHTML = '';
        noFieldsMessage.classList.remove('hidden');
        showStatus('No form fields found on the page.', 'warning');
        return;
      }
      
      // Hide no fields message
      noFieldsMessage.classList.add('hidden');
      
      // Clear status message
      hideStatus();
      
      // Populate table
      updateFieldsTable();
    } catch (error) {
      console.error('Error loading fields:', error);
      showStatus(`Error loading fields: ${error.message}`, 'error');
    }
  }
  
  /**
   * Update the fields table with current data
   */
  function updateFieldsTable() {
    // Clear table body
    fieldsTableBody.innerHTML = '';
    
    // Get filter criteria
    const searchTerm = searchInput.value.toLowerCase();
    const showUnmappedOnly = showUnmappedOnlyCheckbox.checked;
    
    // Sort fields by label
    const sortedFields = Object.values(pageFields).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
    
    // Filter fields
    const filteredFields = sortedFields.filter(field => {
      // Apply search filter
      const matchesSearch = field.label.toLowerCase().includes(searchTerm) ||
                          field.id.toLowerCase().includes(searchTerm);
      
      // Apply unmapped filter
      const isMapped = field.mapped && field.mapped !== '';
      return matchesSearch && (!showUnmappedOnly || !isMapped);
    });
    
    // Create rows for each field
    filteredFields.forEach(field => {
      const row = document.createElement('tr');
      
      // Field label
      const labelCell = document.createElement('td');
      labelCell.textContent = field.label;
      row.appendChild(labelCell);
      
      // Field type
      const typeCell = document.createElement('td');
      typeCell.textContent = field.type;
      typeCell.style.color = 'var(--gray-500)';
      typeCell.style.fontSize = 'var(--font-size-sm)';
      row.appendChild(typeCell);
      
      // Mapping dropdown
      const mappingCell = document.createElement('td');
      const mappingSelect = createResumeFieldSelector(field.id, field.mapped || '');
      mappingCell.appendChild(mappingSelect);
      row.appendChild(mappingCell);
      
      fieldsTableBody.appendChild(row);
    });
    
    // Show message if no fields match the filter
    if (filteredFields.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 3;
      emptyCell.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--gray-500);">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; margin: 0 auto 16px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <div>No fields match the current filter criteria</div>
        </div>
      `;
      emptyRow.appendChild(emptyCell);
      fieldsTableBody.appendChild(emptyRow);
    }
  }
  
  /**
   * Create a dropdown for selecting resume fields
   */
  function createResumeFieldSelector(fieldId, currentValue) {
    const select = document.createElement('select');
    select.className = 'resume-field-select';
    select.dataset.fieldId = fieldId;
    
    // Group options by category
    const groups = {};
    
    resumeFields.forEach(field => {
      if (field.group && !groups[field.group]) {
        groups[field.group] = document.createElement('optgroup');
        groups[field.group].label = field.group;
        select.appendChild(groups[field.group]);
      }
      
      const option = document.createElement('option');
      option.value = field.value;
      option.textContent = field.label;
      
      if (field.value === currentValue) {
        option.selected = true;
      }
      
      if (field.group) {
        groups[field.group].appendChild(option);
      } else {
        select.appendChild(option);
      }
    });
    
    return select;
  }
  
  /**
   * Save the field mappings
   */
  async function saveMappings() {
    try {
      showStatus('Saving field mappings...', 'info');
      
      // Get all select elements
      const selects = document.querySelectorAll('.resume-field-select');
      
      // Create mappings object
      const mappings = {};
      
      // Process each select
      selects.forEach(select => {
        const fieldId = select.dataset.fieldId;
        const resumeField = select.value;
        
        // Only store non-empty mappings
        if (resumeField) {
          mappings[fieldId] = resumeField;
        }
      });
      
      // Save mappings
      const success = await storageManager.saveFieldMappings(siteDomain, mappings);
      
      if (success) {
        showStatus('Field mappings saved successfully!', 'success');
        
        // Offer to test the mappings
        setTimeout(() => {
          if (confirm('Field mappings saved! Do you want to test them by filling the form now?')) {
            testMappings();
          }
        }, 500);
      } else {
        showStatus('Error saving field mappings. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error saving mappings:', error);
      showStatus(`Error saving mappings: ${error.message}`, 'error');
    }
  }
  
  /**
   * Test the mappings by filling the form
   */
  async function testMappings() {
    try {
      // Get the tab ID from the URL
      const tabId = getTabIdFromUrl();
      
      if (!tabId) {
        showStatus('Error: Unable to determine which tab to test.', 'error');
        return;
      }
      
      // Get the active resume
      const activeResumeName = await storageManager.getActiveResumeName();
      
      if (!activeResumeName) {
        showStatus('No active resume found. Please set an active resume in the options page.', 'warning');
        return;
      }
      
      // Request form filling from the content script
      const response = await chrome.runtime.sendMessage({
        action: 'executeInTab',
        tabId: tabId,
        function: 'fillForm',
        params: { resumeName: activeResumeName }
      });
      
      if (!response || !response.success) {
        showStatus(`Error testing mappings: ${response?.message || 'Unknown error'}`, 'error');
        return;
      }
      
      showStatus(`Test successful! Filled ${response.filled} fields.`, 'success');
    } catch (error) {
      console.error('Error testing mappings:', error);
      showStatus(`Error testing mappings: ${error.message}`, 'error');
    }
  }
  
  /**
   * Filter fields based on search and checkbox
   */
  function filterFields() {
    updateFieldsTable();
  }
  
  /**
   * Show a status message
   */
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.classList.remove('hidden');
    
    // Auto-hide success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(hideStatus, 5000);
    }
  }
  
  /**
   * Hide the status message
   */
  function hideStatus() {
    statusMessage.classList.add('hidden');
  }
  
  /**
   * Get the tab ID from the URL
   */
  function getTabIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const tabIdParam = urlParams.get('tabId');
    
    return tabIdParam ? parseInt(tabIdParam) : null;
  }
});