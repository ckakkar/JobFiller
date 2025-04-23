/**
 * Resume Storage Manager
 * Handles storing and retrieving resume data from Chrome storage
 */

class ResumeStorageManager {
  constructor() {
    this.STORAGE_KEY = 'jobfiller_resumes';
    this.ACTIVE_RESUME_KEY = 'jobfiller_active_resume';
    this.FIELD_MAPPINGS_KEY = 'jobfiller_field_mappings';
  }

  /**
   * Save a resume to storage
   * @param {string} name - Name/label for this resume
   * @param {Object} resumeData - Parsed resume data
   * @returns {Promise<boolean>} - Success status
   */
  async saveResume(name, resumeData) {
    try {
      // Get existing resumes
      const existingResumes = await this.getAllResumes();
      
      // Add or update this resume
      existingResumes[name] = {
        data: resumeData,
        updatedAt: new Date().toISOString()
      };
      
      // Save to storage
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: existingResumes });
      
      // If this is the first resume, set it as active
      const activeResume = await this.getActiveResumeName();
      if (!activeResume) {
        await this.setActiveResume(name);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving resume:', error);
      return false;
    }
  }

  /**
   * Get all stored resumes
   * @returns {Promise<Object>} - Map of resume names to data
   */
  async getAllResumes() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || {};
    } catch (error) {
      console.error('Error retrieving resumes:', error);
      return {};
    }
  }

  /**
   * Get a specific resume by name
   * @param {string} name - Name of the resume to retrieve
   * @returns {Promise<Object|null>} - Resume data or null if not found
   */
  async getResume(name) {
    try {
      const resumes = await this.getAllResumes();
      return resumes[name]?.data || null;
    } catch (error) {
      console.error(`Error retrieving resume "${name}":`, error);
      return null;
    }
  }

  /**
   * Delete a resume from storage
   * @param {string} name - Name of the resume to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteResume(name) {
    try {
      const resumes = await this.getAllResumes();
      
      if (!resumes[name]) {
        return false; // Resume doesn't exist
      }
      
      // Delete the resume
      delete resumes[name];
      
      // Update storage
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: resumes });
      
      // If this was the active resume, clear active resume
      const activeResume = await this.getActiveResumeName();
      if (activeResume === name) {
        // Set to the first available resume or clear
        const remainingNames = Object.keys(resumes);
        if (remainingNames.length > 0) {
          await this.setActiveResume(remainingNames[0]);
        } else {
          await chrome.storage.sync.remove(this.ACTIVE_RESUME_KEY);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting resume "${name}":`, error);
      return false;
    }
  }

  /**
   * Set the active resume to use for autofill
   * @param {string} name - Name of the resume to set as active
   * @returns {Promise<boolean>} - Success status
   */
  async setActiveResume(name) {
    try {
      // Verify this resume exists
      const resumes = await this.getAllResumes();
      if (!resumes[name]) {
        return false; // Resume doesn't exist
      }
      
      // Set as active
      await chrome.storage.sync.set({ [this.ACTIVE_RESUME_KEY]: name });
      return true;
    } catch (error) {
      console.error(`Error setting active resume to "${name}":`, error);
      return false;
    }
  }

  /**
   * Get the name of the currently active resume
   * @returns {Promise<string|null>} - Name of active resume or null
   */
  async getActiveResumeName() {
    try {
      const result = await chrome.storage.sync.get(this.ACTIVE_RESUME_KEY);
      return result[this.ACTIVE_RESUME_KEY] || null;
    } catch (error) {
      console.error('Error getting active resume:', error);
      return null;
    }
  }

  /**
   * Get the active resume data
   * @returns {Promise<Object|null>} - Active resume data or null
   */
  async getActiveResume() {
    const activeName = await this.getActiveResumeName();
    if (!activeName) return null;
    
    return this.getResume(activeName);
  }
  
  /**
   * Save field mappings for a specific domain
   * @param {string} domain - Domain name (e.g., "linkedin.com")
   * @param {Object} mappings - Field mappings object
   * @returns {Promise<boolean>} - Success status
   */
  async saveFieldMappings(domain, mappings) {
    try {
      // Get existing mappings
      const existingMappings = await this.getAllFieldMappings();
      
      // Add or update mappings for this domain
      existingMappings[domain] = mappings;
      
      // Save to storage
      await chrome.storage.sync.set({ [this.FIELD_MAPPINGS_KEY]: existingMappings });
      return true;
    } catch (error) {
      console.error(`Error saving field mappings for "${domain}":`, error);
      return false;
    }
  }

  /**
   * Get field mappings for a specific domain
   * @param {string} domain - Domain name
   * @returns {Promise<Object|null>} - Field mappings or null if not found
   */
  async getFieldMappings(domain) {
    try {
      const mappings = await this.getAllFieldMappings();
      return mappings[domain] || null;
    } catch (error) {
      console.error(`Error retrieving field mappings for "${domain}":`, error);
      return null;
    }
  }

  /**
   * Get all field mappings for all domains
   * @returns {Promise<Object>} - Map of domain names to field mappings
   */
  async getAllFieldMappings() {
    try {
      const result = await chrome.storage.sync.get(this.FIELD_MAPPINGS_KEY);
      return result[this.FIELD_MAPPINGS_KEY] || {};
    } catch (error) {
      console.error('Error retrieving field mappings:', error);
      return {};
    }
  }

  /**
   * Delete field mappings for a specific domain
   * @param {string} domain - Domain name
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFieldMappings(domain) {
    try {
      const mappings = await this.getAllFieldMappings();
      
      if (!mappings[domain]) {
        return false; // Mappings don't exist
      }
      
      // Delete the mappings
      delete mappings[domain];
      
      // Update storage
      await chrome.storage.sync.set({ [this.FIELD_MAPPINGS_KEY]: mappings });
      return true;
    } catch (error) {
      console.error(`Error deleting field mappings for "${domain}":`, error);
      return false;
    }
  }
}

// Export the storage manager
window.ResumeStorageManager = ResumeStorageManager;