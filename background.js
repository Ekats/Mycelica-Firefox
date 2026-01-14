// Holerabbit Firefox Extension - Background Script
// Handles manual capture and optional auto-tracking

const MYCELICA_URL = "http://localhost:9876";

// =============================================================================
// CONFIGURATION
// =============================================================================

let config = {
  autoTrack: {
    enabled: false,
    allowedDomains: ["wikipedia.org", "wikimedia.org"],
    excludedDomains: [],
    sessionGapMinutes: 30
  }
};

// Load config from storage
browser.storage.local.get("mycelicaConfig").then(result => {
  if (result.mycelicaConfig) {
    config = { ...config, ...result.mycelicaConfig };
  }
  // Start auto-tracking if enabled
  if (config.autoTrack.enabled) {
    startAutoTracking();
  }
});

// =============================================================================
// MANUAL CAPTURE (existing functionality)
// =============================================================================

async function captureToMycelica(data) {
  try {
    const response = await fetch(`${MYCELICA_URL}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    return { success: true, method: "http", ...result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Context menu: "Save to Holerabbit"
browser.contextMenus.create({
  id: "save-to-mycelica",
  title: "Save to Holerabbit",
  contexts: ["page", "selection", "link"]
});

// Context menu: "Save selection to Holerabbit"
browser.contextMenus.create({
  id: "save-selection-to-mycelica",
  title: "Save selection to Holerabbit",
  contexts: ["selection"]
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const data = {
    title: tab.title,
    url: tab.url,
    content: info.selectionText || "",
    timestamp: Date.now()
  };

  if (info.menuItemId === "save-selection-to-mycelica" && info.selectionText) {
    data.content = info.selectionText;
    data.title = `Selection from: ${tab.title}`;
  }

  const result = await captureToMycelica(data);

  if (result.success) {
    browser.notifications.create({
      type: "basic",
      title: "Holerabbit",
      message: `Saved: ${data.title.slice(0, 50)}...`
    });
  } else {
    browser.notifications.create({
      type: "basic",
      title: "Holerabbit - Error",
      message: `Failed to save: ${result.error}`
    });
  }
});

// =============================================================================
// AUTO-TRACKING (Holerabbit)
// =============================================================================

// Per-tab state for navigation tracking
const tabState = new Map(); // tabId -> { lastUrl, lastTimestamp, history[] }

// Session tracking
let currentSession = {
  id: null,
  name: null,
  startTime: null,
  pageCount: 0,
  paused: false
};

function isDomainAllowed(url) {
  try {
    const hostname = new URL(url).hostname;

    // Check exclusions first
    for (const domain of config.autoTrack.excludedDomains) {
      if (hostname.includes(domain)) return false;
    }

    // If allowedDomains is empty, allow all (except excluded)
    if (config.autoTrack.allowedDomains.length === 0) return true;

    // Check allowed list
    for (const domain of config.autoTrack.allowedDomains) {
      if (hostname.includes(domain)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getNavigationType(tabId, currentUrl) {
  const state = tabState.get(tabId);
  if (!state || !state.lastUrl) return "searched";

  // Check if backtracking
  const historyIndex = state.history.findIndex(h => h.url === currentUrl);
  if (historyIndex !== -1 && historyIndex < state.history.length - 1) {
    return "backtracked";
  }

  // If we have a previous URL in this tab, it's likely a click
  if (state.lastUrl) {
    return "clicked";
  }

  return "searched";
}

// Generate session ID
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Sync with app's live session
async function syncLiveSession() {
  try {
    const response = await fetch(`${MYCELICA_URL}/holerabbit/live`);
    if (response.ok) {
      const data = await response.json();
      if (data.session) {
        // App has a live session - use it
        currentSession.id = data.session.id;
        currentSession.name = data.session.title;
        currentSession.startTime = data.session.start_time;
        currentSession.pageCount = data.session.item_count || 0;
        currentSession.paused = data.session.status === "paused";
        console.log("[Holerabbit] Synced with app's live session:", data.session.id);
        return true;
      }
    }
  } catch (e) {
    console.debug("[Holerabbit] Could not sync live session:", e);
  }
  return false;
}

async function recordVisit(details) {
  if (!config.autoTrack.enabled) return;
  if (currentSession.paused) return;
  if (!isDomainAllowed(details.url)) return;

  const tabId = details.tabId;
  const now = Date.now();

  // Sync with app's live session first
  await syncLiveSession();

  // If still paused after sync, skip
  if (currentSession.paused) return;

  // Get or create tab state
  const state = tabState.get(tabId) || { lastUrl: null, lastTimestamp: null, history: [] };

  // Only create new session if none exists (app's live session takes priority)
  if (!currentSession.id) {
    // Check for session gap
    if (state.lastTimestamp) {
      const gapMs = now - state.lastTimestamp;
      const gapMinutes = gapMs / (1000 * 60);
      if (gapMinutes > config.autoTrack.sessionGapMinutes) {
        currentSession = { id: generateSessionId(), name: null, startTime: now, pageCount: 0, paused: false };
      }
    } else {
      currentSession = { id: generateSessionId(), name: null, startTime: now, pageCount: 0, paused: false };
    }
  }

  // Calculate dwell time on previous page
  const dwellTime = state.lastTimestamp ? now - state.lastTimestamp : 0;

  // Determine navigation type (before updating state)
  const navType = getNavigationType(tabId, details.url);

  const payload = {
    url: details.url,
    referrer: (navType === "clicked" || navType === "backtracked") ? state.lastUrl : null,
    timestamp: now,
    tab_id: tabId,
    session_id: currentSession.id,
    navigation_type: navType,
    previous_dwell_time_ms: dwellTime,
    session_gap_minutes: config.autoTrack.sessionGapMinutes
  };

  // Try to get page title
  try {
    const tab = await browser.tabs.get(tabId);
    if (tab) {
      payload.title = tab.title;
    }
  } catch (e) {
    console.debug("[Holerabbit] Could not get tab info:", e);
  }

  // Update tab state
  state.lastUrl = details.url;
  state.lastTimestamp = now;
  state.history.push({ url: details.url, timestamp: now });
  if (state.history.length > 100) state.history.shift();
  tabState.set(tabId, state);

  // Update session
  currentSession.pageCount++;

  // Send to backend
  try {
    const response = await fetch(`${MYCELICA_URL}/holerabbit/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();

      // Capture session name from backend
      if (data.session_name) {
        currentSession.name = data.session_name;
      }

      // If backend created new session (old one was deleted), reset local state
      if (data.is_new_session) {
        currentSession.id = data.session_id;
        currentSession.name = data.session_name || null;
        currentSession.startTime = now;
        currentSession.pageCount = 1;
        currentSession.paused = false;
        console.log("[Holerabbit] Session reset - backend created new:", data.session_id);
      }
    } else {
      console.warn("[Holerabbit] Auto-track backend error:", response.status);
    }
  } catch (e) {
    console.debug("[Holerabbit] Auto-track backend not available");
  }
}

// Navigation listener (only added when auto-tracking enabled)
let navigationListener = null;

function startAutoTracking() {
  if (navigationListener) return; // Already started

  navigationListener = (details) => {
    if (details.frameId === 0) { // Main frame only
      recordVisit(details);
    }
  };

  browser.webNavigation.onCompleted.addListener(
    navigationListener,
    { url: [{ schemes: ["http", "https"] }] }
  );

  console.log("[Holerabbit] Auto-tracking started");
}

function stopAutoTracking() {
  if (navigationListener) {
    browser.webNavigation.onCompleted.removeListener(navigationListener);
    navigationListener = null;
    console.log("[Holerabbit] Auto-tracking stopped");
  }
}

// Clean up closed tabs
browser.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

browser.runtime.onMessage.addListener(async (message, sender) => {
  // Manual capture
  if (message.action === "capture") {
    return captureToMycelica(message.data);
  }

  // Search
  if (message.action === "search") {
    try {
      const response = await fetch(`${MYCELICA_URL}/search?q=${encodeURIComponent(message.query)}`);
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  }

  // Status check
  if (message.action === "status") {
    try {
      const response = await fetch(`${MYCELICA_URL}/status`);
      const data = await response.json();

      // Sync with app's live session
      if (config.autoTrack.enabled) {
        await syncLiveSession();
      }

      return {
        connected: true,
        autoTrack: config.autoTrack.enabled,
        session: {
          id: currentSession.id,
          name: currentSession.name,
          startTime: currentSession.startTime,
          pageCount: currentSession.pageCount,
          paused: currentSession.paused
        }
      };
    } catch (e) {
      return { connected: false };
    }
  }

  // Get config
  if (message.action === "getConfig") {
    return config;
  }

  // Set config
  if (message.action === "setConfig") {
    const wasEnabled = config.autoTrack.enabled;
    config = { ...config, ...message.config };
    browser.storage.local.set({ mycelicaConfig: config });

    // Handle auto-tracking toggle
    if (config.autoTrack.enabled && !wasEnabled) {
      startAutoTracking();
    } else if (!config.autoTrack.enabled && wasEnabled) {
      stopAutoTracking();
    }

    return { success: true };
  }

  // Get session info
  if (message.action === "getSession") {
    return {
      ...currentSession,
      enabled: config.autoTrack.enabled
    };
  }

  // Pause session
  if (message.action === "pauseSession") {
    if (!currentSession.id) {
      return { success: false, error: "No active session" };
    }

    try {
      const response = await fetch(`${MYCELICA_URL}/holerabbit/session/${currentSession.id}/pause`, {
        method: "POST"
      });
      if (response.ok) {
        currentSession.paused = true;
        return { success: true, paused: true };
      }
      return { success: false, error: "Backend error" };
    } catch (e) {
      // Backend may not support this yet, just pause locally
      currentSession.paused = true;
      return { success: true, paused: true };
    }
  }

  // Resume session
  if (message.action === "resumeSession") {
    if (!currentSession.id) {
      return { success: false, error: "No active session" };
    }

    try {
      const response = await fetch(`${MYCELICA_URL}/holerabbit/session/${currentSession.id}/resume`, {
        method: "POST"
      });
      if (response.ok) {
        currentSession.paused = false;
        return { success: true, paused: false };
      }
      return { success: false, error: "Backend error" };
    } catch (e) {
      // Backend may not support this yet, just resume locally
      currentSession.paused = false;
      return { success: true, paused: false };
    }
  }
});

console.log("[Holerabbit] Extension loaded");
