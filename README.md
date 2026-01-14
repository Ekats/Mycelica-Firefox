# Holerabbit

Firefox extension for [Mycelica](https://github.com/Ekats/Mycelica) — auto-track your browsing sessions and map navigation paths.

## Features

- **Auto-tracking** — Automatically track browsing on Wikipedia (opt-in)
- **Manual capture** — Right-click to save any page or selection
- **Session sync** — Syncs with live session in Mycelica app
- **Navigation tracking** — Tracks clicked/searched/backtracked paths
- **Sidebar** — See related nodes from your graph while browsing
- **Local only** — Everything stays on your machine

## Requirements

- Firefox 91+
- [Mycelica](https://github.com/Ekats/Mycelica) desktop app running

## Install (Development)

1. Clone this repo
2. Open Firefox → `about:debugging` → "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

## Usage

1. Start Mycelica desktop app
2. Enable auto-tracking in Settings (OFF by default)
3. Browse Wikipedia — visits are tracked automatically
4. Or right-click → "Save to Holerabbit" to capture manually

## Status

✅ **Working** — Requires Mycelica v0.7.2+ running locally.

## License

AGPL-3.0
