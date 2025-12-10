// In-memory state, acts as a cache. The source of truth is chrome.storage.local.
let sessionState = {
  popupWindowId: null,
  originalMainWindowId: null,
  originalMainWindowBounds: null,
};

// --- Core Function to Open/Update the Side Panel ---
async function openOrUpdateSidePanel(newUrl) { // The URL for a new site, or null for a toggle
  await initStateFromStorage();

  let targetUrl = newUrl;
  if (!targetUrl) {
    // If no URL is provided for opening, it's a toggle. Use the last-used URL.
    const result = await chrome.storage.local.get('lastUsedUrl');
    if (result.lastUsedUrl) {
      targetUrl = result.lastUsedUrl;
    } else {
      // Fallback to the first site in sync storage or a hardcoded default.
      const syncData = await chrome.storage.sync.get({ sites: [{ url: 'https://www.perplexity.ai/' }] });
      targetUrl = syncData.sites[0].url;
    }
  } else {
    // If a new URL was provided, save it as the last-used for future toggles.
    await chrome.storage.local.set({ lastUsedUrl: newUrl });
  }

  const displayInfo = await chrome.system.display.getInfo();
  const primaryDisplay = displayInfo.find(d => d.isPrimary) || displayInfo[0];
  const screenWidth = primaryDisplay.workArea.width;
  const screenHeight = primaryDisplay.workArea.height;
  const mobilePopupWidth = 400;
  const newMainWindowWidth = screenWidth - mobilePopupWidth;

  // If a popup window is already tracked
  if (sessionState.popupWindowId !== null) {
    try {
      const popupWindow = await chrome.windows.get(sessionState.popupWindowId, { populate: true });
      const popupTab = popupWindow.tabs && popupWindow.tabs[0];

      // If a new URL was explicitly passed and it's different, update the tab.
      if (newUrl && popupTab && popupTab.url !== newUrl) {
        await chrome.tabs.update(popupTab.id, { url: newUrl });
      }

      // --- Toggle Visibility Logic ---
      // SHOW if: a) a new URL was clicked, or b) it's a toggle for a minimized window.
      // HIDE if: it's a toggle for an already visible window.
      if (newUrl || popupWindow.state === 'minimized') {
        // --- SHOW / FOCUS ---
        await chrome.windows.update(sessionState.popupWindowId, {
          left: screenWidth - mobilePopupWidth, top: 0, width: mobilePopupWidth, height: screenHeight,
          state: 'normal', focused: true
        });
        if (sessionState.originalMainWindowId) {
          await chrome.windows.update(sessionState.originalMainWindowId, {
            left: 0, top: 0, width: newMainWindowWidth, height: screenHeight, state: "normal"
          });
        }
      } else {
        // --- HIDE ---
        await chrome.windows.update(sessionState.popupWindowId, { state: 'minimized' });
        if (sessionState.originalMainWindowId) {
          await chrome.windows.update(sessionState.originalMainWindowId, { state: "maximized" });
        }
      }
      return; // Early exit after toggling/updating
    } catch (e) {
      console.log("Tracked popup window not found, clearing session.", e);
      await clearSession();
      // Fall through to creation logic
    }
  }

  // --- Create Logic ---
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  if (!currentWindow) return;

  sessionState.originalMainWindowId = currentWindow.id;
  sessionState.originalMainWindowBounds = {
    left: currentWindow.left, top: currentWindow.top, width: currentWindow.width,
    height: currentWindow.height, state: currentWindow.state
  };
  await chrome.windows.update(currentWindow.id, {
    left: 0, top: 0, width: newMainWindowWidth, height: screenHeight, state: "normal"
  });

  const newPopupWindow = await chrome.windows.create({
    url: targetUrl, type: 'popup',
    left: screenWidth - mobilePopupWidth, top: 0, width: mobilePopupWidth, height: screenHeight,
  });

  sessionState.popupWindowId = newPopupWindow.id;
  await chrome.storage.local.set({ session: sessionState });
  console.log("Session state saved.", sessionState);
}

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openSidePanel') {
    openOrUpdateSidePanel(request.url);
    sendResponse({ status: 'opening' });
  } else if (request.action === 'toggleSidePanel') {
    openOrUpdateSidePanel(null); // Pass null to toggle
    sendResponse({ status: 'toggling' });
  }
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-panel") {
    openOrUpdateSidePanel(null);
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (sessionState.popupWindowId && windowId === sessionState.popupWindowId) {
    console.log("Popup window was closed manually.");
    if (sessionState.originalMainWindowId && sessionState.originalMainWindowBounds) {
      try {
        await chrome.windows.update(sessionState.originalMainWindowId, {
          left: sessionState.originalMainWindowBounds.left,
          top: sessionState.originalMainWindowBounds.top,
          width: sessionState.originalMainWindowBounds.width,
          height: sessionState.originalMainWindowBounds.height,
          state: sessionState.originalMainWindowBounds.state
        });
      } catch (e) {
        console.log("Could not restore main window.", e);
      }
    }
    await clearSession();
  }
});

// --- Utility Functions for State Management ---
async function initStateFromStorage() {
  const stored = await chrome.storage.local.get('session');
  if (stored.session && stored.session.popupWindowId) {
    try {
      await chrome.windows.get(stored.session.popupWindowId);
      sessionState = stored.session;
    } catch (e) {
      await clearSession();
    }
  }
}

async function clearSession() {
  await chrome.storage.local.remove('session');
  sessionState = {
    popupWindowId: null,
    originalMainWindowId: null,
    originalMainWindowBounds: null,
  };
}

// --- Lifecycle Hooks ---
chrome.runtime.onStartup.addListener(initStateFromStorage);
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
  clearSession();
});