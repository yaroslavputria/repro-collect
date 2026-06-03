# Repro Collect

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Chrome extension for collecting browser diagnostics during bug reproduction — console logs, network traffic, CPU profiles, and screen recordings — and sharing them with developers for analysis.

## Features

- **Console logs** — all levels captured via Chrome DevTools Protocol
- **Network HAR** — requests and responses in standard HAR 1.2 format, importable into Chrome DevTools
- **CPU profiling** — exported as `.cpuprofile`, openable in Chrome DevTools or [speedscope.app](https://speedscope.app)
- **Screen recording** — tab audio and video saved as `.webm`
- **Built-in viewer** — filterable console and network log browser, works offline with exported files

## Installation

### Chrome Web Store

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/repro-collect/bgemhangajmkhelnjojpnlobppkbackh).

### Manual (development)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder

## How to Use

1. Open the tab you want to capture
2. *(Optional)* Open DevTools (F12) — enables native HAR capture in addition to CDP logs
3. Click the **Repro Collect** icon, or press `Ctrl+Shift+Y` (Windows/Linux) / `Cmd+Shift+Y` (Mac)
4. Enable **Video Recording** and/or **Code Profiling** if needed
5. Click **Start Capture** and reproduce the bug
6. Click **Stop Capture**
7. Click **Export Logs** to download all files, or **Open Viewer** to browse logs in-browser

## Log Viewer

The built-in viewer lets you browse and filter collected logs:

- **Console tab** — filter by level, search by message or URL, expand stack traces
- **Network tab** — filter by status code, search by URL, expand initiator call stacks

**For developers reviewing a customer's logs:** open `chrome-extension://[extension-id]/viewer.html`, drag and drop the exported files onto the page. Multiple files can be dropped at once.

## Exported Files

| File | Format | Open with |
|------|--------|-----------|
| `console_logs_*.json` | JSON array | Viewer, any JSON editor |
| `network_*.har` | HAR 1.2 | DevTools → Network → Import HAR |
| `network_logs_*.json` | JSON | Viewer |
| `code_profile_*.json` | JSON summary | Any JSON editor |
| `profile_*.cpuprofile` | V8 CPU profile | DevTools → Performance → Load profile · [speedscope.app](https://speedscope.app) |
| `screen_recording_*.webm` | WebM video | Any video player |

## Permissions

| Permission | Reason |
|-----------|--------|
| `debugger` | Captures network requests and console output via Chrome DevTools Protocol |
| `tabCapture` | Records tab audio and video stream |
| `offscreen` | Runs MediaRecorder in a background context (required by Manifest V3) |
| `downloads` | Saves exported log files to disk |
| `storage` | Persists collection state across service worker restarts |
| `alarms` | Keeps the extension icon accurate after service worker hibernation |
