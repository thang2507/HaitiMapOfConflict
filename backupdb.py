from flask import Blueprint, jsonify, request, send_file, after_this_request
import os
import logging
import tempfile
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
        temp_file = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
        temp_file.close()
        temp_path = temp_file.name

        with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in os.listdir(DATA_DIR):
                full_path = os.path.join(DATA_DIR, filename)
                if os.path.isfile(full_path):
                    zf.write(full_path, arcname=filename)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"backup_data_{timestamp}.zip"

        logger.info("Created backup archive %s", filename)

        @after_this_request
        def cleanup_temp_file(response):
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except OSError:
                logger.warning("Failed to remove temp backup file %s", temp_path)
            return response

        return send_file(
            temp_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name=filename
        )

    except Exception:
        logger.exception("Backup data request failed")
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500
