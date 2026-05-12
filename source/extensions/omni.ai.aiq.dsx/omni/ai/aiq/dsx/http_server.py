"""HTTP API server for the DSX Agent.

Provides a REST API for the chat interface to communicate with the DSX
Agent AIQ network running inside Omniverse Kit.

Port defaults to 8012 and can be overridden via the DSX_AGENT_PORT
environment variable.

Endpoints:
    POST /api/agent/chat        — Send a message and get agent response (full JSON)
    POST /api/agent/chat/stream — SSE stream with progress updates + final response
    POST /api/agent/reset       — Clear conversation history for a user
    GET  /api/agent/health      — Health check
"""

import json
import os
import re
import time
import threading
import traceback
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional

def _install_typeddict_extra_items_compat():
    try:
        import typing
        from typing_extensions import TypedDict as TypedDictWithExtraItems

        class _ExtraItemsProbe(TypedDictWithExtraItems, extra_items=object):
            pass

        typing.TypedDict = TypedDictWithExtraItems
    except Exception as e:
        print(f"[omni.ai.aiq.dsx] TypedDict compatibility shim unavailable: {type(e).__name__}: {e}")

_install_typeddict_extra_items_compat()

import carb

try:
    from dsxcode.camera_utils import WAYPOINTS, CAMERAS, CAMERA_PATH_PREFIX
except ImportError:
    WAYPOINTS = {}
    CAMERAS = {}
    CAMERA_PATH_PREFIX = "/World/interactive_cameras/"

# Precompiled regex for stripping the "FINAL" prefix from agent responses
_FINAL_RE = re.compile(r'^\s*FINAL\s*')

# Kit's event loop — captured during startup from the main thread
_kit_loop = None

# TODO: Replace with persistent per-user storage when user authentication is introduced.
# Currently an in-memory dict that resets on Kit restart — sufficient for single-user local mode.
_user_preferences: dict = defaultdict(dict)

# Cached references from lc_agent (set during startup from main thread)
_get_node_factory = None
_RunnableNetwork = None
_RunnableHumanNode = None

def set_kit_event_loop(loop):
    """Store Kit's event loop reference for use from HTTP handler threads."""
    global _kit_loop
    _kit_loop = loop


def set_lc_agent_refs(get_node_factory, RunnableNetwork, RunnableHumanNode):
    """Cache lc_agent references so daemon threads don't need to re-import."""
    global _get_node_factory, _RunnableNetwork, _RunnableHumanNode
    _get_node_factory = get_node_factory
    _RunnableNetwork = RunnableNetwork
    _RunnableHumanNode = RunnableHumanNode


def _format_message_with_history(message: str, history: list) -> str:
    """Prepend conversation history to the current message.

    Args:
        message: The current user message.
        history: List of {"role": "user"|"assistant", "content": "..."} dicts.
                 Capped to the last 20 messages (~10 exchanges) to avoid
                 blowing up the prompt.

    Returns:
        A single string with history context prepended, or just the message
        if history is empty.
    """
    if not history:
        return message

    # Cap history to last 20 messages
    recent = history[-20:]
    lines = ["[Conversation History]"]
    for msg in recent:
        role = msg.get("role", "user").capitalize()
        lines.append(f"{role}: {msg.get('content', '')}")
    lines.append("")
    lines.append(f"[Current Request]\n{message}")
    return "\n".join(lines)


_MISSING_API_KEY_MSG = (
    "The NVIDIA_API_KEY environment variable is not set. "
    "The AI agent requires an API key to communicate with the LLM backend. "
    "Please obtain one from https://build.nvidia.com, set it as "
    "NVIDIA_API_KEY in your environment, and restart the application. "
    "The rest of the demo (3D viewer, camera controls, configurator) works without it."
)


def _build_network(message: str, history: list = None):
    """Build an agent network for the given message. Returns (network, error_str).

    Re-registers the agent with a fresh deep-copied config before every build.
    This is necessary because ``factory.create_node()`` mutates the stored
    config dict (stripping the ``omni.ai.aiq.dsx/`` prefix from ``_type``
    values during Pydantic validation).  Without a fresh copy, subsequent
    builds fail with ``union_tag_invalid``.
    """
    if _get_node_factory is None or _RunnableNetwork is None or _RunnableHumanNode is None:
        return None, "DSX Agent is not initialized. lc_agent references not set."

    if not os.environ.get("NVIDIA_API_KEY"):
        return None, _MISSING_API_KEY_MSG

    # Re-register with a fresh deep-copied config every time so create_node()
    # always gets unmutated prefixed _type values.
    from .extension import refresh_dsx_aiq
    if not refresh_dsx_aiq():
        return None, "Failed to refresh DSX Agent AIQ registration."

    factory = _get_node_factory()
    full_message = _format_message_with_history(message, history or [])

    try:
        with _RunnableNetwork() as network:
            _RunnableHumanNode(human_message=full_message)
            factory.create_node("DSX Agent AIQ")
        return network, None
    except Exception as e:
        return None, str(e)


def _extract_response_text(result) -> str:
    """Extract clean text from an agent result object."""
    if result is None:
        text = "Agent completed the task."
    elif hasattr(result, "content"):
        text = result.content
    else:
        text = str(result)
    # Strip the "FINAL" prefix the multi-agent framework prepends
    text = _FINAL_RE.sub('', text, count=1)
    return text.strip()


def _fire_manager_event(command_name: str, message: str):
    """Fire a carb event on Kit's message bus (same path as WebRTC messages).

    The ``ManagerExtension`` subscribes to ``send_message_from_event`` and
    routes by ``command_name`` — e.g. ``changeCamera``, ``changeGpu``,
    ``changeVisibility``.  This lets the non-stream HTTP endpoint apply
    actions (camera, GPU switch) directly on Kit without a WebRTC client.
    """
    try:
        import omni.kit.app
        import carb.events

        bus = omni.kit.app.get_app().get_message_bus_event_stream()
        event_type = carb.events.type_from_string("send_message_from_event")
        bus.push(event_type, payload={"command_name": command_name, "message": message})
        carb.log_info(f"[DSX Agent API] Fired manager event: {command_name}={message}")
    except Exception as e:
        carb.log_warn(f"[DSX Agent API] Failed to fire manager event: {e}")


def _run_async(coro, timeout: float = 120):
    """Run an async coroutine from a sync context (HTTP handler thread).

    Schedules the coroutine on Kit's main asyncio loop (which is always running)
    and blocks the HTTP thread until the result is ready.

    If the coroutine doesn't complete within `timeout` seconds, it is CANCELLED
    to prevent blocking Kit's event loop for subsequent requests.
    """
    import asyncio
    import concurrent.futures

    if _kit_loop and _kit_loop.is_running():
        future = concurrent.futures.Future()
        task_ref = [None]

        async def _wrapper():
            try:
                result = await coro
                future.set_result(result)
            except asyncio.CancelledError:
                future.set_exception(TimeoutError("Agent request cancelled after timeout"))
            except Exception as ex:
                future.set_exception(ex)

        def _schedule():
            task_ref[0] = asyncio.ensure_future(_wrapper())

        _kit_loop.call_soon_threadsafe(_schedule)

        try:
            return future.result(timeout=timeout)
        except (concurrent.futures.TimeoutError, TimeoutError):
            carb.log_warn(f"[DSX Agent API] Request timed out after {timeout}s — cancelling task")
            if task_ref[0] is not None:
                _kit_loop.call_soon_threadsafe(task_ref[0].cancel)
            raise TimeoutError(f"Agent request timed out after {timeout} seconds")
    else:
        carb.log_warn("[DSX Agent API] Kit event loop not available, using standalone loop")
        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(coro)
        finally:
            new_loop.close()


def _run_async_nonblocking(coro, timeout: float = 60):
    """Schedule an async coroutine on Kit's loop, return a (future, task_ref) immediately.

    The caller can poll `future.done()` and eventually call `future.result()`.
    On timeout the caller should cancel via `task_ref[0].cancel()`.
    """
    import asyncio
    import concurrent.futures

    future = concurrent.futures.Future()
    task_ref = [None]

    if not (_kit_loop and _kit_loop.is_running()):
        future.set_exception(RuntimeError("Kit event loop not available"))
        return future, task_ref

    async def _wrapper():
        try:
            result = await coro
            future.set_result(result)
        except asyncio.CancelledError:
            future.set_exception(TimeoutError("Agent request cancelled after timeout"))
        except Exception as ex:
            future.set_exception(ex)

    def _schedule():
        task_ref[0] = asyncio.ensure_future(_wrapper())

    _kit_loop.call_soon_threadsafe(_schedule)
    return future, task_ref


def _get_agent_response(message: str, user_id: str = "local-user",
                        history: list = None) -> dict:
    """Process a chat message through the DSX Agent AIQ network (blocking).

    Returns a dict with 'response' (str) and 'actions' (list).
    """
    try:
        t0 = time.monotonic()
        carb.log_info(f"[DSX Agent API] Building network for: {message[:80]}...")
        network, error = _build_network(message, history)
        if error:
            return {"response": error, "actions": []}
        t1 = time.monotonic()
        carb.log_info(f"[DSX Agent API] Network built in {t1 - t0:.2f}s — calling ainvoke()...")

        result = _run_async(network.ainvoke())
        t2 = time.monotonic()
        response_text = _extract_response_text(result)

        carb.log_info(f"[DSX Agent API] ainvoke() completed in {t2 - t1:.2f}s — "
                      f"response ({len(response_text)} chars): {response_text[:200]}")

        actions = _extract_actions(response_text)
        carb.log_info(f"[DSX Agent API] Actions: {actions}")

        return {
            "response": response_text,
            "actions": actions
        }

    except TimeoutError as e:
        carb.log_error(f"[DSX Agent API] TIMEOUT: {e}")
        return {
            "response": f"Request timed out: {str(e)}",
            "actions": []
        }
    except Exception as e:
        carb.log_error(f"Agent error: {e}")
        traceback.print_exc()
        return {
            "response": f"An error occurred while processing your request: {str(e)}",
            "actions": []
        }


def _extract_actions(response_text: str) -> list:
    """Extract actionable commands from agent response.

    Looks for patterns like camera navigations in the response text and maps
    them to the ACTUAL camera prim names that the web frontend expects (e.g.
    ``camera_ext_default_03``), using the same WAYPOINTS mapping that the
    agent's ``dsxcode.navigate_to_waypoint`` function uses.

    The web frontend validates camera names against a whitelist before sending
    them to Kit via WebRTC, so the names here MUST match the real scene prims.
    """
    actions = []
    text_lower = response_text.lower()

    # ── Isolation (POD / RPPs) ─────────────────────────────────────────
    # Deterministic detection: isolate_pod_rpps() / restore_pod_visibility()
    # set a flag with the prim paths to hide/show.  The frontend applies
    # them via WebRTC changeVisibility messages.
    is_isolation = False
    try:
        from dsxcode.visibility import get_and_clear_isolation_action
        iso_action = get_and_clear_isolation_action()
        if iso_action is not None:
            is_isolation = True
            actions.append({
                "type": "isolation_change",
                "isolation": iso_action,
            })
            if iso_action.get("isolate"):
                actions.append({
                    "type": "camera_change",
                    "camera_name": "/World/interactive_cameras/camera_int_datahall_04",
                })
            carb.log_info(f"[_extract_actions] Isolation action → isolate={iso_action.get('isolate')}")
    except ImportError:
        pass

    # ── CFD / Simulation visibility ────────────────────────────────────
    # Deterministic detection: visualize_cfd() sets a flag that we read
    # here.  Instead of directly showing the CFD layer, we emit a
    # simulation_change action that opens the Simulation panel's Thermal
    # tab and starts the test — same flow as the "Begin Test" button.
    is_cfd = False
    try:
        from dsxcode.visibility import get_and_clear_cfd_action
        cfd_action = get_and_clear_cfd_action()
        if cfd_action is not None:
            is_cfd = True
            actions.append({
                "type": "simulation_change",
                "panel": "thermal",
                "zone": "Data Hall",
                "start_test": cfd_action,
            })
            carb.log_info(f"[_extract_actions] Deterministic CFD action → start_test={cfd_action}")
    except ImportError:
        pass

    # ── Heat load change ──────────────────────────────────────────────────
    try:
        from dsxcode.visibility import get_and_clear_heat_load
        heat_load = get_and_clear_heat_load()
        if heat_load is not None:
            actions.append({
                "type": "simulation_change",
                "panel": "thermal",
                "zone": "Data Hall",
                "heat_load": heat_load,
            })
            carb.log_info(f"[_extract_actions] Heat load → {heat_load}%")
    except ImportError:
        pass

    # ── Electrical (power failure) test ────────────────────────────────────
    try:
        from dsxcode.visibility import get_and_clear_electrical_action
        elec_action = get_and_clear_electrical_action()
        if elec_action is not None:
            action_obj = {
                "type": "simulation_change",
                "panel": "electrical",
                "electrical_test": elec_action,
            }
            actions.append(action_obj)
            if elec_action.get("playing"):
                actions.append({
                    "type": "camera_change",
                    "camera_name": "/World/interactive_cameras/rpp_cameras",
                })
            carb.log_info(f"[_extract_actions] Electrical test action → {elec_action}")
    except ImportError:
        pass

    # ── Per-RPP whip visibility ────────────────────────────────────────
    try:
        from dsxcode.visibility import get_and_clear_rpp_visibility
        rpp_vis = get_and_clear_rpp_visibility()
        if rpp_vis is not None:
            actions.append({
                "type": "rpp_whip_visibility",
                "rpp_visible": rpp_vis,
            })
            carb.log_info(f"[_extract_actions] RPP whip visibility → {rpp_vis}")
    except ImportError:
        pass

    # ── Site configurator ──────────────────────────────────────────────────
    try:
        from dsxcode.visibility import get_and_clear_site_action
        site_action = get_and_clear_site_action()
        if site_action is not None:
            actions.append({"type": "site_change", **site_action})
            carb.log_info(f"[_extract_actions] Site change → {site_action}")
    except ImportError:
        pass

    # ── Power source ─────────────────────────────────────────────────────
    try:
        from dsxcode.visibility import get_and_clear_power_action
        power_action = get_and_clear_power_action()
        if power_action is not None:
            actions.append({"type": "power_change", "power_source": power_action})
            carb.log_info(f"[_extract_actions] Power change → {power_action}")
    except ImportError:
        pass

    # ── GPU / Rack variant switch ────────────────────────────────────────
    # Deterministic detection: switch_rack_variant() sets a flag that we
    # read here — no keyword matching needed.  The frontend applies the
    # actual visibility change via switchGpuVisibility() (the same function
    # that the configurator panel's GPU dropdown uses).
    is_gpu_change = False
    try:
        from dsxcode.visibility import get_and_clear_gpu_switch
        gpu_selection = get_and_clear_gpu_switch()
        if gpu_selection:
            is_gpu_change = True
            actions.append({
                "type": "gpu_change",
                "gpu_selection": gpu_selection,
            })
            carb.log_info(f"[_extract_actions] Deterministic GPU change → {gpu_selection}")
    except ImportError:
        pass

    # ── Camera navigation ────────────────────────────────────────────────
    # Detect navigation language in the response (skip if CFD or isolation already handled)
    if not is_cfd and not is_isolation and any(kw in text_lower for kw in ("navigat", "camera", "switch", "moved", "view")):
        # 1) BEST: match content-specific waypoint keywords in the response.
        #    This is more reliable than the camera prim name because the LLM
        #    sometimes picks the wrong waypoint (e.g. "hot_aisle" for a piping
        #    prompt), but the response text still mentions the correct topic.
        #    Priority order ensures specific matches win over generic ones.
        #
        #    Each entry is (keyword, aliases) where aliases are additional
        #    phrases that should also trigger this waypoint.  The supervisor
        #    response often rephrases — e.g. "site from the top" instead of
        #    "site_top", or "aerial view" instead of "overview".
        waypoint_cam = None
        if WAYPOINTS:
            priority_order = [
                ("piping",          ["piping", "pipes", "cooling pipe"]),
                ("cooling_pipes",   ["cooling_pipes"]),
                ("power",           ["power cable", "power infra"]),
                ("rpp",             ["rpp", "remote power panel"]),
                ("cdu",             ["cdu", "coolant distribution", "vcdu"]),
                ("networking",      ["networking", "network module"]),
                ("compute_tray",    ["compute tray", "compute_tray"]),
                ("cooling_towers",  ["cooling tower"]),
                ("hot_aisle",       ["hot aisle", "hot_aisle"]),
                ("containment",     ["containment"]),
                ("data_hall",       ["data hall", "data_hall", "datahall"]),
                ("racks",           ["racks", "gpu rack"]),
                ("gpu",             ["gpu"]),
                ("site_top",        ["site_top", "site top", "from the top",
                                     "from above", "aerial", "bird", "overview",
                                     "top view", "top-down"]),
                ("campus",          ["campus"]),
                ("exterior",        ["exterior"]),
            ]
            for wp_key, aliases in priority_order:
                if wp_key in WAYPOINTS:
                    if any(alias in text_lower for alias in aliases):
                        waypoint_cam = WAYPOINTS[wp_key]
                        carb.log_info(f"[_extract_actions] Matched waypoint '{wp_key}' via alias in response text")
                        break

        # 2) FALLBACK: extract an explicit camera prim name from the response
        #    e.g. "camera_int_datahall_03" or "cfd_camera".
        regex_cam = None
        cam_match = re.search(r'(camera_(?:int|ext)_\w+_\d+|cfd_camera|cdu_camera|networking_camera)', text_lower)
        if cam_match:
            matched = cam_match.group(1)
            if not CAMERAS or matched in CAMERAS:
                regex_cam = matched
                carb.log_info(f"[_extract_actions] Regex matched camera '{regex_cam}'")

        # Prefer waypoint match (content-specific) over regex (LLM's camera choice)
        chosen_cam = waypoint_cam or regex_cam
        if chosen_cam:
            # Send full prim path — frontend switchCamera() expects full paths
            full_path = f"{CAMERA_PATH_PREFIX}{chosen_cam}"
            actions.append({
                "type": "camera_change",
                "camera_name": full_path,
            })

    # Update backend camera tracking from any camera_change actions we emitted
    for action in actions:
        if action.get("type") == "camera_change" and action.get("camera_name"):
            cam = action["camera_name"]
            if "/" in cam:
                cam = cam.rsplit("/", 1)[-1]
            try:
                from dsxcode.visibility import sync_ui_state
                sync_ui_state({"current_camera": cam})
            except ImportError:
                pass
            break

    carb.log_info(f"[_extract_actions] text='{response_text[:120]}...' → actions={actions}")
    return actions


class DSXAgentHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the DSX Agent API."""
    
    def do_POST(self):
        if self.path == "/api/agent/chat/stream":
            self._handle_chat_stream()
        elif self.path == "/api/agent/chat":
            self._handle_chat()
        elif self.path == "/api/agent/preferences":
            self._handle_save_preferences()
        elif self.path == "/api/agent/state":
            self._handle_state_sync()
        else:
            self._send_json(404, {"error": "Not found"})

    def do_GET(self):
        if self.path == "/api/agent/health":
            has_key = bool(os.environ.get("NVIDIA_API_KEY"))
            has_agent = _get_node_factory is not None and _RunnableNetwork is not None
            self._send_json(200, {
                "status": "healthy",
                "agent": "DSX Agent AIQ",
                "agent_available": has_key and has_agent,
                "api_key_set": has_key,
            })
        elif self.path.startswith("/api/agent/preferences/"):
            self._handle_get_preferences()
        else:
            self._send_json(404, {"error": "Not found"})

    # ------------------------------------------------------------------
    # UI state sync — frontend POSTs current state so the agent is aware
    # of user-driven changes (tab switches, test start/stop, GPU, etc.)
    # ------------------------------------------------------------------

    def _handle_state_sync(self):
        """Receive UI state updates and sync to visibility.py module vars."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            else:
                body = {}
            from dsxcode.visibility import sync_ui_state
            sync_ui_state(body)
            self._send_json(200, {"status": "ok"})
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
        except Exception as e:
            carb.log_warn(f"[DSX Agent API] State sync error: {e}")
            self._send_json(500, {"error": "Internal server error"})

    # ------------------------------------------------------------------
    # Preferences (in-memory stub)
    # TODO: Wire up to persistent storage and validate auth tokens when
    #       user authentication is introduced.
    # ------------------------------------------------------------------

    def _handle_get_preferences(self):
        """Return saved preferences for a user."""
        user_id = self.path.rsplit("/", 1)[-1]
        self._send_json(200, _user_preferences.get(user_id, {}))

    def _handle_save_preferences(self):
        """Merge incoming preferences into the user's in-memory dict."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            else:
                body = {}
            user_id = body.pop("user_id", "local-user")
            _user_preferences[user_id].update(body)
            self._send_json(200, {"status": "ok"})
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
        except Exception as e:
            carb.log_error(f"[DSX Agent API] Preferences save error: {e}")
            self._send_json(500, {"error": "Internal server error"})

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self._add_cors_headers()
        self.end_headers()
    
    def _handle_chat(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            else:
                body = {}
            
            message = body.get("message", "")
            user_id = body.get("user_id", "local-user")
            history = body.get("history", [])

            if not message:
                self._send_json(400, {"error": "No message provided"})
                return

            carb.log_info(f"[DSX Agent API] Chat request from {user_id}: {message[:100]}...")

            result = _get_agent_response(message, user_id, history)

            # Non-stream endpoint: apply actions directly on Kit since there's
            # no streaming client / frontend to handle them (curl/PowerShell testing).
            # Uses the same carb message bus as the WebRTC path so the manager
            # extension processes them on Kit's main thread.
            if "actions" in result:
                for action in result["actions"]:
                    if action.get("type") == "camera_change" and action.get("camera_name"):
                        # Manager's set_active_camera searches by name, so pass full path
                        _fire_manager_event("changeCamera", action["camera_name"])
                    elif action.get("type") == "gpu_change" and action.get("gpu_selection"):
                        from dsxcode.visibility import GPU_GB200_PATH, GPU_GB300_PATH
                        gpu = action["gpu_selection"]
                        import json as _json
                        _fire_manager_event("changeVisibility",
                            _json.dumps({"prim_path": GPU_GB200_PATH, "visible": gpu == "GB200"}))
                        _fire_manager_event("changeVisibility",
                            _json.dumps({"prim_path": GPU_GB300_PATH, "visible": gpu == "GB300"}))
                    elif action.get("type") == "simulation_change":
                        import json as _json
                        if action.get("start_test") is not None:
                            cfd_path = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements"
                            _fire_manager_event("changeVisibility",
                                _json.dumps({"prim_path": cfd_path, "visible": action["start_test"]}))
                            if action["start_test"]:
                                _fire_manager_event("changeCamera", "/World/interactive_cameras/cfd_camera")
                        if action.get("heat_load") is not None:
                            load_prim = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements/Materials/DCDTMaterial/VolumeShader"
                            _fire_manager_event("setAttribute",
                                _json.dumps({"prim_path": load_prim, "attr_name": "inputs:load_level", "value": action["heat_load"]}))
                    elif action.get("type") == "rpp_whip_visibility" and action.get("rpp_visible"):
                        import json as _json
                        _fire_manager_event("rppWhipVisibility",
                            _json.dumps(action["rpp_visible"]))
                    elif action.get("type") == "isolation_change" and action.get("isolation"):
                        import json as _json
                        iso = action["isolation"]
                        for path in iso.get("hide", []):
                            _fire_manager_event("changeVisibility",
                                _json.dumps({"prim_path": path, "visible": False}))
                        for path in iso.get("show", []):
                            _fire_manager_event("changeVisibility",
                                _json.dumps({"prim_path": path, "visible": True}))

            self._send_json(200, result)
            
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
        except Exception as e:
            carb.log_error(f"[DSX Agent API] Error: {e}")
            self._send_json(500, {"error": "Internal server error"})

    def _handle_chat_stream(self):
        """Handle a streaming chat request via Server-Sent Events (SSE).

        Uses ainvoke() for a clean final response, but sends real-time progress
        status events while the multi-agent workflow is running. This avoids
        exposing noisy internal agent routing messages from astream().

        SSE event types:
            {"type": "status",  "message": "Thinking..."}
            {"type": "content", "content": "The camera has been moved..."}
            {"type": "done",    "actions": [...]}
            {"type": "error",   "error": "..."}
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            else:
                body = {}

            message = body.get("message", "")
            user_id = body.get("user_id", "local-user")
            history = body.get("history", [])

            if not message:
                self._send_json(400, {"error": "No message provided"})
                return

            carb.log_info(f"[DSX Agent API] Stream request from {user_id}: {message[:100]}...")

            # Send SSE headers — Connection: close ensures the browser reader
            # gets EOF when the handler returns (keep-alive would hang forever).
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self._add_cors_headers()
            self.end_headers()
            self.close_connection = True

            # Build network and validate
            network, error = _build_network(message, history)
            if error:
                self._write_sse({"type": "error", "error": error})
                return

            # Send initial status
            self._write_sse({"type": "status", "message": "Thinking..."})

            # Start ainvoke() non-blocking on Kit's event loop
            future, task_ref = _run_async_nonblocking(network.ainvoke(), timeout=120)

            # Progress messages shown at specific time thresholds
            progress_steps = [
                (3, "Analyzing your request..."),
                (7, "Running code..."),
                (15, "Executing in scene..."),
                (30, "Still working..."),
                (50, "Almost done..."),
            ]
            step_idx = 0
            start_time = time.monotonic()
            timeout_seconds = 120

            # Poll the future, sending progress updates while waiting
            while not future.done():
                elapsed = time.monotonic() - start_time

                # Timeout check
                if elapsed > timeout_seconds:
                    carb.log_warn(f"[DSX Agent API] Stream timed out after {timeout_seconds}s")
                    if task_ref[0] is not None:
                        _kit_loop.call_soon_threadsafe(task_ref[0].cancel)
                    self._write_sse({"type": "error", "error": "Request timed out"})
                    return

                # Send next progress status if threshold reached
                if step_idx < len(progress_steps) and elapsed >= progress_steps[step_idx][0]:
                    self._write_sse({"type": "status", "message": progress_steps[step_idx][1]})
                    step_idx += 1

                time.sleep(0.1)

            # Future is done — get result and stream it word-by-word
            try:
                result = future.result(timeout=0)
                response_text = _extract_response_text(result)
                actions = _extract_actions(response_text)

                carb.log_info(f"[DSX Agent API] Stream response ({len(response_text)} chars)")

                # Send actions IMMEDIATELY — before text streaming.
                # The code interpreter already set the camera on Kit, but the
                # streaming client's local tracking will override it back.
                # Sending the camera_change action now lets the frontend sync
                # the streaming client before the word-by-word text starts.
                if actions:
                    self._write_sse({"type": "actions", "actions": actions})

                # Stream the final response word-by-word for a typing effect.
                # Split into small chunks (~3 words each) and send with short delays.
                words = response_text.split(' ')
                chunk_size = 6  # words per SSE event (doubled to reduce flush calls)
                for i in range(0, len(words), chunk_size):
                    chunk = ' '.join(words[i:i + chunk_size])
                    # Add trailing space unless it's the last chunk
                    if i + chunk_size < len(words):
                        chunk += ' '
                    self._write_sse({"type": "content", "content": chunk})
                    time.sleep(0.08)  # 80ms between chunks — smooth typing feel

                self._write_sse({"type": "done"})

            except Exception as e:
                carb.log_error(f"[DSX Agent API] Stream agent error: {e}")
                self._write_sse({"type": "error", "error": "An error occurred while processing your request."})

        except (BrokenPipeError, ConnectionResetError):
            carb.log_info("[DSX Agent API] Client disconnected during stream")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
        except Exception as e:
            carb.log_error(f"[DSX Agent API] Stream error: {e}")
            traceback.print_exc()
            try:
                self._write_sse({"type": "error", "error": "An error occurred while processing your request."})
            except Exception:
                pass

    def _write_sse(self, data: dict):
        """Write a single SSE event to the response stream."""
        line = f"data: {json.dumps(data)}\n\n"
        self.wfile.write(line.encode("utf-8"))
        self.wfile.flush()

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Connection", "close")
        self._add_cors_headers()
        self.end_headers()
        self.close_connection = True
        self.wfile.write(json.dumps(data).encode("utf-8"))
    
    def _add_cors_headers(self):
        # Use the request Origin when available (required when credentials mode
        # is 'include' — wildcard '*' is rejected by browsers in that case).
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    
    def log_message(self, format, *args):
        """Suppress default HTTP logs — use carb logging instead."""
        pass


from socketserver import ThreadingMixIn


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """HTTPServer that handles each request in a separate thread.

    Python's default HTTPServer is single-threaded — a long-running agent
    request blocks health checks, SSE streams, and all other connections.
    ``ThreadingMixIn`` spawns a daemon thread per request.
    """
    daemon_threads = True


DSX_AGENT_PORT_DEFAULT = 8012


def start_http_server(host: str = "0.0.0.0", port: int | None = None) -> HTTPServer:
    if port is None:
        port = int(os.environ.get("DSX_AGENT_PORT", DSX_AGENT_PORT_DEFAULT))
    """Start the DSX Agent HTTP API server in a daemon thread."""
    server = ThreadedHTTPServer((host, port), DSXAgentHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True, name="DSX-Agent-HTTP")
    thread.start()
    carb.log_info(f"[DSX Agent API] HTTP server started on http://{host}:{port} (threaded)")
    return server


def stop_http_server(server: Optional[HTTPServer]):
    """Shutdown the HTTP server."""
    if server:
        server.shutdown()
        carb.log_info("[DSX Agent API] HTTP server stopped")
