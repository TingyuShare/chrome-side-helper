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

  // --- Toggle Off Logic ---
  if (sessionState.popupWindowId !== null) {
    try {
      await chrome.windows.get(sessionState.popupWindowId);
      // A session is active, so turn it off.
      await chrome.windows.update(sessionState.popupWindowId, { state: "minimized" });
      if (sessionState.originalMainWindowId && sessionState.originalMainWindowBounds) {
        await chrome.windows.update(sessionState.originalMainWindowId, {
          state: sessionState.originalMainWindowBounds.state
        });
      }
      await clearSession();
    } catch (e) {
      console.log("Popup window not found, clearing session.", e);
      await clearSession();
    }
    return;
  }

  // --- Create Logic ---
  const currentWindow = await chrome.windows.get(tab.windowId);
  const displayInfo = await chrome.system.display.getInfo();
  const primaryDisplay = displayInfo.find(d => d.isPrimary) || displayInfo[0];
  const screenWidth = primaryDisplay.workArea.width;
  const screenHeight = primaryDisplay.workArea.height;
  const mobilePopupWidth = 400;
  const newMainWindowWidth = screenWidth - mobilePopupWidth;
  const popupLeftPosition = screenWidth - mobilePopupWidth;

  // Store main window state and resize it.
  sessionState.originalMainWindowId = currentWindow.id;
  sessionState.originalMainWindowBounds = {
    left: currentWindow.left, top: currentWindow.top, width: currentWindow.width,
    height: currentWindow.height, state: currentWindow.state
  };
  await chrome.windows.update(currentWindow.id, {
    left: 0, top: 0, width: newMainWindowWidth, height: screenHeight, state: "normal"
  });

  // Create the popup window.
  const newPopupWindow = await chrome.windows.create({
    url: url,
    type: 'popup',
    left: popupLeftPosition,
    top: 0,
    width: mobilePopupWidth,
    height: screenHeight,
  });
  sessionState.popupWindowId = newPopupWindow.id;

  // Persist the session state.
  await chrome.storage.local.set({ session: sessionState });
  console.log("Session state saved.", sessionState);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  // Check if the closed window is the one we are tracking.
  if (sessionState.popupWindowId && windowId === sessionState.popupWindowId) {
    console.log("Popup window was closed manually.");
    // Restore the main window if we have its state.
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
    // The session is over.
    await clearSession();
  }
});
