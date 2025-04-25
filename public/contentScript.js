// contentScript.js - This script runs in the context of the website

// Function to scrape job description from LinkedIn page
function scrapeJobDescription() {
  // List of selectors where job descriptions are usually found
  const selectors = [
    'div.jobs-description__content',                  // LinkedIn specific
    'div.show-more-less-html__markup',                 // LinkedIn expandable section
    'div.description__text',                           // Fallback for other job platforms
    '[data-test-description-section]',                 // Generic attribute
    'section[class*="job-description"]',               // Some sites use job-description in section
    'div[class*="description"]',                       // General description fallback
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText.trim().length > 50) {  // Avoid super tiny false positives
      console.log(`✅ Scraped job description using selector: ${selector}`);
      return element.innerText.trim();
    }
  }

  // Try to scrape based on visible <article> tag if no selectors match
  const articleElement = document.querySelector('article');
  if (articleElement && articleElement.innerText.trim().length > 100) {
    console.log('✅ Scraped job description from <article> element.');
    return articleElement.innerText.trim();
  }

  // Final fallback
  console.warn('⚠️ Could not find a job description on this page.');
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

