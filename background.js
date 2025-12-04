// In-memory state, acts as a cache. The source of truth is chrome.storage.local.
// With "incognito": "split", each mode (normal/incognito) gets its own instance of this script,
// so this state is not shared between them.
let sessionState = {
  popupWindowId: null,
  originalMainWindowId: null,
  originalMainWindowBounds: null,
};

// Function to initialize state from storage.
async function initStateFromStorage() {
  const stored = await chrome.storage.local.get('session');
  if (stored.session && stored.session.popupWindowId) {
    try {
      await chrome.windows.get(stored.session.popupWindowId);
      sessionState = stored.session;
      console.log("Session state restored from storage.", sessionState);
    } catch (e) {
      console.log("Stale session found in storage. Clearing.");
      await clearSession();
    }
  }
}

// Function to clear session from storage and memory.
async function clearSession() {
  await chrome.storage.local.remove('session');
  sessionState = {
    popupWindowId: null,
    originalMainWindowId: null,
    originalMainWindowBounds: null,
  };
  console.log("Session cleared.");
}

// Add listeners to initialize state on startup and clear on install/update.
chrome.runtime.onStartup.addListener(initStateFromStorage);
chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.openOptionsPage();
  clearSession();
});

chrome.action.onClicked.addListener(async (tab) => {
  await initStateFromStorage();

  const { aiSiteUrl, defaultAiSiteUrl } = await chrome.storage.sync.get(['aiSiteUrl', 'defaultAiSiteUrl']);
  const url = aiSiteUrl || defaultAiSiteUrl || 'https://www.perplexity.ai/';

  // --- Cleanup Safety Net ---
  const potentialTabs = await chrome.tabs.query({ url: `${new URL(url).origin}/*` });
  for (const t of potentialTabs) {
    try {
      const win = await chrome.windows.get(t.windowId);
      if (win.type === 'popup' && win.id !== sessionState.popupWindowId) {
        console.log(`Cleaning up orphaned popup window: ${win.id}`);
        await chrome.windows.remove(win.id);
      }
    } catch (e) { /* Ignore errors */ }
  }
  // --- End Cleanup ---

  const displayInfo = await chrome.system.display.getInfo();
  const primaryDisplay = displayInfo.find(d => d.isPrimary) || displayInfo[0];
  const screenWidth = primaryDisplay.workArea.width;
  const screenHeight = primaryDisplay.workArea.height;
  const mobilePopupWidth = 400;
  const newMainWindowWidth = screenWidth - mobilePopupWidth;

  // --- Toggle Logic ---
  if (sessionState.popupWindowId !== null) {
    try {
      const popupWindow = await chrome.windows.get(sessionState.popupWindowId);
      if (popupWindow.state === 'minimized' || popupWindow.state === 'maximized') {
        // --- SHOW ---
        const popupTabs = await chrome.tabs.query({ windowId: sessionState.popupWindowId });
        if (popupTabs.length > 0) {
          try {
            await chrome.tabs.setZoom(popupTabs[0].id, 0); // Reset zoom
          } catch (e) {
            console.log("Could not set zoom on tab, it might have been closed or is inaccessible.", e);
          }
        }
        await chrome.windows.update(sessionState.popupWindowId, {
          left: screenWidth - mobilePopupWidth,
          top: 0,
          width: mobilePopupWidth,
          height: screenHeight,
          state: 'normal',
          focused: true
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
          // Always maximize the main window when hiding the popup.
          await chrome.windows.update(sessionState.originalMainWindowId, {
            state: "maximized"
          });
        }
      }
    } catch (e) {
      console.log("Tracked popup window not found, clearing session.", e);
      await clearSession();
      // We return here, forcing user to click again to create a new window.
    }
    return;
  }

  // --- Create Logic ---
  const currentWindow = await chrome.windows.get(tab.windowId);
  
  sessionState.originalMainWindowId = currentWindow.id;
  sessionState.originalMainWindowBounds = {
    left: currentWindow.left, top: currentWindow.top, width: currentWindow.width,
    height: currentWindow.height, state: currentWindow.state
  };
  await chrome.windows.update(currentWindow.id, {
    left: 0, top: 0, width: newMainWindowWidth, height: screenHeight, state: "normal"
  });

  const newPopupWindow = await chrome.windows.create({
    url: url,
    type: 'popup',
    left: screenWidth - mobilePopupWidth,
    top: 0,
    width: mobilePopupWidth,
    height: screenHeight,
  });
  if (newPopupWindow.tabs && newPopupWindow.tabs.length > 0) {
    try {
      await chrome.tabs.setZoom(newPopupWindow.tabs[0].id, 0); // Reset zoom on creation
    } catch (e) {
      console.log("Could not set zoom on new tab, it might have been closed or is inaccessible.", e);
    }
  }
  sessionState.popupWindowId = newPopupWindow.id;

  await chrome.storage.local.set({ session: sessionState });
  console.log("Session state saved.", sessionState);
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
        console.log("Could not restore main window, it might have been closed.", e);
      }
    }
    await clearSession();
  }
});
