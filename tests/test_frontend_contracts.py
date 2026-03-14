import unittest
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]


def read_text(relative_path):
    return (BASE_DIR / relative_path).read_text(encoding="utf-8")


class FrontendContractTests(unittest.TestCase):
    def test_index_loads_core_before_sidebar_and_feature_scripts(self):
        html = read_text("frontend/index.html")
        expected_order = [
            "frontend/scripts/core/app_state.js",
            "frontend/scripts/core/events.js",
            "frontend/scripts/api.js",
            "frontend/scripts/ui/sidebar_template.js",
            "frontend/scripts/ui/sidebar_bindings.js",
            "frontend/scripts/menu_panel.js",
            "frontend/scripts/auth_ui.js",
            "frontend/scripts/f_loadconflictmap.js",
            "frontend/scripts/legend.js",
            "frontend/scripts/draw.js",
            "frontend/scripts/upload_all_inputs.js",
        ]

        positions = [html.index(script_path) for script_path in expected_order]
        self.assertEqual(positions, sorted(positions))

    def test_sidebar_template_contains_name_icon_toggles(self):
        sidebar_template = read_text("frontend/scripts/ui/sidebar_template.js")
        expected_ids = [
            "toggleSiteLabel",
            "toggleSiteIcon",
            "togglePoliceLabel",
            "togglePoliceIcon",
            "toggleBanditLabel",
            "toggleBanditIcon",
            "toggleShowroomLabel",
            "toggleShowroomIcon",
            "toggleHQLabel",
            "toggleHQIcon",
            "toggleDrawnItems",
            "toggleDrawTools",
            "toggleLegendBtn",
            "toggleImportMenu",
            "importMenuSection",
            "logoutBtn",
            "currentUsername",
            "currentUserRole",
            "changePasswordBtn",
            "viewAuditLogBtn",
            "createUserModalBtn",
            "deleteUserModalBtn",
        ]
        for element_id in expected_ids:
            with self.subTest(element_id=element_id):
                self.assertIn(element_id, sidebar_template)

    def test_auth_ui_supports_role_based_visibility_and_user_management(self):
        auth_ui = read_text("frontend/scripts/auth_ui.js")
        self.assertIn("applyRoleVisibility", auth_ui)
        self.assertIn("/api/auth/me", auth_ui)
        self.assertIn("/api/auth/logout", auth_ui)
        self.assertIn("/api/audit-log", auth_ui)
        self.assertIn("/api/users", auth_ui)
        self.assertIn("data-required-role", read_text("frontend/scripts/ui/sidebar_template.js"))

    def test_upload_inputs_match_import_endpoints(self):
        sidebar_template = read_text("frontend/scripts/ui/sidebar_template.js")
        upload_inputs = read_text("frontend/scripts/upload_all_inputs.js")

        expected_pairs = {
            "siteInput": "/upload_site",
            "policeInput": "/upload_police",
            "banditInput": "/upload_bandit",
            "showroomInput": "/upload_showroom",
            "hqInput": "/upload_hq",
        }
        for input_id, endpoint in expected_pairs.items():
            with self.subTest(input_id=input_id):
                self.assertIn(input_id, sidebar_template)
                self.assertIn(input_id, upload_inputs)
                self.assertIn(endpoint, upload_inputs)

    def test_legend_toggle_defaults_to_checked_and_binds_after_sidebar_ready(self):
        sidebar_template = read_text("frontend/scripts/ui/sidebar_template.js")
        legend_js = read_text("frontend/scripts/legend.js")

        self.assertIn('type="checkbox" id="toggleLegendBtn" checked', sidebar_template)
        self.assertIn("toggleLegendBtn.addEventListener('change', syncLegendVisibility)", legend_js)
        self.assertIn("haitiMapApp.events.on('menuPanelReady', bindLegendToggle)", legend_js)
        self.assertIn("legend.addTo(map)", legend_js)

    def test_conflict_level_color_mapping_is_present(self):
        conflict_js = read_text("frontend/scripts/f_loadconflictmap.js")
        expected_levels = {
            "level0": "#2ecc71",
            "level1": "#f1c40f",
            "level2": "#e74c3c",
            "empty": "#ffffff00",
        }
        for level, color in expected_levels.items():
            with self.subTest(level=level):
                self.assertIn(f"case '{level}': return '{color}'", conflict_js)

    def test_site_and_operational_marker_scripts_reference_matching_toggle_ids(self):
        site_js = read_text("frontend/scripts/site_position.js")
        marker_js = read_text("frontend/scripts/x_Position.js")

        self.assertIn("toggleSiteIcon", site_js)
        self.assertIn("toggleSiteLabel", site_js)

        for marker_name in ["Police", "Bandit", "Showroom", "HQ"]:
            with self.subTest(marker=marker_name):
                self.assertIn(f"toggle{marker_name}Icon", marker_js)
                self.assertIn(f"toggle{marker_name}Label", marker_js)

    def test_sidebar_bindings_keep_import_menu_hidden_by_default(self):
        bindings_js = read_text("frontend/scripts/ui/sidebar_bindings.js")
        app_state_js = read_text("frontend/scripts/core/app_state.js")

        self.assertIn("toggleImportMenu.checked = !!app.state.ui.importMenuVisible", bindings_js)
        self.assertIn("importMenuSection.hidden = !app.state.ui.importMenuVisible", bindings_js)
        self.assertIn("importMenuVisible: false", app_state_js)
        self.assertIn("role: 'guest'", app_state_js)


if __name__ == "__main__":
    unittest.main()
