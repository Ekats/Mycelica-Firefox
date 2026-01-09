# Mycelica Firefox Extension

Capture web pages to your local [Mycelica](https://github.com/Ekats/Mycelica) knowledge graph.

## Features

- **Right-click capture** — Save any page or selection to your graph
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
2. Browse normally
3. Right-click → "Save to Mycelica" to capture pages
4. Open sidebar to see related nodes

## Status

🚧 **Early development** — Requires HTTP endpoints in Mycelica Tauri app (not yet implemented).

## License

MIT
