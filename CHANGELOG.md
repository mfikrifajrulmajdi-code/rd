# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- TURN server integration for strict NAT environments
- Session password / PIN authentication
- Multi-monitor support for desktop host
- Reconnection logic on network interruption
- Clipboard sharing between host and client

---

## [1.0.0] — 2026-02-18

Initial release of the Remote Desktop App — a WebRTC-based screen sharing application built as a TypeScript pnpm monorepo.

### Added

#### `@remote-app/shared` — Shared Package
- TypeScript type definitions for all Socket.IO event payloads (`RegisterHostPayload`, `JoinSessionPayload`, `SignalPayload`, `PeerJoinedPayload`, `PeerLeftPayload`, `ErrorPayload`, `SessionInfo`)
- `InputMessage` type for DataChannel input events (mouse move, click, scroll, key press/release)
- `SOCKET_EVENTS` constants object — single source of truth for all event names
- `DATA_CHANNELS` constants (`input` channel name)
- `ICE_SERVERS` — pre-configured Google STUN servers
- `DEFAULT_VIDEO_CONFIG` — 1280×720 @ 30fps baseline
- `INPUT_THROTTLE` — mouse move (30/sec) and scroll (20/sec) rate limits
- `SESSION_CODE` config — 3-segment × 3-character format with unambiguous charset
- `SESSION_EXPIRY` — 10-minute default TTL
- `ERROR_CODES` — typed error codes for all failure scenarios
- `PeerRole` union type (`host | admin | viewer`)
- `ConnectionState` union type for UI state management
- Utility functions for session code generation and validation

#### `@remote-app/server` — Signaling Server
- Express HTTP server with health check endpoint (`GET /`)
- Socket.IO server with CORS wildcard (configurable for production)
- `session-manager.ts` — in-memory session lifecycle management
  - Session creation with auto-generated codes
  - Session join with role validation (one admin, multiple viewers)
  - Session expiry via configurable TTL timer
  - Host disconnect → session teardown with peer notification
- `peer-manager.ts` — connected peer tracking by socket ID
  - Add/remove/get peer operations
  - Query all peers in a session
- WebRTC signaling relay for `offer`, `answer`, and `ice-candidate` events
- Automatic cleanup on peer disconnect
- Session expiry broadcasts `session-expired` to all connected peers
- Configurable port via `PORT` environment variable

#### `@remote-app/desktop` — Electron Host Application
- Electron main process with screen capture via `desktopCapturer`
- Socket.IO client for signaling server connection
- WebRTC `RTCPeerConnection` as host (creates offer, sends video track)
- `input-handler.ts` — OS-level input injection via `@jitsi/robotjs`
  - Mouse move with normalized coordinate mapping to screen resolution
  - Mouse click (left, right, middle buttons)
  - Mouse scroll with configurable magnitude
  - Keyboard key press and release
  - Key code validation to prevent crashes on invalid codes
- Electron `contextBridge` IPC API exposed to renderer:
  - `onSessionCode` — receive session code from main process
  - `onPeerJoined` / `onPeerLeft` — peer lifecycle events
  - `sendSignal` — forward WebRTC signals from renderer to main
- React renderer UI displaying session code and connection status
- Preload script with typed `window.electronAPI` interface
- Error handling for invalid robotjs key codes (prevents Electron crash)

#### `@remote-app/client` — React Web Client (Vite)
- React + TypeScript + Vite project setup
- Session join UI with session code input
- Role selection: `admin` (control) or `viewer` (watch-only)
- WebRTC `RTCPeerConnection` as client (receives video, sends input)
- `<video>` element for remote desktop stream display
- WebRTC DataChannel `input` for sending input events to host
- Mouse event capture with coordinate normalization (0.0–1.0)
- Keyboard event capture and serialization
- Input throttling for mouse move and scroll events
- Socket.IO client hooks for signaling
- Connection state management and UI feedback
- Responsive layout

#### Integration & Testing
- `test-integration.mjs` — integration test suite (11 tests)
  - Server health check
  - Socket.IO connection
  - Host registration and session code generation
  - Client join (admin and viewer roles)
  - WebRTC signaling relay (offer/answer/ICE)
  - Peer disconnect notification
  - Session expiry handling
  - Error code validation

#### Project Infrastructure
- pnpm workspaces monorepo configuration
- Root `package.json` with `dev:all`, `dev:server`, `dev:desktop`, `dev:client` scripts
- `concurrently` for parallel service startup with color-coded output
- `tsconfig.base.json` shared TypeScript configuration
- `.gitignore` for Node.js + Electron projects

### Fixed
- Electron crash on invalid `@jitsi/robotjs` key codes — added key code validation and safe fallback
- CommonJS/ESM interop issue in Electron build output
- `ELECTRON_RUN_AS_NODE` environment variable conflict with `concurrently` startup

### Known Issues
- Input control requires manual `@electron/rebuild` after Electron version changes
- No TURN server — WebRTC may fail behind symmetric NAT
- No authentication — session code is the only access control mechanism
- Desktop host only supported on Windows 10/11

---

## [0.1.0] — 2026-02-18 *(Internal — Agent Development)*

### Added
- Initial monorepo scaffold with pnpm workspaces
- Package stubs for `shared`, `server`, `desktop`, and `client`
- TypeScript base configuration

---

[Unreleased]: https://github.com/your-org/remote-desktop-app/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/remote-desktop-app/releases/tag/v1.0.0
[0.1.0]: https://github.com/your-org/remote-desktop-app/releases/tag/v0.1.0
