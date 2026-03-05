"""DSX Code execution helper functions for the KitCodeInteractive agent.

Functions in this module are available to the agent for generating executable Python code.
Camera utilities, visibility controls, and datacenter-specific operations.
"""

from .storage import set_storage, get_storage, clear_storage, list_storage_keys
from .camera_utils import navigate_to_waypoint, get_waypoint_names, get_camera_descriptions
from .visibility import (
    show_hot_aisle, show_containment, show_cfd_results, visualize_cfd,
    show_component, switch_rack_variant, toggle_gpu, get_current_gpu, get_ui_state,
    set_heat_load,
    start_electrical_test, stop_electrical_test, set_electrical_params,
    set_site, set_power_source,
    hide_non_failing_rpps, show_all_rpp_whips,
    start_current_test, stop_current_test,
    isolate_pod_rpps, restore_pod_visibility,
    show_cdus, show_compute_tray, show_networking,
)
