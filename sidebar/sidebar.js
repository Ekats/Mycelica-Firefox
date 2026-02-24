// Sidebar script - shows related nodes from graph

let currentUrl = null;
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

// Check connection and update status
async function checkStatus() {
  const statusEl = document.getElementById("status");
  const sessionSection = document.getElementById("session-section");
  const response = await browser.runtime.sendMessage({ action: "status" });

  if (response.connected) {
    statusEl.textContent = "Connected";
    statusEl.className = "status connected";

    // Show session section if auto-tracking enabled
    if (response.autoTrack && response.session) {
      sessionSection.classList.add("visible");
      updateSessionDisplay(response.session);
    } else {
      sessionSection.classList.remove("visible");
    }
    return true;
  } else {
    statusEl.textContent = "Not running";
    statusEl.className = "status error";
    sessionSection.classList.remove("visible");
    return false;
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

// Toggle session content
function toggleSession() {
  const header = document.getElementById("session-header");
  const content = document.getElementById("session-content");
  header.classList.toggle("expanded");
  content.classList.toggle("visible");
}

// Save current page
async function savePage() {
  if (!currentTab) return;

  const button = document.getElementById("save-page");
  button.disabled = true;
  button.textContent = "Saving...";

  const response = await browser.runtime.sendMessage({
    action: "capture",
    data: {
      title: currentTab.title,
      url: currentTab.url,
      content: "",
      timestamp: Date.now()
    }
  });

  if (response.success) {
    button.textContent = "Saved!";
    setTimeout(() => {
      button.textContent = "Save Page to Graph";
      button.disabled = false;
    }, 1500);
  } else {
    button.textContent = "Error";
    setTimeout(() => {
      button.textContent = "Save Page to Graph";
      button.disabled = false;
    }, 1500);
  }
}

// Search for related nodes
async function searchRelated(query) {
  const resultsEl = document.getElementById("results");
  
  if (!query) {
    resultsEl.innerHTML = '<div class="empty-state">Navigate to a page to see related nodes</div>';
    return;
  }
  
  resultsEl.innerHTML = '<div class="empty-state">Searching...</div>';
  
  const response = await browser.runtime.sendMessage({
    action: "search",
    query: query
  });
  
  if (response.error) {
    resultsEl.innerHTML = `<div class="empty-state">Error: ${response.error}</div>`;
    return;
  }
  
  if (!response.results || response.results.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state">No related nodes found</div>';
    return;
  }
  
  renderResults(response.results);
}

// Render search results
function renderResults(results) {
  const resultsEl = document.getElementById("results");
  
  resultsEl.innerHTML = results.map(node => `
    <div class="node-item" data-id="${node.id}">
      <div class="node-title">${escapeHtml(node.title)}</div>
      <div class="node-meta">
        <span>${node.type || 'note'}</span>
        ${node.similarity ? `<span class="similarity">${Math.round(node.similarity * 100)}%</span>` : ''}
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  resultsEl.querySelectorAll('.node-item').forEach(el => {
    el.addEventListener('click', () => {
      const nodeId = el.dataset.id;
      // Open in Mycelica app
      browser.runtime.sendMessage({
        action: "openNode",
        nodeId: nodeId
      });
    });
  });
}

// Escape HTML for safe rendering
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update current page display
function updateCurrentPage(tab) {
  currentTab = tab;
  document.getElementById("page-title").textContent = tab.title;
  document.getElementById("page-url").textContent = tab.url;
  currentUrl = tab.url;

  // Extract meaningful search terms from title
  const searchTerms = tab.title
    .replace(/[-|—–].*$/, '') // Remove site name after dash
    .trim()
    .slice(0, 100);

  if (searchTerms) {
    searchRelated(searchTerms);
  }
}

// Listen for tab changes
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateCurrentPage(tab);
});

// Listen for URL changes in current tab
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0] && tabs[0].id === tabId) {
        updateCurrentPage(tab);
      }
    });
  }
});

// Manual search
document.getElementById("search-btn").addEventListener("click", () => {
  const query = document.getElementById("search").value;
  if (query) searchRelated(query);
});

document.getElementById("search").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = e.target.value;
    if (query) searchRelated(query);
  }
});

// Open settings
function openSettings() {
  browser.runtime.openOptionsPage();
}

// Refresh session stats periodically
async function refreshSession() {
  const response = await browser.runtime.sendMessage({ action: "status" });
  if (response.connected && response.autoTrack && response.session) {
    document.getElementById("session-section").classList.add("visible");
    updateSessionDisplay(response.session);
  }
}

// Init
async function init() {
  await checkStatus();

  // Event listeners
  document.getElementById("open-settings").addEventListener("click", openSettings);
  document.getElementById("save-page").addEventListener("click", savePage);
  document.getElementById("session-header").addEventListener("click", toggleSession);
  document.getElementById("pause-btn").addEventListener("click", pauseSession);
  document.getElementById("resume-btn").addEventListener("click", resumeSession);

  // Load current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    updateCurrentPage(tabs[0]);
  }

  // Refresh session every 2 seconds
  setInterval(refreshSession, 2000);
}

document.addEventListener("DOMContentLoaded", init);
