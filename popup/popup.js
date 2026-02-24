// Popup script

let currentTab = null;

// Format duration from milliseconds
function formatDuration(ms) {
  if (!ms || ms < 0) return "--";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Check connection status, session info, and pairing
async function checkStatus() {
  const statusEl = document.getElementById("status");
  const sessionSection = document.getElementById("session-section");
  const pairBar = document.getElementById("pair-bar");
  const pairBarText = document.getElementById("pair-bar-text");

  // Check pairing status first
  const authResponse = await browser.runtime.sendMessage({ action: "getAuthStatus" });

  const response = await browser.runtime.sendMessage({ action: "status" });

  if (response.connected) {
    statusEl.textContent = "Connected";
    statusEl.className = "status connected";
    pairBar.classList.remove("visible");

    // Show session section if auto-tracking is enabled
    if (response.autoTrack && response.session) {
      sessionSection.classList.add("visible");
      updateSessionDisplay(response.session);
    } else {
      sessionSection.classList.remove("visible");
    }
  } else if (response.authError || !authResponse.paired) {
    // Not paired or key expired
    statusEl.textContent = "Not paired";
    statusEl.className = "status disconnected";
    sessionSection.classList.remove("visible");

    pairBarText.textContent = response.authError ? "Key expired -- re-pair needed" : "Not paired";
    pairBar.classList.add("visible");
  } else {
    statusEl.textContent = "Not running";
    statusEl.className = "status disconnected";
    sessionSection.classList.remove("visible");
    pairBar.classList.remove("visible");
  }
}

// Handle pair button in popup
async function handlePairPopup() {
  const pairBtn = document.getElementById("pair-btn-popup");
  const pairBarText = document.getElementById("pair-bar-text");

  pairBtn.disabled = true;
  pairBarText.textContent = "Waiting for approval...";

  const result = await browser.runtime.sendMessage({ action: "pair" });

  if (result.ok) {
    pairBarText.textContent = "Paired!";
    setTimeout(() => checkStatus(), 500);
  } else {
    pairBarText.textContent = result.error || "Pairing failed";
    pairBtn.disabled = false;
  }
}

// Update session display
function updateSessionDisplay(session) {
  const sessionNameEl = document.getElementById("session-name");
  const durationEl = document.getElementById("session-duration");
  const pagesEl = document.getElementById("session-pages");
  const sessionIdEl = document.getElementById("session-id");
  const pauseBtn = document.getElementById("pause-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const pausedBadge = document.getElementById("paused-badge");

  // Show session name
  if (session.name) {
    sessionNameEl.textContent = session.name;
    sessionNameEl.style.display = "block";
  } else {
    sessionNameEl.style.display = "none";
  }

  if (session.startTime) {
    const elapsed = Date.now() - session.startTime;
    durationEl.textContent = formatDuration(elapsed);
  } else {
    durationEl.textContent = "--";
  }

  pagesEl.textContent = session.pageCount || 0;

  // Show session ID
  if (session.id) {
    sessionIdEl.textContent = session.id;
  }

  // Update pause/resume button visibility
  if (session.paused) {
    pauseBtn.style.display = "none";
    resumeBtn.style.display = "flex";
    pausedBadge.style.display = "inline";
  } else {
    pauseBtn.style.display = "flex";
    resumeBtn.style.display = "none";
    pausedBadge.style.display = "none";
  }
}

// Pause session
async function pauseSession() {
  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.disabled = true;

  const response = await browser.runtime.sendMessage({ action: "pauseSession" });

  if (response.success) {
    updateSessionDisplay({ ...response, paused: true });
  }
  pauseBtn.disabled = false;
}

// Resume session
async function resumeSession() {
  const resumeBtn = document.getElementById("resume-btn");
  resumeBtn.disabled = true;

  const response = await browser.runtime.sendMessage({ action: "resumeSession" });

  if (response.success) {
    updateSessionDisplay({ ...response, paused: false });
  }
  resumeBtn.disabled = false;
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

// Open settings
function openSettings() {
  browser.runtime.openOptionsPage();
  window.close();
}

// Toggle session content
function toggleSession() {
  const header = document.getElementById("session-header");
  const content = document.getElementById("session-content");

  header.classList.toggle("expanded");
  content.classList.toggle("visible");
}

// Refresh session stats periodically
let sessionRefreshInterval = null;

async function refreshSession() {
  const response = await browser.runtime.sendMessage({ action: "status" });
  if (response.connected && response.autoTrack && response.session) {
    updateSessionDisplay(response.session);
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  checkStatus();
  loadCurrentTab();

  document.getElementById("save-page").addEventListener("click", savePage);
  document.getElementById("open-sidebar").addEventListener("click", openSidebar);
  document.getElementById("open-settings").addEventListener("click", openSettings);
  document.getElementById("session-header").addEventListener("click", toggleSession);
  document.getElementById("pause-btn").addEventListener("click", pauseSession);
  document.getElementById("resume-btn").addEventListener("click", resumeSession);
  document.getElementById("pair-btn-popup").addEventListener("click", handlePairPopup);

  // Refresh session every 2 seconds
  sessionRefreshInterval = setInterval(refreshSession, 2000);
});
