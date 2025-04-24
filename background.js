/**
 * Background Service Worker
 * Handles communication between different parts of the extension
 */

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on initial installation
    chrome.runtime.openOptionsPage();
  }
});

// Listen for messages from popup, content scripts, or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getActiveTabInfo') {
    // Get information about the active tab
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0) {
          sendResponse({
            success: true,
            url: tabs[0].url,
            domain: new URL(tabs[0].url).hostname,
            tabId: tabs[0].id
          });
        } else {
          sendResponse({
            success: false,
            message: 'No active tab found'
          });
        }
      })
      .catch(error => {
        console.error('Error getting active tab:', error);
        sendResponse({
          success: false,
          message: 'Error getting active tab info'
        });
      });
    
    return true; // Required for async sendResponse
  }
  
  else if (message.action === 'executeInTab') {
    // Execute a function in a specific tab
    const { tabId, function: func, params } = message;
    
    chrome.tabs.sendMessage(tabId, { action: func, ...params })
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error(`Error executing ${func} in tab ${tabId}:`, error);
        sendResponse({
          success: false,
          message: `Error executing function in tab: ${error.message}`
        });
      });
    
    return true; // Required for async sendResponse
  }
  
  else if (message.action === 'getExtensionInfo') {
    // Get information about the extension itself
    const manifest = chrome.runtime.getManifest();
    
    sendResponse({
      success: true,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description
    });
    
    return false; // Synchronous response
  }
});

// Handle browser action click (extension icon)
chrome.action.onClicked.addListener((tab) => {
  // If the extension doesn't have a popup, you can open the popup programmatically
  // or execute some action immediately
  
  // In our case, we have a popup defined in manifest.json, so this won't trigger
  // But we'll keep it as a fallback
  
  if (tab.url.startsWith('http')) {
    // Check if we're on a webpage (not a chrome:// or extension:// page)
    chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
  }
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the page has finished loading and is a job application page
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    // Get settings to check if auto-fill is enabled
    chrome.storage.sync.get('jobfiller_settings')
      .then(settings => {
        const autofillOnLoad = settings.jobfiller_settings?.autofillOnLoad || false;
        
        if (autofillOnLoad) {
          // Inject the content script if it hasn't been injected yet
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          }).catch(error => {
            // Ignore errors about content scripts already being injected
            if (!error.message.includes('already exists')) {
              console.error('Error injecting content script:', error);
            }
          });
        }
      })
      .catch(error => {
        console.error('Error getting settings:', error);
      });
  }
});