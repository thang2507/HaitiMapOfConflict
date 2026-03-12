import os
import json
import logging
import threading
from flask import Blueprint, request, jsonify

drawings_api = Blueprint('drawings_api', __name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DRAWING_FILE = os.path.join(DATA_DIR, 'drawings.geojson')

DRAW_BACKUP_FOLDER = os.path.join(DATA_DIR, 'backup', 'draw')
os.makedirs(DRAW_BACKUP_FOLDER, exist_ok=True)
logger = logging.getLogger(__name__)
DRAWINGS_LOCK = threading.Lock()


def _check_marker_api_key():
    expected_key = os.getenv('MARKER_API_KEY', '').strip()
    if not expected_key:
        return True

    provided_key = request.headers.get('X-Marker-Key', '').strip()
    return provided_key == expected_key


def _is_feature_collection(payload):
    return (
        isinstance(payload, dict)
        and payload.get('type') == 'FeatureCollection'
        and isinstance(payload.get('features'), list)
    )


@drawings_api.route('/load_drawings', methods=['GET'])
def load_drawings():
    try:
        if os.path.exists(DRAWING_FILE):
            with open(DRAWING_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify({"type": "FeatureCollection", "features": []})
    except Exception as exc:
        logger.exception("Failed to load drawings from %s", DRAWING_FILE)
        return jsonify({'status': 'error', 'message': str(exc)}), 500

@drawings_api.route('/save_drawings', methods=['POST'])
def save_drawings():
    from datetime import datetime
    import shutil

    if not _check_marker_api_key():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.json
    if not _is_feature_collection(data):
        return jsonify({'status': 'error', 'message': 'Invalid GeoJSON payload'}), 400

    os.makedirs(os.path.dirname(DRAWING_FILE), exist_ok=True)
    os.makedirs(DRAW_BACKUP_FOLDER, exist_ok=True)

    try:
        with DRAWINGS_LOCK:
            if os.path.exists(DRAWING_FILE):
                timestp = datetime.now().strftime('%d%m%y_%H%M%S')
                backup_path = os.path.join(DRAW_BACKUP_FOLDER, f'drawings_{timestp}.geojson')
                shutil.copyfile(DRAWING_FILE, backup_path)
                logger.info("Backed up drawings to %s", backup_path)
            else:
                logger.warning("No drawings file found to back up at %s", DRAWING_FILE)

            temp_path = f"{DRAWING_FILE}.tmp"
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(temp_path, DRAWING_FILE)

        logger.info("Saved drawings to %s", DRAWING_FILE)
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception("Failed to save drawings")
        return jsonify({'status': 'error', 'message': str(exc)}), 500
