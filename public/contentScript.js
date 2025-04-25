// contentScript.js - This script runs in the context of the website

// Function to scrape job description from LinkedIn page
function scrapeJobDescription() {
  // TODO: Implement the actual scraping logic here
  // return 'PLACEHOLDER';
  const selectors = [
    'div.jobs-description__content',
    'div.show-more-less-html__markup',
    'div.description__text', // fallback for other job sites
    '[data-test-description-section]' // some platforms use data-* attributes
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el.innerText.trim();
  }

  return '⚠️ Could not find job description on this page.';
}

let hasScraped = false;

function sendJobDescription() {
  if (hasScraped) return;
  const jobDescription = scrapeJobDescription();

  if (jobDescription.startsWith('⚠️')) return; // skip if failed

  hasScraped = true;
  console.log('Scraped job description:', jobDescription?.substring(0, 100) + '...');

  chrome.runtime.sendMessage({
    type: 'SCRAPED_JOB_DESCRIPTION',
    payload: { text: jobDescription }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending job description:', chrome.runtime.lastError);
    } else {
      console.log('Job description sent successfully, response:', response);
    }
  });
}
/*
// Function to send the scraped description to the background script
function sendJobDescription() {
  const jobDescription = scrapeJobDescription();
  console.log('Scraped job description:', jobDescription?.substring(0, 100) + '...');
  
  // Send the job description to the background script
  chrome.runtime.sendMessage({
    type: 'SCRAPED_JOB_DESCRIPTION',
    payload: { text: jobDescription }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending job description:', chrome.runtime.lastError);
    } else {
      console.log('Job description sent successfully, response:', response);
    }
  });
}
*/

// Execute scraping with a slight delay to allow page to fully load
setTimeout(() => {
  sendJobDescription();
}, 500);

// Also set up a MutationObserver to detect changes in the page (LinkedIn often loads content dynamically)
const observer = new MutationObserver((mutations) => {
  // Check if any mutation added job description elements
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // If significant changes happened, try to scrape again
      sendJobDescription();
      break; // Only need to scrape once per mutation batch
    }
  }
});

// Start observing changes to the DOM
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Clean up observer after 10 seconds - LinkedIn should be fully loaded by then
setTimeout(() => {
  observer.disconnect();
}, 10000); 