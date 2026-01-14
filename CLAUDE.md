# CLAUDE.md

Mycelica Firefox Extension — captures web pages to local Mycelica graph.

## Architecture

```
Firefox Extension  ──HTTP──►  Mycelica Tauri (localhost:9876)
     │                              │
     ├─ background.js               ├─ /capture (POST)
     │   ├─ manual capture          ├─ /holerabbit/visit (POST)
     │   └─ auto-tracking           ├─ /search (GET)
     ├─ popup/                      └─ /status (GET)
     ├─ sidebar/
     └─ settings/
```

Extension talks to running Mycelica app over HTTP. No cloud, no accounts.

## Features

1. **Manual Capture** — Right-click or popup to save pages
2. **Auto-tracking** (opt-in) — Automatically track browsing on allowed domains
   - Per-tab navigation tracking (clicked/searched/backtracked)
   - Session management with configurable gap
   - Default: Wikipedia only, OFF by default

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config, permissions |
| `background.js` | Manual capture + auto-tracking module |
| `popup/popup.html` | Quick capture UI + session status |
| `popup/popup.js` | Popup logic |
| `sidebar/sidebar.html` | Related nodes panel |
| `sidebar/sidebar.js` | Tab tracking, similarity search |
| `settings/settings.html` | Auto-tracking configuration |
| `settings/settings.js` | Settings logic |

## Configuration

```javascript
config = {
  autoTrack: {
    enabled: false,                              // OFF by default
    allowedDomains: ["wikipedia.org", "wikimedia.org"],
    excludedDomains: [],
    sessionGapMinutes: 30
  }
}
```

## Development

```bash
# Load temporarily in Firefox
about:debugging → This Firefox → Load Temporary Add-on → select manifest.json

# Watch for errors
Ctrl+Shift+J → Browser Console → filter "Mycelica"
```

## Backend Endpoints

```
POST /capture
  Body: { title, url, content, timestamp }
  Returns: { success: true, nodeId: "..." }

POST /holerabbit/visit
  Body: { url, referrer, timestamp, tab_id, navigation_type,
          previous_dwell_time_ms, session_gap_minutes, title? }
  Returns: { success: true }

GET /search?q=<query>
  Returns: { results: [{ id, title, type, similarity }] }

GET /status
  Returns: { connected: true, version: "..." }
```

## TODO

- [ ] Implement `/holerabbit/visit` endpoint in Mycelica backend
- [ ] Native messaging instead of HTTP
- [ ] Highlight text → create edge to existing node
- [ ] Show graph connections in sidebar
- [ ] Firefox Add-ons store submission

## Constraints

- Manifest v2 (Firefox still supports it, simpler than v3)
- No external dependencies in extension
- All storage is in Mycelica, extension is stateless
- Works offline (local Mycelica only)
- Auto-tracking OFF by default, opt-in only
