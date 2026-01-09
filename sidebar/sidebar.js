// Sidebar script - shows related nodes from Mycelica

let currentUrl = null;

// Check connection and update status
async function checkStatus() {
  const statusEl = document.getElementById("status");
  const response = await browser.runtime.sendMessage({ action: "status" });
  
  if (response.connected) {
    statusEl.textContent = "Connected to Mycelica";
    statusEl.className = "status connected";
    return true;
  } else {
    statusEl.textContent = "Mycelica not running";
    statusEl.className = "status error";
    return false;
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

// Init
async function init() {
  await checkStatus();
  
  // Load current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    updateCurrentPage(tabs[0]);
  }
}

document.addEventListener("DOMContentLoaded", init);
