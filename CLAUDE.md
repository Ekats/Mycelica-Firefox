# CLAUDE.md

Mycelica Firefox Extension — captures web pages to local Mycelica graph.

## Architecture

```
Firefox Extension  ──HTTP──►  Mycelica Tauri (localhost:9876)
     │                              │
     ├─ background.js               ├─ /capture (POST)
     ├─ popup/                      ├─ /search (GET)
     └─ sidebar/                    └─ /status (GET)
```

Extension talks to running Mycelica app over HTTP. No cloud, no accounts.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config, permissions |
| `background.js` | Native messaging, context menus, message routing |
| `popup/popup.html` | Quick capture UI |
| `popup/popup.js` | Popup logic |
| `sidebar/sidebar.html` | Related nodes panel |
| `sidebar/sidebar.js` | Tab tracking, similarity search |

## Development

```bash
# Load temporarily in Firefox
about:debugging → This Firefox → Load Temporary Add-on → select manifest.json

# Watch for errors
Ctrl+Shift+J → Browser Console → filter "Mycelica"
```

## Mycelica Backend Requirements

The Tauri app needs these HTTP endpoints (not yet implemented):

```rust
// In src-tauri, add HTTP server or use existing Tauri invoke

POST /capture
  Body: { title, url, content, timestamp }
  Returns: { success: true, nodeId: "..." }

GET /search?q=<query>
  Returns: { results: [{ id, title, type, similarity }] }

GET /status
  Returns: { connected: true }
```

## MVP TODO

1. [ ] Add HTTP server to Mycelica Tauri app (port 9876)
2. [ ] Implement `/capture` endpoint
3. [ ] Implement `/search` endpoint  
4. [ ] Test context menu "Save to Mycelica"
5. [ ] Test sidebar related nodes

## Later

- Native messaging instead of HTTP
- Highlight text → create edge to existing node
- Show graph connections in sidebar
- Firefox Add-ons store submission

## Constraints

- Manifest v2 (Firefox still supports it, simpler than v3)
- No external dependencies in extension
- All storage is in Mycelica, extension is stateless
- Works offline (local Mycelica only)
