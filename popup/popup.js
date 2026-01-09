// Popup script

let currentTab = null;

// Check Mycelica connection status
async function checkStatus() {
  const statusEl = document.getElementById("status");
  const response = await browser.runtime.sendMessage({ action: "status" });
  
  if (response.connected) {
    statusEl.textContent = "Connected";
    statusEl.className = "status connected";
  } else {
    statusEl.textContent = "Not running";
    statusEl.className = "status disconnected";
  }
}

// Load current tab info
async function loadCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  
  document.getElementById("page-title").textContent = currentTab.title;
  document.getElementById("page-url").textContent = currentTab.url;
}

// Save current page
async function savePage() {
  const note = document.getElementById("note").value;
  const button = document.getElementById("save-page");
  
  button.disabled = true;
  button.textContent = "Saving...";
  
  const response = await browser.runtime.sendMessage({
    action: "capture",
    data: {
      title: currentTab.title,
      url: currentTab.url,
      content: note,
      timestamp: Date.now()
    }
  });
  
  if (response.success) {
    button.textContent = "Saved!";
    setTimeout(() => window.close(), 500);
  } else {
    button.textContent = "Error - Try again";
    button.disabled = false;
  }
}

// Open sidebar
function openSidebar() {
  browser.sidebarAction.open();
  window.close();
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  checkStatus();
  loadCurrentTab();
  
  document.getElementById("save-page").addEventListener("click", savePage);
  document.getElementById("open-sidebar").addEventListener("click", openSidebar);
});
