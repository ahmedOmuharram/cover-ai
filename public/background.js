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
    // Open the side panel first
    chrome.sidePanel.open({ tabId: tab.id })
      .then(() => {
        console.log("Side panel opened for tab:", tab.id);
        // Send a message to the side panel (or other parts of the extension)
        // Add a small delay to potentially allow the side panel UI to initialize
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "JOB_DESCRIPTION_TEXT", // Message type identifier
                payload: { text: selectedText } // Data payload
            }).catch(error => console.error('Error sending message:', error)); // Add error handling for sendMessage
        }, 100); // 100ms delay
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

// Optional: Clear badge when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // No need to check URL, just clear any potential badge
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    console.log('Badge cleared for closed tab:', tabId);
});

console.log("Background script loaded and badge logic added.");
