import io
import json
import os
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from app import app as flask_app
from backend.routes import backup as backup_routes
from backend.routes import conflict as conflict_routes
from backend.routes import drawings as drawings_routes
from backend.routes import frontend as frontend_routes
from backend.routes import markers as marker_routes
from backend.services import audit_service, conflict_service, marker_service, user_service
from backend.utils.storage import file_version


class BackendSelfTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.exit_stack = ExitStack()
        self.data_dir = Path(self.temp_dir.name)
        self.frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
        self.audit_log_file = self.data_dir / "audit_log.jsonl"
        (self.data_dir / "backup" / "conflict_template").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "backup" / "draw").mkdir(parents=True, exist_ok=True)

        self._write_conflict_files()
        self._write_users_file()

        self.exit_stack.enter_context(patch.object(conflict_routes, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(patch.object(marker_routes, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(patch.object(backup_routes, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(patch.object(frontend_routes, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(patch.object(frontend_routes, "FRONTEND_DIR", str(self.frontend_dir)))
        self.exit_stack.enter_context(patch.object(conflict_service, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(
            patch.object(
                conflict_service,
                "CONFLICT_BACKUP_DIR",
                str(self.data_dir / "backup" / "conflict_template"),
            )
        )
        self.exit_stack.enter_context(patch.object(marker_service, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(patch.object(user_service, "USERS_FILE", str(self.data_dir / "users.json")))
        self.exit_stack.enter_context(patch.object(audit_service, "AUDIT_LOG_FILE", str(self.audit_log_file)))
        self.exit_stack.enter_context(patch.object(drawings_routes, "DRAWING_FILE", str(self.data_dir / "drawings.geojson")))
        self.exit_stack.enter_context(patch.object(drawings_routes, "DRAW_BACKUP_DIR", str(self.data_dir / "backup" / "draw")))

        flask_app.config["TESTING"] = True
        self.client = flask_app.test_client()

    def tearDown(self):
        self.client = None
        self.exit_stack.close()
        self.temp_dir.cleanup()

    def _write_conflict_files(self):
        geojson_path = self.data_dir / "Haiti_conflict_map.geojson"
        workbook_path = self.data_dir / "conflict_template.xlsx"
        geojson_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"ADM3_EN": "Test Region", "conflict_level": "level0"},
                    "geometry": {"type": "Polygon", "coordinates": []},
                }
            ],
        }
        geojson_path.write_text(json.dumps(geojson_payload), encoding="utf-8")
        pd.DataFrame(
            [{"region_name": "Test Region", "conflict_level": "level0"}]
        ).to_excel(workbook_path, index=False)
        (self.data_dir / "drawings.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "features": []}),
            encoding="utf-8",
        )

    def _write_users_file(self):
        (self.data_dir / "users.json").write_text(
            json.dumps(
                [
                    {"username": "admin", "password": "Natcom@123", "role": "admin"},
                    {"username": "guest", "password": "Natcom@123", "role": "guest"},
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    def create_editor_user(self, username="editor", password="Natcom@123"):
        user_service.create_user(username, password, "editor")

    def _xlsx_upload(self, rows):
        buffer = io.BytesIO()
        pd.DataFrame(rows).to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer

    def login(self, username, password):
        response = self.client.post(
            "/api/auth/login",
            json={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 200)
        return response

    def read_audit_entries(self):
        if not self.audit_log_file.exists():
            return []
        return [
            json.loads(line)
            for line in self.audit_log_file.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    def test_root_serves_frontend_when_unauthenticated(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"HaitiMapOfConflict", response.data)

    def test_login_logout_and_current_user(self):
        self.create_editor_user()
        login_response = self.login("editor", "Natcom@123")
        self.assertEqual(login_response.json["user"]["role"], "editor")

        me_response = self.client.get("/api/auth/me")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json["user"]["username"], "editor")

        logout_response = self.client.post("/api/auth/logout")
        self.assertEqual(logout_response.status_code, 200)

        me_after_logout = self.client.get("/api/auth/me")
        self.assertEqual(me_after_logout.status_code, 401)

    def test_restart_like_runtime_token_change_invalidates_existing_session(self):
        self.login("admin", "Natcom@123")
        original_token = flask_app.config["SESSION_RUNTIME_TOKEN"]
        flask_app.config["SESSION_RUNTIME_TOKEN"] = "new-runtime-token"
        try:
            response = self.client.get("/api/auth/me")
            self.assertEqual(response.status_code, 401)
        finally:
            flask_app.config["SESSION_RUNTIME_TOKEN"] = original_token

    def test_admin_and_editor_can_change_own_password(self):
        self.create_editor_user()
        self.login("editor", "Natcom@123")
        editor_change = self.client.put(
            "/api/auth/password",
            json={"current_password": "Natcom@123", "new_password": "Editor@456"},
        )
        self.assertEqual(editor_change.status_code, 200)

        self.client.post("/api/auth/logout")
        editor_relogin = self.client.post(
            "/api/auth/login",
            json={"username": "editor", "password": "Editor@456"},
        )
        self.assertEqual(editor_relogin.status_code, 200)

        self.login("admin", "Natcom@123")
        admin_change = self.client.put(
            "/api/auth/password",
            json={"current_password": "Natcom@123", "new_password": "Admin@456"},
        )
        self.assertEqual(admin_change.status_code, 200)

    def test_conflict_geojson_serves_version_header(self):
        response = self.client.get("/Haiti_conflict_map.geojson")
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.get_data(as_text=True))
        self.assertEqual(payload["type"], "FeatureCollection")
        self.assertTrue(response.headers.get("X-Data-Version"))
        response.close()

    def test_guest_cannot_use_editor_or_admin_routes(self):
        save_response = self.client.post(
            "/save_conflict_data",
            json=[{"name": "Test Region", "conflict_level": "level2"}],
        )
        self.assertEqual(save_response.status_code, 401)

        backup_response = self.client.get("/backup_data")
        self.assertEqual(backup_response.status_code, 401)

    def test_editor_can_save_conflict_data_but_not_backup(self):
        self.create_editor_user()
        self.login("editor", "Natcom@123")
        geojson_path = self.data_dir / "Haiti_conflict_map.geojson"
        version = file_version(str(geojson_path))

        response = self.client.post(
            "/save_conflict_data",
            json=[{"name": "Test Region", "conflict_level": "level2"}],
            headers={"X-Data-Version": version},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "updated")
        saved_geojson = json.loads(geojson_path.read_text(encoding="utf-8"))
        self.assertEqual(saved_geojson["features"][0]["properties"]["conflict_level"], "level2")

        backup_response = self.client.get("/backup_data")
        self.assertEqual(backup_response.status_code, 403)

    def test_admin_can_upload_conflict_and_markers_and_download_backup(self):
        self.login("admin", "Natcom@123")

        conflict_upload = self._xlsx_upload(
            [{"region_name": "Test Region", "conflict_level": "level1"}]
        )
        conflict_response = self.client.post(
            "/upload_conflict",
            data={"file": (conflict_upload, "conflict.xlsx")},
            content_type="multipart/form-data",
        )
        self.assertEqual(conflict_response.status_code, 200)

        marker_upload = self._xlsx_upload(
            [{"PoliceName": "PNH 1", "Longitude": -72.31, "Latitude": 18.51}]
        )
        marker_response = self.client.post(
            "/upload_police",
            data={"file": (marker_upload, "police.xlsx")},
            content_type="multipart/form-data",
        )
        self.assertEqual(marker_response.status_code, 200)
        self.assertTrue((self.data_dir / "PolicePosition.json").exists())

        backup_response = self.client.get("/backup_data")
        self.assertEqual(backup_response.status_code, 200)
        self.assertEqual(backup_response.mimetype, "application/zip")
        backup_response.close()

    def test_editor_can_save_markers_and_drawings(self):
        self.create_editor_user()
        self.login("editor", "Natcom@123")

        marker_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [-72.31, 18.51]},
                    "properties": {"PoliceName": "PNH 1"},
                }
            ],
        }

        save_markers_response = self.client.post(
            "/save_markers?type=police",
            json=marker_payload,
            headers={"X-Data-Version": "missing"},
        )
        self.assertEqual(save_markers_response.status_code, 200)

        save_drawings_response = self.client.post(
            "/save_drawings",
            json={"type": "FeatureCollection", "features": []},
        )
        self.assertEqual(save_drawings_response.status_code, 200)

    def test_admin_can_manage_users(self):
        self.login("admin", "Natcom@123")

        list_response = self.client.get("/api/users")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json["users"], [])

        create_response = self.client.post(
            "/api/users",
            json={"username": "newuser"},
        )
        self.assertEqual(create_response.status_code, 201)

        login_new_user = self.client.post(
            "/api/auth/login",
            json={"username": "newuser", "password": "Natcom@123"},
        )
        self.assertEqual(login_new_user.status_code, 200)

        self.login("admin", "Natcom@123")

        reset_response = self.client.put(
            "/api/users/newuser/password",
            json={"password": "111111"},
        )
        self.assertEqual(reset_response.status_code, 200)

        delete_response = self.client.delete("/api/users/newuser")
        self.assertEqual(delete_response.status_code, 200)

    def test_audit_log_is_written_for_login_and_mutations(self):
        self.create_editor_user()
        self.login("editor", "Natcom@123")
        geojson_path = self.data_dir / "Haiti_conflict_map.geojson"
        version = file_version(str(geojson_path))

        self.client.post(
            "/save_conflict_data",
            json=[{"name": "Test Region", "conflict_level": "level2"}],
            headers={"X-Data-Version": version},
        )

        actions = [entry["action"] for entry in self.read_audit_entries()]
        self.assertIn("auth.login", actions)
        self.assertIn("conflict.save", actions)


if __name__ == "__main__":
    unittest.main()
