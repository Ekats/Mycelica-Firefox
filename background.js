// Mycelica Firefox Extension - Background Script
// Handles native messaging to local Mycelica app

const NATIVE_APP = "com.mycelica.app";
let port = null;

// Connect to native Mycelica app
function connectNative() {
  if (port) return port;
  
  try {
    port = browser.runtime.connectNative(NATIVE_APP);
    
    port.onMessage.addListener((response) => {
      console.log("[Mycelica] Response:", response);
    });
    
    port.onDisconnect.addListener(() => {
      console.log("[Mycelica] Disconnected");
      port = null;
    });
    
    return port;
  } catch (e) {
    console.error("[Mycelica] Connection failed:", e);
    return null;
  }
}

// Send capture request to Mycelica
async function captureToMycelica(data) {
  // Use HTTP to local Tauri server
  // (Native messaging disabled - requires additional setup)
  try {
    const response = await fetch("http://localhost:9876/capture", {
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

// Context menu: "Save to Mycelica"
browser.contextMenus.create({
  id: "save-to-mycelica",
  title: "Save to Mycelica",
  contexts: ["page", "selection", "link"]
});

// Context menu: "Save selection to Mycelica"
browser.contextMenus.create({
  id: "save-selection-to-mycelica", 
  title: "Save selection to Mycelica",
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
  
  // Notify user
  if (result.success) {
    browser.notifications.create({
      type: "basic",
      title: "Mycelica",
      message: `Saved: ${data.title.slice(0, 50)}...`
    });
  } else {
    browser.notifications.create({
      type: "basic", 
      title: "Mycelica - Error",
      message: `Failed to save: ${result.error}`
    });
  }
});

// Listen for messages from popup/sidebar
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "capture") {
    return captureToMycelica(message.data);
  }
  
  if (message.action === "search") {
    // Query Mycelica for similar nodes
    try {
      const response = await fetch(`http://localhost:9876/search?q=${encodeURIComponent(message.query)}`);
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  if (message.action === "status") {
    // Check if Mycelica is running
    try {
      const response = await fetch("http://localhost:9876/status");
      return { connected: true };
    } catch (e) {
      return { connected: false };
    }
  }
});

console.log("[Mycelica] Extension loaded");
