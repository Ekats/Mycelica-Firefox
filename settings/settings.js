// Settings page script

let currentConfig = null;

// =============================================================================
// PAIRING
// =============================================================================

async function checkPairingStatus() {
  const dot = document.getElementById("pair-dot");
  const text = document.getElementById("pair-status-text");
  const pairBtn = document.getElementById("pair-btn");
  const unpairBtn = document.getElementById("unpair-btn");
  const keyDisplay = document.getElementById("key-display");

  const response = await browser.runtime.sendMessage({ action: "getAuthStatus" });

  if (response.paired) {
    dot.classList.add("paired");
    text.textContent = "Paired";
    pairBtn.style.display = "none";
    unpairBtn.style.display = "inline-block";
    // Show masked key
    const stored = await browser.storage.local.get("mycelicaApiKey");
    if (stored.mycelicaApiKey) {
      const key = stored.mycelicaApiKey;
      const masked = key.slice(0, 8) + "..." + key.slice(-4);
      keyDisplay.textContent = "Key: " + masked;
      keyDisplay.style.display = "block";
    }
  } else {
    dot.classList.remove("paired");
    text.textContent = "Not paired";
    pairBtn.style.display = "inline-block";
    unpairBtn.style.display = "none";
    keyDisplay.style.display = "none";
  }
}

async function handlePair() {
  const pairBtn = document.getElementById("pair-btn");
  const msgEl = document.getElementById("pair-message");

  pairBtn.disabled = true;
  pairBtn.textContent = "Waiting for approval...";
  msgEl.style.display = "none";

  const result = await browser.runtime.sendMessage({ action: "pair" });

  if (result.ok) {
    msgEl.textContent = "Paired successfully!";
    msgEl.className = "pair-message success";
    msgEl.style.display = "block";
    await checkPairingStatus();
  } else {
    msgEl.textContent = result.error || "Pairing failed";
    msgEl.className = "pair-message error";
    msgEl.style.display = "block";
  }

  pairBtn.disabled = false;
  pairBtn.textContent = "Pair with Mycelica";
}

async function handleUnpair() {
  await browser.runtime.sendMessage({ action: "clearApiKey" });
  document.getElementById("pair-message").style.display = "none";
  await checkPairingStatus();
}

// =============================================================================
// CONNECTION STATUS
// =============================================================================

async function checkStatus() {
  const indicator = document.getElementById("status-indicator");
  const text = document.getElementById("status-text");

  try {
    const response = await browser.runtime.sendMessage({ action: "status" });
    if (response.connected) {
      indicator.classList.add("connected");
      text.textContent = "Connected to Holerabbit";
    } else if (response.authError) {
      indicator.classList.remove("connected");
      text.textContent = "Key expired -- re-pair needed";
    } else {
      indicator.classList.remove("connected");
      text.textContent = "Mycelica app not running";
    }
  } catch (e) {
    indicator.classList.remove("connected");
    text.textContent = "Error checking status";
  }
}

// =============================================================================
// CONFIG
// =============================================================================

// Load current config
async function loadConfig() {
  currentConfig = await browser.runtime.sendMessage({ action: "getConfig" });

  // Auto-tracking toggle
  document.getElementById("autotrack-enabled").checked = currentConfig.autoTrack.enabled;

  // Determine tracking mode
  const allowedDomains = currentConfig.autoTrack.allowedDomains || [];
  const excludedDomains = currentConfig.autoTrack.excludedDomains || [];

  if (allowedDomains.length === 0) {
    // All sites mode
    document.querySelector('input[value="all"]').checked = true;
    showExcludedDomains();
  } else if (
    allowedDomains.length === 2 &&
    allowedDomains.includes("wikipedia.org") &&
    allowedDomains.includes("wikimedia.org")
  ) {
    // Wikipedia mode
    document.querySelector('input[value="wikipedia"]').checked = true;
  } else {
    // Custom mode
    document.querySelector('input[value="custom"]').checked = true;
    showCustomDomains();
  }

  // Fill domain inputs
  document.getElementById("allowed-domains").value = allowedDomains.join(", ");
  document.getElementById("excluded-domains").value = excludedDomains.join(", ");

  // Session gap
  document.getElementById("session-gap").value = currentConfig.autoTrack.sessionGapMinutes || 30;

  // Update domain tags
  updateDomainTags("allowed-tags", allowedDomains);
  updateDomainTags("excluded-tags", excludedDomains);

  // Update section visibility
  updateSectionVisibility();
}

// Update domain tags display
function updateDomainTags(containerId, domains) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  domains.forEach(domain => {
    if (!domain.trim()) return;

    const tag = document.createElement("span");
    tag.className = "domain-tag";
    tag.innerHTML = `${escapeHtml(domain.trim())} <span class="remove">&times;</span>`;

    tag.querySelector(".remove").addEventListener("click", () => {
      tag.remove();
      // Update input field
      const input = containerId === "allowed-tags"
        ? document.getElementById("allowed-domains")
        : document.getElementById("excluded-domains");
      const remaining = Array.from(container.querySelectorAll(".domain-tag"))
        .map(t => t.textContent.replace("\u00d7", "").trim());
      input.value = remaining.join(", ");
    });

    container.appendChild(tag);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Show/hide sections based on auto-tracking toggle
function updateSectionVisibility() {
  const enabled = document.getElementById("autotrack-enabled").checked;
  const trackingSection = document.getElementById("tracking-mode-section");
  const sessionSection = document.getElementById("session-section");

  trackingSection.style.opacity = enabled ? "1" : "0.5";
  trackingSection.style.pointerEvents = enabled ? "auto" : "none";
  sessionSection.style.opacity = enabled ? "1" : "0.5";
  sessionSection.style.pointerEvents = enabled ? "auto" : "none";
}

// Show custom domains input
function showCustomDomains() {
  document.getElementById("custom-domains-group").style.display = "block";
  document.getElementById("excluded-domains-group").style.display = "none";
}

// Show excluded domains input
function showExcludedDomains() {
  document.getElementById("custom-domains-group").style.display = "none";
  document.getElementById("excluded-domains-group").style.display = "block";
}

// Hide all domain inputs
function hideDomainInputs() {
  document.getElementById("custom-domains-group").style.display = "none";
  document.getElementById("excluded-domains-group").style.display = "none";
}

// Parse comma-separated domains
function parseDomains(input) {
  return input
    .split(",")
    .map(d => d.trim().toLowerCase())
    .filter(d => d.length > 0);
}

// Save settings
async function saveSettings() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const enabled = document.getElementById("autotrack-enabled").checked;
  const mode = document.querySelector('input[name="tracking-mode"]:checked').value;
  const sessionGap = parseInt(document.getElementById("session-gap").value) || 30;

  let allowedDomains = [];
  let excludedDomains = [];

  if (mode === "wikipedia") {
    allowedDomains = ["wikipedia.org", "wikimedia.org"];
  } else if (mode === "custom") {
    allowedDomains = parseDomains(document.getElementById("allowed-domains").value);
  } else if (mode === "all") {
    allowedDomains = [];
    excludedDomains = parseDomains(document.getElementById("excluded-domains").value);
  }

  const newConfig = {
    autoTrack: {
      enabled,
      allowedDomains,
      excludedDomains,
      sessionGapMinutes: sessionGap
    }
  };

  try {
    await browser.runtime.sendMessage({ action: "setConfig", config: newConfig });
    btn.textContent = "Saved!";
    btn.classList.add("saved");

    setTimeout(() => {
      btn.textContent = "Save Settings";
      btn.classList.remove("saved");
      btn.disabled = false;
    }, 1500);
  } catch (e) {
    btn.textContent = "Error - Try again";
    btn.disabled = false;
  }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  checkStatus();
  checkPairingStatus();
  loadConfig();

  // Pairing buttons
  document.getElementById("pair-btn").addEventListener("click", handlePair);
  document.getElementById("unpair-btn").addEventListener("click", handleUnpair);

  // Auto-tracking toggle
  document.getElementById("autotrack-enabled").addEventListener("change", updateSectionVisibility);

  // Tracking mode radio buttons
  document.querySelectorAll('input[name="tracking-mode"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        showCustomDomains();
      } else if (e.target.value === "all") {
        showExcludedDomains();
      } else {
        hideDomainInputs();
      }
    });
  });

  // Domain input handlers
  document.getElementById("allowed-domains").addEventListener("blur", (e) => {
    updateDomainTags("allowed-tags", parseDomains(e.target.value));
  });

  document.getElementById("excluded-domains").addEventListener("blur", (e) => {
    updateDomainTags("excluded-tags", parseDomains(e.target.value));
  });

  // Save button
  document.getElementById("save-btn").addEventListener("click", saveSettings);
});
