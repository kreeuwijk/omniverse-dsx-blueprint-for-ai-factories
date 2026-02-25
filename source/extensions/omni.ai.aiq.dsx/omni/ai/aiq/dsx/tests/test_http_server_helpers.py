"""Unit tests for http_server.py pure helper functions.

Tests _format_message_with_history, _extract_response_text, _extract_actions,
and _build_network validation — all without starting an HTTP server or Kit.
"""

from unittest.mock import MagicMock, patch

import omni.kit.test

from omni.ai.aiq.dsx.http_server import (
    _format_message_with_history,
    _extract_response_text,
    _extract_actions,
    _build_network,
    set_lc_agent_refs,
)


class TestFormatMessageWithHistory(omni.kit.test.AsyncTestCase):
    async def test_empty_history(self):
        self.assertEqual(_format_message_with_history("hello", []), "hello")

    async def test_none_history(self):
        self.assertEqual(_format_message_with_history("hello", None), "hello")

    async def test_with_history(self):
        history = [
            {"role": "user", "content": "first question"},
            {"role": "assistant", "content": "first answer"},
        ]
        result = _format_message_with_history("second question", history)
        self.assertIn("[Conversation History]", result)
        self.assertIn("User: first question", result)
        self.assertIn("Assistant: first answer", result)
        self.assertIn("[Current Request]", result)
        self.assertIn("second question", result)

    async def test_caps_at_20_messages(self):
        history = [{"role": "user", "content": f"msg-{i}"} for i in range(30)]
        result = _format_message_with_history("current", history)
        self.assertNotIn("msg-0\n", result)
        self.assertNotIn("msg-9\n", result)
        self.assertIn("msg-10", result)
        self.assertIn("msg-29", result)

    async def test_role_capitalization(self):
        history = [{"role": "user", "content": "hi"}]
        result = _format_message_with_history("bye", history)
        self.assertIn("User: hi", result)

    async def test_missing_role_defaults_to_user(self):
        history = [{"content": "no role"}]
        result = _format_message_with_history("q", history)
        self.assertIn("User: no role", result)


class TestExtractResponseText(omni.kit.test.AsyncTestCase):
    async def test_none_result(self):
        self.assertEqual(_extract_response_text(None), "Agent completed the task.")

    async def test_result_with_content_attr(self):
        obj = MagicMock()
        obj.content = "the answer"
        self.assertEqual(_extract_response_text(obj), "the answer")

    async def test_plain_string(self):
        self.assertEqual(_extract_response_text("plain"), "plain")

    async def test_numeric_result(self):
        self.assertEqual(_extract_response_text(42), "42")


class TestExtractActions(omni.kit.test.AsyncTestCase):
    async def test_no_actions_from_generic_text(self):
        actions = _extract_actions("The datacenter has 22 deployment units.")
        self.assertEqual(actions, [])

    async def test_camera_navigation_from_prim_name(self):
        text = "I've navigated to camera_int_datahall_03 to show the piping."
        actions = _extract_actions(text)
        cam_names = [a["camera_name"] for a in actions if a["type"] == "camera_change"]
        self.assertIn("/World/interactive_cameras/camera_int_datahall_03", cam_names)

    async def test_isolation_action(self):
        text = "I've isolated the pod and made the RPPs visible."
        actions = _extract_actions(text)
        cam_names = [a["camera_name"] for a in actions if a["type"] == "camera_change"]
        self.assertIn("/World/interactive_cameras/camera_int_datahall_04", cam_names)

    async def test_cfd_overrides_separate_camera(self):
        text = "CFD simulation results are visible. Navigated to camera_int_datahall_01."
        actions = _extract_actions(text)
        cam_names = [a["camera_name"] for a in actions if a["type"] == "camera_change"]
        self.assertIn("/World/interactive_cameras/cfd_camera", cam_names)
        self.assertNotIn("/World/interactive_cameras/camera_int_datahall_01", cam_names)

    async def test_isolation_overrides_separate_camera(self):
        text = "I've isolated the RPPs and hidden other components. Switched to camera_int_datahall_01."
        actions = _extract_actions(text)
        cam_names = [a["camera_name"] for a in actions if a["type"] == "camera_change"]
        self.assertIn("/World/interactive_cameras/camera_int_datahall_04", cam_names)
        self.assertNotIn("/World/interactive_cameras/camera_int_datahall_01", cam_names)

    async def test_cfd_camera_reference_without_cfd_content(self):
        text = "Navigated to hot_aisle view using cfd_camera for the best angle."
        actions = _extract_actions(text)
        cfd_actions = [a for a in actions if a["type"] == "cfd_visibility"]
        self.assertEqual(len(cfd_actions), 0)

    async def test_waypoint_priority_piping_over_hot_aisle(self):
        text = "Navigated to view piping near the hot_aisle area using camera_int_datahall_03."
        actions = _extract_actions(text)
        cam_actions = [a for a in actions if a["type"] == "camera_change"]
        self.assertGreaterEqual(len(cam_actions), 1)
        # Waypoint match or regex match — both now return full prim paths
        self.assertTrue(cam_actions[0]["camera_name"].startswith("/World/interactive_cameras/"))


class TestBuildNetwork(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        set_lc_agent_refs(None, None, None)

    async def test_refs_not_set(self):
        network, error = _build_network("hello")
        self.assertIsNone(network)
        self.assertIn("not initialized", error)

    async def test_refresh_dsx_aiq_fails(self):
        set_lc_agent_refs(MagicMock(), MagicMock(), MagicMock())
        with patch.dict("os.environ", {"NVIDIA_API_KEY": "test-key"}), \
             patch("omni.ai.aiq.dsx.extension.refresh_dsx_aiq", return_value=False):
            network, error = _build_network("hello")
        self.assertIsNone(network)
        self.assertIn("Failed to refresh", error)

    async def tearDown(self):
        set_lc_agent_refs(None, None, None)
