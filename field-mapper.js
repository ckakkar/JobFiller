/**
 * Field Mapper
 * Handles mapping resume fields to form fields on job application pages
 */

class FieldMapper {
  constructor() {
    this.storageManager = new ResumeStorageManager();
    
    // Common field mappings that work on most job sites
    this.defaultMappings = {
      // Personal info
      'personal.name': ['name', 'fullname', 'full-name', 'full_name'],
      'personal.email': ['email', 'email-address', 'emailaddress', 'email_address'],
      'personal.phone': ['phone', 'phonenumber', 'phone-number', 'phone_number', 'mobile', 'cell'],
      'personal.address': ['address', 'street-address', 'streetaddress', 'street_address'],
      'personal.linkedin': ['linkedin', 'linkedin-url', 'linkedin_url', 'socialLinkedin'],
      'personal.website': ['website', 'personal-website', 'personal_website', 'portfolio'],
      
      // Summary
      'summary': ['summary', 'professional-summary', 'professional_summary', 'about', 'about-me', 'about_me'],
      
      // Education (first entry)
      'education[0].school': ['education', 'school', 'university', 'college', 'institution'],
      'education[0].degree': ['degree', 'degree-type', 'degree_type'],
      'education[0].field': ['field', 'major', 'field-of-study', 'field_of_study'],
      'education[0].graduationDate': ['graduation-date', 'graduation_date', 'grad-date', 'grad_date'],
      'education[0].gpa': ['gpa', 'grade-point-average', 'grade_point_average'],
      
      // Experience (first entry)
      'experience[0].company': ['company', 'employer', 'organization'],
      'experience[0].title': ['job-title', 'job_title', 'title', 'position'],
      'experience[0].startDate': ['start-date', 'start_date', 'employment-start-date', 'employment_start_date'],
      'experience[0].endDate': ['end-date', 'end_date', 'employment-end-date', 'employment_end_date'],
      'experience[0].description': ['job-description', 'job_description', 'description', 'responsibilities'],
      
      // Skills (joined as comma-separated list)
      'skills': ['skills', 'skill-list', 'skill_list', 'key-skills', 'key_skills']
    };
  }

  /**
   * Get field mappings for the current domain
   * @param {string} domain - Current domain name
   * @returns {Promise<Object>} - Field mappings
   */
  async getMappings(domain) {
    // Try to get site-specific mappings
    const customMappings = await this.storageManager.getFieldMappings(domain);
    
    // Combine with default mappings (custom mappings take precedence)
    return { ...this.defaultMappings, ...(customMappings || {}) };
  }

  /**
   * Analyze the page and extract all form fields that could be filled
   * @returns {Object} - Map of field identifiers to field elements
   */
  analyzeFormFields() {
    const fields = {};
    
    // Find all input, select, and textarea elements
    const formElements = document.querySelectorAll('input, select, textarea');
    
    for (const element of formElements) {
      if (this.isVisibleElement(element) && !this.isExcluded(element)) {
        const fieldId = this.getFieldIdentifier(element);
        if (fieldId) {
          fields[fieldId] = element;
        }
      }
    }
    
    return fields;
  }

  /**
   * Check if an element is visible on the page
   * @param {Element} element - DOM element to check
   * @returns {boolean} - Whether the element is visible
   */
  isVisibleElement(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  }

  /**
   * Check if an element should be excluded from auto-filling
   * @param {Element} element - DOM element to check
   * @returns {boolean} - Whether the element should be excluded
   */
  isExcluded(element) {
    // Skip hidden or file inputs
    if (element.type === 'hidden' || element.type === 'file') {
      return true;
    }
    
    // Skip password fields
    if (element.type === 'password') {
      return true;
    }
    
    // Skip elements with specific keywords in attributes that suggest they shouldn't be filled
    const attributes = [element.id, element.name, element.placeholder, element.className].filter(Boolean);
    const excludeKeywords = ['captcha', 'security', 'verification', 'consent', 'agreement', 'terms', 'subscribe'];
    
    return excludeKeywords.some(keyword => 
      attributes.some(attr => attr.toLowerCase().includes(keyword))
    );
  }

  /**
   * Get a unique identifier for a form field
   * @param {Element} element - DOM form element
   * @returns {string|null} - Field identifier or null if can't be determined
   */
  getFieldIdentifier(element) {
    // Try to use ID, name, or other attributes to identify the field
    if (element.id) {
      return `id:${element.id}`;
    }
    
    if (element.name) {
      return `name:${element.name}`;
    }
    
    // Try to use label text if there's a label associated with this element
    const labelForElement = document.querySelector(`label[for="${element.id}"]`);
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
    
    // Try to use a parent div with a label-like class
    const parentWithLabel = element.closest('[class*="label"], [class*="field"]');
    if (parentWithLabel) {
      const labelText = parentWithLabel.textContent.trim().slice(0, 50);
      if (labelText) {
        return `parent:${labelText}`;
      }
    }
    
    // As a last resort, use XPath
    const xpath = this.getElementXPath(element);
    if (xpath) {
      return `xpath:${xpath}`;
    }
    
    return null;
  }

  /**
   * Get the XPath for an element
   * @param {Element} element - DOM element
   * @returns {string} - XPath
   */
  getElementXPath(element) {
    if (!element) return '';
    
    let xpath = '';
    for (; element && element.nodeType === 1; element = element.parentNode) {
      let idx = 1;
      for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
          idx++;
        }
      }
      
      const tag = element.tagName.toLowerCase();
      const pathIndex = (idx > 1 ? `[${idx}]` : '');
      xpath = `/${tag}${pathIndex}${xpath}`;
    }
    
    return xpath;
  }

  /**
   * Get a probable field type based on the field's attributes
   * @param {Element} element - DOM form element
   * @returns {string} - Probable field type
   */
  getFieldType(element) {
    // Use HTML5 type attribute if available
    if (element.type) {
      return element.type;
    }
    
    // Try to infer from id/name/placeholder
    const attributes = [
      element.id, 
      element.name, 
      element.placeholder,
      element.getAttribute('aria-label')
    ].filter(Boolean).map(attr => attr.toLowerCase());
    
    if (attributes.some(attr => attr.includes('email'))) {
      return 'email';
    }
    
    if (attributes.some(attr => attr.includes('phone') || attr.includes('mobile'))) {
      return 'tel';
    }
    
    if (attributes.some(attr => attr.includes('date'))) {
      return 'date';
    }
    
    // Default to text
    return 'text';
  }

  /**
   * Match a field identifier to a resume field
   * @param {string} fieldId - Field identifier (e.g., "id:firstName")
   * @param {Object} mappings - Field mappings
   * @returns {string|null} - Matching resume field or null if no match
   */
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

  /**
   * Get value from resume data using a path
   * @param {Object} resume - Resume data
   * @param {string} path - Path to value (e.g., "personal.name" or "experience[0].title")
   * @returns {any} - Value from resume or empty string if not found
   */
  getValueFromResume(resume, path) {
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
  }

  /**
   * Split a full name into first and last name
   * @param {string} fullName - Full name
   * @returns {Object} - Object with firstName and lastName
   */
  splitName(fullName) {
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
   * @param {Element} element - DOM form element
   * @param {string} value - Value to set
   * @returns {boolean} - Whether setting the value was successful
   */
  setFieldValue(element, value) {
    if (!element || value === undefined) return false;
    
    try {
      // Different handling based on element type
      if (element.tagName.toLowerCase() === 'select') {
        // For select elements, find the matching option
        this.setSelectValue(element, value);
      } else if (element.type === 'checkbox') {
        // For checkboxes, check if the value is truthy
        element.checked = Boolean(value);
      } else if (element.type === 'radio') {
        // For radio buttons, find the matching value in the group
        this.setRadioValue(element, value);
      } else {
        // For text inputs and textareas
        element.value = value;
        
        // Trigger input and change events to ensure validation runs
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      return true;
    } catch (error) {
      console.error('Error setting field value:', error);
      return false;
    }
  }

  /**
   * Set value on a select element
   * @param {HTMLSelectElement} selectElement - Select element
   * @param {string} value - Value to set
   */
  setSelectValue(selectElement, value) {
    // Convert value to string
    const stringValue = String(value).toLowerCase();
    
    // Try to find an exact match first
    for (const option of selectElement.options) {
      if (option.value.toLowerCase() === stringValue || option.text.toLowerCase() === stringValue) {
        selectElement.value = option.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    
    // If no exact match, try partial match
    for (const option of selectElement.options) {
      if (option.value.toLowerCase().includes(stringValue) || 
          option.text.toLowerCase().includes(stringValue)) {
        selectElement.value = option.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    
    return false;
  }

  /**
   * Set value on a radio button group
   * @param {HTMLInputElement} radioElement - One radio button from the group
   * @param {string} value - Value to set
   */
  setRadioValue(radioElement, value) {
    // Get all radio buttons in the same group
    const name = radioElement.name;
    const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    
    // Convert value to string
    const stringValue = String(value).toLowerCase();
    
    // Try to find a matching radio button
    for (const radio of radioGroup) {
      if (radio.value.toLowerCase() === stringValue || 
          radio.labels && radio.labels[0] && radio.labels[0].textContent.toLowerCase().includes(stringValue)) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    
    return false;
  }

  /**
   * Fill a form with resume data
   * @param {Object} resume - Resume data
   * @param {Object} mappings - Field mappings
   * @returns {Object} - Results with success/failure counts
   */
  async fillForm(resume) {
    // Get the current domain
    const domain = window.location.hostname;
    
    // Get mappings for this domain
    const mappings = await this.getMappings(domain);
    
    // Analyze the form fields
    const fields = this.analyzeFormFields();
    
    const results = {
      total: Object.keys(fields).length,
      filled: 0,
      skipped: 0,
      failed: 0
    };
    
    // Process each field
    for (const [fieldId, element] of Object.entries(fields)) {
      // Skip if element is no longer in the DOM
      if (!element || !document.contains(element)) {
        results.skipped++;
        continue;
      }
      
      // Match the field to a resume field
      const resumeField = this.matchFieldToResume(fieldId, mappings);
      
      // Skip if no match found
      if (!resumeField) {
        results.skipped++;
        continue;
      }
      
      // Get the value from the resume
      let value = this.getValueFromResume(resume, resumeField);
      
      // Handle special cases
      if (resumeField === 'personal.name') {
        // For first name fields
        if (fieldId.toLowerCase().includes('first')) {
          value = this.splitName(value).firstName;
        }
        // For last name fields
        else if (fieldId.toLowerCase().includes('last')) {
          value = this.splitName(value).lastName;
        }
      }
      
      // Set the value on the field
      const success = this.setFieldValue(element, value);
      
      if (success) {
        results.filled++;
      } else {
        results.failed++;
      }
    }
    
    return results;
  }
}