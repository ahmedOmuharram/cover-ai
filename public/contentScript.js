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
  return '⚠️ Could not find job description on this page.';
}

let lastUrl = location.href;

new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log('[contentScript] Detected URL change:', currentUrl);
    lastUrl = currentUrl;
    hasScraped = false;
    setTimeout(() => {
      sendJobDescription(); // Rescrape when page changes
    }, 500); // Wait a bit for LinkedIn to load content
  }
}).observe(document, { subtree: true, childList: true });

let hasScraped = false;

function sendJobDescription() {
  if (hasScraped) return;
  const jobDescription = scrapeJobDescription();

  if (jobDescription.startsWith('⚠️')) return; // skip if failed

  hasScraped = true;
  console.log('Scraped job description:', jobDescription?.substring(0, 100) + '...');

  // Check if the job description is empty
  if (!jobDescription || jobDescription.trim() === '') {
    console.log('⚠️ Job description is empty or invalid, skipping message.');
    return;
  }

  chrome.runtime.sendMessage({
    type: 'SCRAPED_JOB_DESCRIPTION',
    payload: { text: jobDescription }
  }, (response) => {
    // Check for errors immediately, especially context invalidated
    if (chrome.runtime.lastError) {
      // Just return silently if context is invalidated or another error occurs.
      return; 
    }
    
    // Handle successful response if needed
    if (response?.status === 'received') {
      console.log("Background script confirmed receipt.");
    }
  });
}

// Execute scraping with a slight delay to allow page to fully load
setTimeout(() => {
  sendJobDescription();
}, 500);
