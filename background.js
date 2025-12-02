let popupWindowId = null;
let originalMainWindowId = null; // Stores the ID of the main window
let originalMainWindowBounds = null; // Stores {left, top, width, height, state} of the main window

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.action.onClicked.addListener(async () => {
  chrome.storage.sync.get(['aiSiteUrl', 'defaultAiSiteUrl'], async (result) => {
    const url = result.aiSiteUrl || result.defaultAiSiteUrl || 'https://www.perplexity.ai/';
    
    // Get display info (needed for screen dimensions)
    const displayInfo = await chrome.system.display.getInfo();
    const primaryDisplay = displayInfo.find(display => display.isPrimary) || displayInfo[0];
    const screenWidth = primaryDisplay.workArea.width;
    const screenHeight = primaryDisplay.workArea.height;
    const mobilePopupWidth = 400; // Example mobile width
    const newMainWindowWidth = screenWidth - mobilePopupWidth;
    const popupLeftPosition = screenWidth - mobilePopupWidth;

    // --- Toggle Logic ---
    if (popupWindowId !== null) {
      try {
        const popupWindow = await chrome.windows.get(popupWindowId);
        // If popup exists and is visible (normal/focused state)
        if (popupWindow.state === "normal" || popupWindow.state === "focused") {
          // Minimize popup
          await chrome.windows.update(popupWindowId, { state: "minimized" });
          // Maximize main window
          if (originalMainWindowId !== null) {
            await chrome.windows.update(originalMainWindowId, { state: "maximized" });
          }
        } 
        // If popup exists and is minimized
        else if (popupWindow.state === "minimized") {
          // Restore popup to split-screen position
          await chrome.windows.update(popupWindowId, { 
            focused: true, 
            state: "normal",
            left: popupLeftPosition,
            top: 0,
            width: mobilePopupWidth,
            height: screenHeight
          });
          // Resize main window to left half
          if (originalMainWindowId !== null) {
            await chrome.windows.update(originalMainWindowId, { 
              left: 0, 
              top: 0, 
              width: newMainWindowWidth, 
              height: screenHeight, 
              state: "normal" 
            });
          }
        }
        return; // Exit after toggling
      } catch (e) {
        // Popup window might have been closed manually by user, clear state and proceed to create
        console.log("Popup window not found, clearing state and recreating.", e);
        popupWindowId = null;
        originalMainWindowId = null;
        originalMainWindowBounds = null; // Clear bounds too, as main window might be maximized
      }
    }

    // --- Create Logic (if popupWindowId is null) ---
    const currentWindow = await chrome.windows.getCurrent();
    originalMainWindowId = currentWindow.id;
    originalMainWindowBounds = { 
      left: currentWindow.left, 
      top: currentWindow.top, 
      width: currentWindow.width, 
      height: currentWindow.height,
      state: currentWindow.state // Store original state (e.g., maximized)
    };

    // Update the current window to take the left portion
    await chrome.windows.update(currentWindow.id, {
      left: 0,
      top: 0,
      width: newMainWindowWidth,
      height: screenHeight,
      state: "normal" // Ensure it's not minimized or maximized
    });

    // Create the new popup window with mobile width on the right
    const newPopupWindow = await chrome.windows.create({
      url: url,
      type: 'popup',
      left: popupLeftPosition,
      top: 0,
      width: mobilePopupWidth,
      height: screenHeight
    });
    popupWindowId = newPopupWindow.id;
  });
});

// Listener to handle manual closing of the popup window by the user
chrome.windows.onRemoved.addListener(async windowId => {
  if (windowId === popupWindowId) {
    console.log("Popup window was closed manually by user.");
    // Restore main window to its original state (or maximize if that was the original state)
    if (originalMainWindowId !== null && originalMainWindowBounds !== null) {
      await chrome.windows.update(originalMainWindowId, {
        left: originalMainWindowBounds.left,
        top: originalMainWindowBounds.top,
        width: originalMainWindowBounds.width,
        height: originalMainWindowBounds.height,
        state: originalMainWindowBounds.state // Restore original state
      });
    }
    // Clear state variables
    popupWindowId = null;
    originalMainWindowId = null;
    originalMainWindowBounds = null;
  }
});
