document.addEventListener('DOMContentLoaded', () => {
  const siteNameInput = document.getElementById('site-name');
  const siteUrlInput = document.getElementById('site-url');
  const addSiteButton = document.getElementById('add-site');
  const statusDiv = document.getElementById('status');
  const siteListUl = document.getElementById('site-list');

  const defaultSites = [
    { name: 'Perplexity', url: 'https://www.perplexity.ai/' },
    { name: 'Google', url: 'https://www.google.com/' }
  ];

  // --- Functions ---

  const saveSites = (sites) => {
    chrome.storage.sync.set({ sites: sites }, () => {
      statusDiv.textContent = 'Options saved.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 1500);
      renderSites();
    });
  };

  const renderSites = () => {
    chrome.storage.sync.get({ sites: defaultSites }, (data) => {
      siteListUl.innerHTML = ''; // Clear current list
      const sites = data.sites;

      if (sites && sites.length > 0) {
        sites.forEach((site, index) => {
          const listItem = document.createElement('li');
          listItem.className = 'site-item';
          listItem.innerHTML = `
            <div>
              <span>${site.name}</span>
              <span class="url">${site.url}</span>
            </div>
            <button class="remove-btn" data-index="${index}">Remove</button>
          `;
          siteListUl.appendChild(listItem);
        });
      } else {
        siteListUl.innerHTML = '<li>No sites saved. Add one above.</li>';
      }
    });
  };

  const addSite = () => {
    const name = siteNameInput.value.trim();
    const url = siteUrlInput.value.trim();

    if (name && url) {
      try {
        new URL(url); // Validate URL
      } catch (e) {
        statusDiv.textContent = 'Invalid URL format.';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        return;
      }

      chrome.storage.sync.get({ sites: defaultSites }, (data) => {
        const sites = data.sites;
        sites.push({ name, url });
        saveSites(sites);
        siteNameInput.value = '';
        siteUrlInput.value = '';
      });
    } else {
      statusDiv.textContent = 'Please provide both a name and a URL.';
      setTimeout(() => { statusDiv.textContent = ''; }, 2000);
    }
  };

  const removeSite = (index) => {
    chrome.storage.sync.get({ sites: defaultSites }, (data) => {
      const sites = data.sites;
      sites.splice(index, 1);
      saveSites(sites);
    });
  };

  // --- Event Listeners ---

  addSiteButton.addEventListener('click', addSite);

  siteUrlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSiteButton.click();
    }
  });
  
  siteNameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSiteButton.click();
    }
  });

  siteListUl.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-btn')) {
      const index = parseInt(event.target.getAttribute('data-index'), 10);
      removeSite(index);
    }
  });

  // --- Initial Load ---
  renderSites();
});
