# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"∞ Code Canvas" is a browser application for taking structured notes while reading source code. No build step required. Open `canvas.html` directly in a browser — works from both a local file server and directly via `file://`.

## File structure

| File | Description |
|------|-------------|
| `canvas.html` | Entry point. Minimal DOM: toolbar, canvas container, SVG layer, modal dialogs, status bar. Loads `canvas.css` and `canvas.js` as a plain script. |
| `canvas.css` | All styles. Two major visual systems: code block nodes (`.node`, `.node-header`, `.node-body`) and bubble/comment nodes (`.bubble-node`, `.bubble-body`, `.bubble-tail-poly`). |
| `canvas.js` | Main application logic. Organized by sections marked with `// ═══` banners (see below). Self-contained plain script with no external JS dependencies. |
| `package.json` / `vitest.config.js` | Test tooling (Vitest). Run tests with `npm test`. |

## Architecture

**`canvas.js`** is organized by sections marked with `// ═══` banners:

- **STATE** — Single `S` object holds all runtime state: nodes, links, viewport, selection, drag, pan, edit mode, git config, clipboard
- **VIEWPORT** — `applyVP()`, `s2c()`, `zoom()` manage pan/zoom with CSS transform
- **HIGHLIGHT** — highlight.js integration, `highlight()` / `buildCodeHTML()`
- **NODES** — `addNode()`, `addBubble()`, `renderNode()`, `renderBubble()`, `startEdit()`, `stopEdit()`, `removeNode()`
- **LINKS** — SVG bezier curves connecting nodes, `renderLinks()`, `createLink()`, `removeLink()`
- **DRAG/RESIZE** — pointer event handlers on nodes and the canvas wrapper
- **KEYBOARD** — global `keydown` handler for shortcuts (v/h mode, Del, Cmd+C/X/V, Escape, etc.)
- **PERSISTENCE** — `saveState()` / `loadState()` via `localStorage`, export/import as JSON, Git snippet fetch via GitHub raw URLs

**Pure utility functions** (defined at the top of `canvas.js`, before the STATE section):

- `esc(s)` — HTML escape
- `EXT_LANG`, `langFromPath(filePath)` — file extension → highlight.js language name
- `injectAnchor(html, rawText, linkId)` — inject link-anchor span into highlighted HTML
- `splitHtmlLines(html)`, `addLineNumbers(html, start)` — per-line HTML rendering with correct span handling
- `roundedRectRayHit(...)` — ray vs. rounded-rect intersection (bubble tail geometry)
- `edgePoint(from, to)` — exit point on a node's edge toward another node (arrow geometry)

## Key patterns

- **Node data model**: Each node in `S.nodes[]` is a plain object with `{ id, x, y, w, h, code, lang, title, filePath, showLineNumbers, lineNumberStart }`. Bubble nodes have `{ id, type: 'bubble', x, y, w, h, text, tailX, tailY }`.
- **Rendering**: `renderNode(n)` / `renderBubbleContent(n)` create DOM elements and attach event listeners each time a node is added. Nodes are never re-rendered in-place; the element is replaced on `stopEdit()`.
- **Edit mode**: `startEdit(id)` swaps the highlighted `<pre>` for a `<textarea>`; `stopEdit()` reads the textarea and re-renders.
- **Links**: Created via text selection → tooltip click flow. Stored as `{ id, fromId, toId, text }` in `S.links[]`; rendered as SVG paths on every viewport change.
- **Persistence**: Auto-saved to `localStorage` key `code-canvas-v1` on every change. Import/export uses JSON with the same schema as `S.nodes` + `S.links`.
- **Git integration**: Fetches raw file content from GitHub (`raw.githubusercontent.com`) to populate code blocks. Commit hash auto-resolved via GitHub API (`api.github.com`).

## Node types

| Type | Created by | Key fields |
|------|-----------|------------|
| `code` (default) | "+ Add Block" button or canvas double-click | `code`, `lang`, `title`, `filePath`, `showLineNumbers`, `lineNumberStart` |
| `bubble` | "💬 Bubble" button | `text`, `tailX`, `tailY` |

## Keyboard shortcuts

`v` = select mode, `h` = hand/pan mode, `Space` (held) = temporary hand mode, `Del`/`Backspace` = delete selected, `Cmd/Ctrl+C/X/V` = copy/cut/paste nodes, `Escape` = exit edit/link mode, `l` = toggle link mode.

## Code Language Requirements

When responding to prompts in Japanese, always write all code captions, messages, comments, and documentation in English. Never use Japanese in code.

- All code comments must be in English
- All variable/function names must be in English  
- All error messages and user-facing strings must be in English
- Documentation and docstrings must be in English

