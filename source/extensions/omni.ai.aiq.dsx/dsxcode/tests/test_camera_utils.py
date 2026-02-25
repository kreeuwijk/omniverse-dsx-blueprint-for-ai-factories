"""Unit tests for dsxcode.camera_utils — waypoint navigation and camera presets."""

import omni.kit.test
from dsxcode.camera_utils import (
    navigate_to_waypoint,
    get_waypoint_names,
    get_camera_descriptions,
    CAMERAS,
    WAYPOINTS,
)


class TestNavigateToWaypoint(omni.kit.test.AsyncTestCase):
    async def test_known_waypoint(self):
        result = navigate_to_waypoint("data_hall")
        self.assertIn("camera_int_datahall_01", result)
        self.assertIn("Navigated", result)

    async def test_alias_same_camera(self):
        r1 = navigate_to_waypoint("data_hall")
        r2 = navigate_to_waypoint("datahall")
        self.assertIn("camera_int_datahall_01", r1)
        self.assertIn("camera_int_datahall_01", r2)

    async def test_direct_camera_name(self):
        result = navigate_to_waypoint("cfd_camera")
        self.assertIn("cfd_camera", result)
        self.assertIn("Navigated", result)

    async def test_unknown_waypoint(self):
        result = navigate_to_waypoint("nonexistent_place")
        self.assertIn("Unknown waypoint", result)
        self.assertIn("Available waypoints", result)

    async def test_case_insensitive(self):
        result = navigate_to_waypoint("Data_Hall")
        self.assertIn("camera_int_datahall_01", result)

    async def test_hyphen_normalization(self):
        result = navigate_to_waypoint("data-hall")
        self.assertIn("camera_int_datahall_01", result)

    async def test_space_normalization(self):
        result = navigate_to_waypoint("data hall")
        self.assertIn("camera_int_datahall_01", result)

    async def test_includes_camera_description(self):
        result = navigate_to_waypoint("cooling_towers")
        self.assertIn("camera_ext_default_03", result)
        self.assertIn(CAMERAS["camera_ext_default_03"], result)

    async def test_all_waypoints_resolve(self):
        """Every entry in WAYPOINTS should map to a camera that exists in CAMERAS."""
        for wp_name, cam_name in WAYPOINTS.items():
            self.assertIn(cam_name, CAMERAS, f"Waypoint '{wp_name}' maps to unknown camera '{cam_name}'")


class TestGetWaypointNames(omni.kit.test.AsyncTestCase):
    async def test_returns_sorted(self):
        names = get_waypoint_names()
        self.assertEqual(names, sorted(names))

    async def test_not_empty(self):
        self.assertGreater(len(get_waypoint_names()), 0)

    async def test_contains_known_waypoints(self):
        names = get_waypoint_names()
        self.assertIn("data_hall", names)
        self.assertIn("cooling_towers", names)
        self.assertIn("cfd", names)


class TestGetCameraDescriptions(omni.kit.test.AsyncTestCase):
    async def test_returns_all_cameras(self):
        descs = get_camera_descriptions()
        self.assertEqual(set(descs.keys()), set(CAMERAS.keys()))

    async def test_returns_copy(self):
        descs = get_camera_descriptions()
        descs["fake_camera"] = "injected"
        self.assertNotIn("fake_camera", CAMERAS)

    async def test_descriptions_are_strings(self):
        for cam, desc in get_camera_descriptions().items():
            self.assertIsInstance(desc, str, f"Camera '{cam}' description is not a string")
