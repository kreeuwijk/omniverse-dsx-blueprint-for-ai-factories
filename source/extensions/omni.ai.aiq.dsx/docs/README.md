# DSX - Datacenter Digital Twin AI Agent

AI agent extension for the DSX Blueprint that enables natural language control of the datacenter digital twin.

## Prerequisites

- **`NVIDIA_API_KEY`** environment variable must be set. Get a key from [build.nvidia.com](https://build.nvidia.com/).
- **`deps/kit-usd-agents`** submodule must be cloned and built (handled automatically by `repo.bat build`).

## Capabilities
- **Waypoint Navigation**: Navigate to predefined locations (data hall, cooling towers, etc.)
- **Scene Authoring**: Modify scene elements (show/hide components, switch rack types)
- **Component Inspection**: Query scene structure and component details

## Architecture
Uses a MultiAgent workflow with:
- **Supervisor**: Routes queries to appropriate sub-agents
- **KitCodeInteractive**: Generates and executes USD Python code
- **KitInfo**: Queries scene structure (read-only)
