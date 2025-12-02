const urlInput = document.getElementById('url');
const saveButton = document.getElementById('save');
const statusDiv = document.getElementById('status');

// Load the saved URL when the options page is opened
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['aiSiteUrl'], (result) => {
    if (result.aiSiteUrl) {
      urlInput.value = result.aiSiteUrl;
    }
  });
});

// Save the URL when the save button is clicked
saveButton.addEventListener('click', () => {
  const url = urlInput.value;
  if (url) {
    chrome.storage.sync.set({ aiSiteUrl: url }, () => {
      statusDiv.textContent = 'Options saved.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 1500);
    });
  } else {
    // If URL is empty, remove it from storage so default is used
    chrome.storage.sync.remove('aiSiteUrl', () => {
      statusDiv.textContent = 'Using default URL.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 1500);
    });
  }
});