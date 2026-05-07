// background.js — Adds a right-click context menu option
// so users can normalize a selected address on any webpage

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "normalize-address",
    title: "Normalize address with AI",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "normalize-address" && info.selectionText) {
    // Store selected text then open the popup
    chrome.storage.local.set({ pendingAddress: info.selectionText.trim() }, () => {
      chrome.action.openPopup?.() ?? chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 400,
        height: 560,
      });
    });
  }
});
