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
from backend.routes import conflict as conflict_routes
from backend.routes import frontend as frontend_routes
from backend.routes import markers as marker_routes
from backend.services import conflict_service, marker_service
from backend.utils.storage import file_version


class BackendSelfTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.exit_stack = ExitStack()
        self.data_dir = Path(self.temp_dir.name)
        self.frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
        (self.data_dir / "backup" / "conflict_template").mkdir(parents=True, exist_ok=True)

        self._write_conflict_files()

        self.exit_stack.enter_context(
            patch.dict(os.environ, {"MARKER_API_KEY": "selftest-key"}, clear=False)
        )
        self.exit_stack.enter_context(patch.object(conflict_routes, "DATA_DIR", str(self.data_dir)))
        self.exit_stack.enter_context(patch.object(marker_routes, "DATA_DIR", str(self.data_dir)))
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

        flask_app.config["TESTING"] = True
        self.client = flask_app.test_client()
        self.auth_headers = {"X-Marker-Key": "selftest-key"}

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

    def _xlsx_upload(self, rows):
        buffer = io.BytesIO()
        pd.DataFrame(rows).to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer

    def test_index_route_serves_frontend(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"HaitiMapOfConflict", response.data)
        self.assertIn(b"APP_VERSION", response.data)

    def test_conflict_geojson_serves_version_header(self):
        response = self.client.get("/Haiti_conflict_map.geojson")
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.get_data(as_text=True))
        self.assertEqual(payload["type"], "FeatureCollection")
        self.assertTrue(response.headers.get("X-Data-Version"))
        response.close()

    def test_save_conflict_data_updates_geojson_and_workbook(self):
        geojson_path = self.data_dir / "Haiti_conflict_map.geojson"
        version = file_version(str(geojson_path))

        response = self.client.post(
            "/save_conflict_data",
            json=[{"name": "Test Region", "conflict_level": "level2"}],
            headers={**self.auth_headers, "X-Data-Version": version},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "updated")

        saved_geojson = json.loads(geojson_path.read_text(encoding="utf-8"))
        self.assertEqual(
            saved_geojson["features"][0]["properties"]["conflict_level"], "level2"
        )

        saved_df = pd.read_excel(self.data_dir / "conflict_template.xlsx")
        self.assertEqual(saved_df.loc[0, "conflict_level"], "level2")

    def test_upload_conflict_accepts_valid_workbook(self):
        upload = self._xlsx_upload(
            [{"region_name": "Test Region", "conflict_level": "level1"}]
        )
        response = self.client.post(
            "/upload_conflict",
            data={"file": (upload, "conflict.xlsx")},
            headers=self.auth_headers,
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ok")

        saved_geojson = json.loads(
            (self.data_dir / "Haiti_conflict_map.geojson").read_text(encoding="utf-8")
        )
        self.assertEqual(
            saved_geojson["features"][0]["properties"]["conflict_level"], "level1"
        )

    def test_upload_endpoints_create_marker_files(self):
        upload_cases = [
            (
                "/upload_site",
                "site.xlsx",
                [{"SiteName": "Alpha", "Longitude": -72.3, "Latitude": 18.5, "MainNode": "Mainnode"}],
                "SitePosition.json",
                "SiteName",
            ),
            (
                "/upload_police",
                "police.xlsx",
                [{"PoliceName": "PNH 1", "Longitude": -72.31, "Latitude": 18.51}],
                "PolicePosition.json",
                "PoliceName",
            ),
            (
                "/upload_bandit",
                "bandit.xlsx",
                [{"BanditName": "Gang 1", "Longitude": -72.32, "Latitude": 18.52}],
                "BanditPosition.json",
                "BanditName",
            ),
            (
                "/upload_showroom",
                "showroom.xlsx",
                [{"ShowroomName": "Showroom 1", "Longitude": -72.33, "Latitude": 18.53}],
                "ShowroomPosition.json",
                "ShowroomName",
            ),
            (
                "/upload_hq",
                "hq.xlsx",
                [{"HQName": "Natcom_HQ", "Longitude": -72.34, "Latitude": 18.54}],
                "HQ_Position.json",
                "HQName",
            ),
        ]

        for endpoint, filename, rows, json_name, name_field in upload_cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint,
                    data={"file": (self._xlsx_upload(rows), filename)},
                    headers=self.auth_headers,
                    content_type="multipart/form-data",
                )
                self.assertEqual(response.status_code, 200)
                saved_path = self.data_dir / json_name
                self.assertTrue(saved_path.exists())
                payload = json.loads(saved_path.read_text(encoding="utf-8"))
                self.assertEqual(payload["type"], "FeatureCollection")
                self.assertEqual(payload["features"][0]["properties"][name_field], rows[0][name_field])

    def test_load_markers_returns_uploaded_collection(self):
        police_json = self.data_dir / "PolicePosition.json"
        police_json.write_text(
            json.dumps(
                {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {"type": "Point", "coordinates": [-72.31, 18.51]},
                            "properties": {"PoliceName": "PNH 1"},
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

        response = self.client.get("/load_markers?type=police")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["features"][0]["properties"]["PoliceName"], "PNH 1")
        self.assertTrue(response.headers.get("X-Data-Version"))

    def test_upload_requires_auth_when_marker_key_is_configured(self):
        response = self.client.post(
            "/upload_police",
            data={"file": (self._xlsx_upload([{"PoliceName": "PNH", "Longitude": 0, "Latitude": 0}]), "police.xlsx")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
