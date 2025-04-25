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

// Replace scraping triggers with a 100ms retry interval only on LinkedIn job pages
;(function() {
  let hasScraped = false;
  let lastHref = location.href;
  const retryInterval = setInterval(() => {
    const isLinkedInJobPage =
      location.href.startsWith('https://www.linkedin.com/jobs/view/') ||
      location.href.startsWith('https://www.linkedin.com/jobs/collections/');
    if (!isLinkedInJobPage) return;

    if (location.href !== lastHref) {
      lastHref = location.href;
      hasScraped = false;
      console.log('🔄 URL changed, resetting scraper');
    }

    if (!hasScraped) {
      const jobDescription = scrapeJobDescription();
      if (!jobDescription.startsWith('⚠️')) {
        hasScraped = true;
        console.log('✅ Scraped job description:', jobDescription.substring(0, 100) + '...');
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
    }
  }, 100);
})();

