# System Architecture

## Overview

A datacenter digital twin platform combining GPU-accelerated 3D rendering with an AI agent. The Kit application renders and streams a USD scene via WebRTC, while the React frontend provides interactive controls and a chat-based AI assistant.

```
Local Streaming:                          NVCF Cloud:

Browser                                   Browser
   ↓ WebRTC (port 49100)                     ↓ OIDC auth
Local Kit Instance                        Web Portal (React)
   ↕ HTTP (port 8012)                        ↓ NVCF API
Kit Agent (in-process)                    GPU Container (Kit)
                                             ↓ WebRTC (session service)
                                          Browser (video + controls)
```

## Deployment Modes

The Kit application uses a layered configuration system. `dsx.kit` is the base application with all core extensions, rendering, CAE, and AI agent. The two streaming configs layer on top of it:

### Local Streaming (`dsx_streaming.kit`)

```
Browser ←── WebRTC (direct) ──→ Local Kit Instance
   ↕ HTTP (port 8012)
Kit Agent Server (in-process)
```

- **Depends on**: `dsx` + `omni.kit.livestream.app`
- **Use case**: Local development, single-user workstations with a local GPU
- **Streaming**: `omni.kit.livestream.app` provides WebRTC signaling on port 49100
- **Frontend entry point**: `index.html` → `streaming-main.tsx` (MockAuthProvider, no router)
- **Launch**: `run_streaming.sh` starts Kit with `--no-window`
- **Renderer**: Async GPU init enabled for faster startup

### NVCF Cloud (`dsx_nvcf.kit`)

```
Browser
   ↓
Web Portal (React + OIDC auth)
   ↓ (NVCF API)
NVIDIA Cloud Functions
   ↓ (launches container)
Kit Application (GPU container)
   ↓ (WebRTC stream via session service)
Browser (video + controls)
```

- **Depends on**: `dsx` + `omni.services.livestream.session` + `omni.ujitso.client` + `omni.cloud.open_stage`
- **Use case**: Multi-user cloud deployment, serverless GPU auto-scaling
- **Streaming**: `omni.services.livestream.session` manages cloud streaming sessions
- **Caching**: `omni.ujitso.client` for cached asset loading (geometry, materials)
- **Nucleus**: `omni.cloud.open_stage` for Nucleus cloud content access
- **Frontend entry point**: `main.tsx` with full OIDC auth, React Router, session management
- **Settings**: `ovc_deployment = true`, synchronous material loading, file picker restrictions

### Base Application (`dsx.kit`)

Shared by both modes. Provides:
- RTX Real-Time Path Tracing renderer (1920x1080 @ 60fps)
- CAE extensions (CFD, Flow, IndeX, CGNS/NPZ import)
- All four DSX extensions (`setup_extension`, `messaging_extension`, `manager`, `omni.ai.aiq.dsx`)
- Auto-loads the datacenter USD scene from Omniverse Nucleus
- Multi-GPU support, texture streaming, geometry streaming

## Components

### 1. Kit Application
- **Location**: `source/apps/`, `source/extensions/`
- **Purpose**: GPU-accelerated 3D rendering, scene management, and streaming
- **Tech**: Omniverse Kit SDK 109.0, RTX renderer, WebRTC, CAE/CFD visualization
- **Configs**: `dsx.kit` (base), `dsx_streaming.kit` (local), `dsx_nvcf.kit` (cloud)

### 2. Kit Extensions

#### `dsx.messaging_extension`
- **Location**: `source/extensions/dsx.messaging_extension/`
- **Purpose**: Bi-directional WebRTC messaging bridge between Kit and browser
- **Outgoing events**: `openedStageResult`, `stageSelectionChanged`, `getChildrenResponse`, `updateProgressAmount`
- **Incoming events**: `openStageRequest`, `selectPrimsRequest`, `makePrimsPickable`, `resetStage`

#### `dsx.setup_extension`
- **Location**: `source/extensions/dsx.setup_extension/`
- **Purpose**: Application initialization — USD context, Fabric scene delegate, viewport layout

#### `manager`
- **Location**: `source/extensions/manager/`
- **Purpose**: Routes incoming WebRTC commands to USD scene modifications
- **Commands**: `changeCamera`, `changeGpu`, `changeVisibility`, `setAttribute`
- **Modules**: `camera.py`, `variant.py`, `visibility.py`, `attribute.py`

#### `omni.ai.aiq.dsx`
- **Location**: `source/extensions/omni.ai.aiq.dsx/`
- **Purpose**: Multi-agent AI system with HTTP API for chat-driven scene control
- **HTTP server**: Threaded Python HTTP server on port 8012 (configurable via `DSX_AGENT_PORT`)
- **Agents**: LangChain supervisor routing between `DsxCodeInteractive` (code execution) and `DsxInfo` (scene queries)
- **LLM**: NIM-hosted `meta/llama-4-maverick-17b-128e-instruct`
- **Functions**: `navigate_to_waypoint`, `show_hot_aisle`, `visualize_cfd`, `switch_rack_variant`, visibility controls

### 3. Web Frontend
- **Location**: `web/`
- **Purpose**: Streaming client, interactive controls, and AI chat interface
- **Tech**: React, TypeScript, Vite, Mantine UI, TailwindCSS, ArcGIS maps
- **Entry points**:
  - `index.html` → `streaming-main.tsx` — Local Kit streaming (default), MockAuthProvider
  - `main.tsx` — NVCF portal mode with OIDC auth and React Router
  - `test-streaming.html` → `test-streaming.tsx` — Minimal stream testing

### 4. Dependencies
- **Location**: `deps/kit-cae/` — CAE schema and algorithm extensions
- **Location**: `deps/kit-usd-agents/` — LangChain agent framework (submodule)

## Communication Flow

### WebRTC Streaming (Real-time)

```
Web Frontend                          Kit Application
     │                                      │
     ├──── WebRTC signaling (port 49100) ──→│
     │←─── Video stream (VP9 1080p@60fps) ──┤
     │←─── Audio stream (Opus) ─────────────┤
     │                                      │
     ├──── Data channel commands ──────────→│
     │     (changeCamera, changeGpu, etc.)  │
     │         ↓                            │
     │     Kit Message Bus (carb.events)    │
     │         ↓                            │
     │     Manager Extension routes to:     │
     │       camera.py / variant.py /       │
     │       visibility.py / attribute.py   │
     │         ↓                            │
     │     USD Scene Modifications          │
     │                                      │
     │←─── Data channel events ────────────┤
     │     (stageSelectionChanged, etc.)    │
```

### AI Agent (HTTP)

```
Web Frontend (AgentPanel)
     │
     ├── POST /api/agent/chat/stream ──→ Kit HTTP Server (port 8012)
     │                                        │
     │                                   Build LangChain network
     │                                        │
     │                                   Supervisor routes to:
     │                                     DsxCodeInteractive / DsxInfo
     │                                        │
     │                                   Execute on Kit event loop
     │                                        │
     │                                   Extract actions from response
     │                                        │
     │←── SSE: status, content, actions ──────┤
     │                                        │
     │  Actions fired on carb message bus ────→ Manager Extension
     │  (changeCamera, changeGpu)                  ↓
     │                                        USD modifications
```

### Agent API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/chat` | POST | Blocking chat, returns `{response, actions}` |
| `/api/agent/chat/stream` | POST | SSE streaming with status/content/actions events |
| `/api/agent/reset` | POST | Clear conversation history for user |
| `/api/agent/health` | GET | Health check and API key validation |

## Web Frontend Architecture

### Providers & Context

```
QueryClientProvider
└── ThemeProvider
    └── MantineProvider
        └── MockAuthProvider (local) / AuthProvider (NVCF)
            └── DS9ConfigProvider (GPU, site, power state)
                └── SimulationProvider (thermal/electrical state)
                    └── UIProvider (panel visibility, active camera)
                        └── Page Component
```

### Key UI Components
- **Toolbar**: Left-side vertical icon bar — Agent, Configurator, Analytics, Simulations, Camera
- **AgentPanel**: Chat interface that sends messages and executes returned actions (camera, GPU, simulation, site, power changes)
- **ConfiguratorPanel**: Site/GPU/power configuration with ArcGIS map
- **SimulationPanel**: Thermal and electrical simulation controls
- **AnalyticsPanel**: Data visualization and KPIs
- **OmniverseStream**: Video/audio elements for WebRTC playback

### Routing (NVCF Mode)
- `/` — Home (app catalog)
- `/app/:appId` — App info
- `/app/:appId/sessions` — Session list
- `/app/:appId/sessions/:sessionId` — Remote streaming

## Scene Structure

```
/World
├── hall_GPUs (22 GPU deployment units)
├── rack_unit (rackVariant: GB200 / GB300 / Placeholder)
├── DATAHALL
│   ├── hall_hacs (Hot Aisle Containment)
│   ├── hall_mech_cooling_gb200 / gb300
│   ├── hall_trays_power, hall_remotepowerpanels, hall_powercables
├── BIM (Building Information Model)
│   ├── dsx_building, dsx_site, dsx_options, dsx_cubs, dsx_common
├── CFD_Layer (CGNS dataset — timesteps 40/60/80/100, pressure + temperature)
├── SKY (environment)
└── Cameras
    ├── camera_int_datahall_01–04 (interior views)
    ├── camera_ext_default_01–04 (exterior/aerial views)
    └── cfd_camera (CFD visualization)
```

## Ports & Configuration

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| WebRTC Signaling | 49100 | TCP | Connection negotiation |
| WebRTC Media | 47995–48012, 49000–49007 | TCP/UDP | Video/audio streams |
| Agent HTTP API | 8012 | HTTP | Chat and health endpoints |
| Web Dev Server | 8081 | HTTP | Vite dev server |
| Web (Docker) | 8080 | HTTP | Nginx serving frontend |

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DSX_AGENT_PORT` | Agent HTTP server port | `8012` |
| `NVIDIA_API_KEY` | LLM access (required for AI agent) | — |
| `USD_URL` | Scene to load | Omniverse Nucleus path |
| `VITE_DSX_AGENT_PORT` | Frontend agent port | `8012` |
| `VITE_OMNIVERSE_SERVER` | WebRTC signaling server | `localhost` |
| `VITE_SIGNALING_PORT` | WebRTC signaling port | `49100` |

## Build & Deployment

### Build System
- **Tool**: Premake5 + NVIDIA repo tools (`repo.sh`)
- **Steps**: Build CAE schemas → Build CAE extensions → Precache extensions → Build DSX app
- **Launch**: `run_streaming.sh` (Kit), `run_web.sh` (Vite dev server)

### Docker
- **Dockerfile**: Multi-stage — React build → Python Poetry → Debian Slim runtime
- **compose.yml**: `kit` (GPU, host network) + `web` (Nginx on port 8080)
- **nginx.conf**: Serves static React build, proxies `/api/` to `127.0.0.1:8000`, SPA routing

## Key Points

- **Two streaming modes**: Local (direct WebRTC) and NVCF (cloud-orchestrated)
- **In-process agent**: HTTP server runs as daemon thread inside Kit, shares its event loop
- **Ephemeral state**: Conversation history is in-memory, resets when Kit restarts
- **WebRTC messaging**: Bi-directional data channels for real-time scene commands
- **AI-driven control**: Agent parses natural language into camera, GPU, CFD, and visibility actions
- **Separate builds**: Kit (Premake5/repo.sh) and Web (Vite/npm) with different deployment targets
