// This function is called when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Create a context menu item
  // See: https://developer.chrome.com/docs/extensions/reference/api/contextMenus#method-create
  chrome.contextMenus.create({
    id: "generateWithText", // Updated unique identifier
    title: "Generate with text as job description", // Updated text
    contexts: ["selection"], // Show only when text is selected
  });
});

// This function is called when a context menu item is clicked
// See: https://developer.chrome.com/docs/extensions/reference/api/contextMenus#event-onClicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Check if the clicked menu item is 'generateWithText' and text is selected
  if (info.menuItemId === "generateWithText" && info.selectionText && tab?.id) {
    const selectedText = info.selectionText; // Get the selected text
    console.log("Selected text for job description:", selectedText);

    // Open the side panel first
    chrome.sidePanel.open({ tabId: tab.id })
      .then(() => {
        console.log("Side panel opened for tab:", tab.id);
        // Send a message to the side panel with the highlighted text (which takes priority)
        chrome.storage.local.set({
          jobDescription: selectedText,
          jobDescriptionSource: 'highlight'
        });
      })
      .catch(error => console.error('Error opening side panel or sending message:', error));
  }
});

// Handle the toolbar icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if the click happened on a valid tab with an ID
  if (tab.id) {
    // Open the side panel using tabId for better context
    chrome.sidePanel.open({ tabId: tab.id })
      .then(() => {
        // If we have a scraped job description and we're on a LinkedIn job page, send it
        if (lastScrapedJobDescription && 
            (tab.url?.startsWith('https://www.linkedin.com/jobs/view/') ||
             tab.url?.startsWith('https://www.linkedin.com/jobs/collections/'))) {
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'JOB_DESCRIPTION_TEXT',
              payload: { text: lastScrapedJobDescription, source: 'scraper' }
            }).catch(error => {
              console.error('Error sending job description on action click:', error);
            });
          }, 100);
        }
      })
      .catch(error => console.error('Error opening side panel on action click:', error));
  }
});

// Listener for Tab Updates (URL changes & Badge Management)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We need the tab object and specifically its URL to make decisions
  // Check if the update is for the currently active tab, as we only want to badge the active tab's state
  chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      // Ensure we have an active tab and it's the one being updated
      if (activeTabs && activeTabs.length > 0 && activeTabs[0].id === tabId) {
        const currentTab = activeTabs[0]; // Use the reliable tab info from query
        // Use the URL from the tab object from the query, or fallback to changeInfo if tab url is undefined (less likely)
        const currentUrl = currentTab.url || changeInfo.url; 

        if (currentUrl && (currentUrl.startsWith('https://www.linkedin.com/jobs/view/') || currentUrl.startsWith('https://www.linkedin.com/jobs/collections/'))) {
          // Set a badge (e.g., a red dot)
          chrome.action.setBadgeText({ text: '!', tabId: tabId}); // Use space for a dot effect
          chrome.action.setBadgeBackgroundColor({ color: '#CB112D', tabId: tabId }); // Red color
          chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId: tabId }); // White text
          console.log('Badge set for tab:', tabId);
        } else {
          // If the URL doesn't match, clear the badge for this tab
          // Check if badge was potentially set before clearing
          chrome.action.getBadgeText({ tabId: tabId }, (badgeText) => {
            if (badgeText) { // Only clear if there is a badge
                 chrome.action.setBadgeText({ text: '', tabId: tabId });
                 console.log('Badge cleared for tab:', tabId);
            }
          });
        }
      } else if (activeTabs && activeTabs.length > 0 && activeTabs[0].id !== tabId) {
          // Handle cases where the updated tab is NOT the active one - clear its badge if it had one
          // Optional: depends if you want badges only on active tab or persistent on non-active tabs
          chrome.action.getBadgeText({ tabId: tabId }, (badgeText) => {
            if (badgeText) { 
                 chrome.action.setBadgeText({ text: '', tabId: tabId });
                 console.log('Badge cleared for non-active tab:', tabId);
            }
          });
      }
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // No need to check URL, just clear any potential badge
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    console.log('Badge cleared for closed tab:', tabId);
});

// Maintain a variable to store the most recently scraped job description
let lastScrapedJobDescription = '';

// Listen for messages from content script with scraped job descriptions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPED_JOB_DESCRIPTION' && message.payload?.text) {
    console.log('Background script received job description from content script');
    console.log('LastScraped (new):', message.payload.text.substring(0, 100) + '...');
    
    // Store the scraped description
    lastScrapedJobDescription = message.payload.text;
    console.log('lastScrapedJobDescription stored:', lastScrapedJobDescription.substring(0, 100) + '...');
    
    // If the tab has our side panel open, send the description to it
    /*
    if (sender.tab && sender.tab.id) {
      // Try to open the side panel for this tab
      chrome.sidePanel.open({ tabId: sender.tab.id })
        .then(() => {
          // Once open, send the description
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'JOB_DESCRIPTION_TEXT',
              payload: { text: lastScrapedJobDescription, source: 'scraper' }
            }).catch(error => {
              console.error('Error sending scraped job description to side panel:', error);
            });
          }, 100); // Give side panel a moment to initialize
        })
        .catch(error => {
          console.error('Error opening side panel for job description:', error);
        });
      
      // Add a badge to indicate job description is available
      chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#CB112D', tabId: sender.tab.id });
      chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId: sender.tab.id });
    }
    */
    if (sender.tab && sender.tab.id) {
      // No side panel open attempt here! ❌
      chrome.storage.local.set({
        jobDescription: lastScrapedJobDescription,
        jobDescriptionSource: 'scraper'
      });

    console.log('Stored in storage.local, sending badge change');
      chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#CB112D', tabId: sender.tab.id });
      chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId: sender.tab.id });
    }

    // Send a response to the content script
    sendResponse({ status: 'received' });
    return true; // Required to use sendResponse asynchronously
  }
});

console.log("Background script loaded and badge logic added.");
