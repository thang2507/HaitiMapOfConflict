from flask import Blueprint, jsonify, request, send_file
from io import BytesIO
import os
import logging
import zipfile
from datetime import datetime

backup_api = Blueprint('backup_api', __name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
logger = logging.getLogger(__name__)


def _check_marker_api_key():
    expected_key = os.getenv('MARKER_API_KEY', '').strip()
    if not expected_key:
        return True

    provided_key = request.headers.get('X-Marker-Key', '').strip()
    return provided_key == expected_key

@backup_api.route('/backup_data')
def backup_data():
    if not _check_marker_api_key():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    try:
        memory_file = BytesIO()

        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in os.listdir(DATA_DIR):
                full_path = os.path.join(DATA_DIR, filename)
                if os.path.isfile(full_path):
                    zf.write(full_path, arcname=filename)

        memory_file.seek(0)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"backup_data_{timestamp}.zip"

        logger.info("Created backup archive %s", filename)

        return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=filename  # ✅ đúng chuẩn Flask >= 2.0
        )

    except Exception as e:
        logger.exception("Backup data request failed")
        return "Internal Server Error", 500
