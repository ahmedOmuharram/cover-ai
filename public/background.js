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

console.log("Background script loaded and context menu configured."); // Add a log
