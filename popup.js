document.addEventListener('DOMContentLoaded', () => {
  const siteListUl = document.getElementById('site-list');
  const openOptionsLi = document.getElementById('open-options');
  const togglePanelLi = document.getElementById('toggle-panel');
  const toggleShortcutSpan = document.getElementById('toggle-shortcut');

  const defaultSites = [
    { name: 'Perplexity', url: 'https://www.perplexity.ai/' },
    { name: 'Google', url: 'https://www.google.com/' }
  ];

  // --- Functions ---

  const renderSites = () => {
    chrome.storage.sync.get({ sites: defaultSites }, (data) => {
      siteListUl.innerHTML = ''; // Clear current list
      const sites = data.sites;

      if (sites && sites.length > 0) {
        sites.forEach((site) => {
          const listItem = document.createElement('li');
          listItem.className = 'site-item';
          listItem.dataset.url = site.url;
          
          const mainDiv = document.createElement('div');
          mainDiv.className = 'site-item-main';

          const img = document.createElement('img');
          img.src = `https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`;
          img.alt = `${site.name} favicon`;

          const span = document.createElement('span');
          span.textContent = site.name;

          mainDiv.appendChild(img);
          mainDiv.appendChild(span);
          listItem.appendChild(mainDiv);
          siteListUl.appendChild(listItem);
        });
      } else {
        siteListUl.innerHTML = '<li>No sites configured.</li>';
      }
    });
  };

  const displayShortcut = () => {
    chrome.commands.getAll((commands) => {
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-panel');
      if (toggleCommand && toggleCommand.shortcut) {
        toggleShortcutSpan.textContent = toggleCommand.shortcut;
      }
    });
  };

  // --- Event Listeners ---

  siteListUl.addEventListener('click', (event) => {
    const targetLi = event.target.closest('li');
    if (targetLi && targetLi.dataset.url) {
      const url = targetLi.dataset.url;
      chrome.runtime.sendMessage({ action: 'openSidePanel', url: url }, () => {
        window.close();
      });
    }
  });

  togglePanelLi.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'toggleSidePanel' }, () => {
      window.close();
    });
  });

  openOptionsLi.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // --- Initial Load ---
  renderSites();
  displayShortcut();
});
