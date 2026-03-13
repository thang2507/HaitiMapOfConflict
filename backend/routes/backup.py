import logging
import os
import tempfile
import zipfile
from datetime import datetime

from flask import Blueprint, after_this_request, jsonify, send_file

from backend.auth import check_marker_api_key
from backend.config import DATA_DIR


backup_api = Blueprint('backup_api', __name__)
logger = logging.getLogger(__name__)


@backup_api.route('/backup_data')
def backup_data():
    if not check_marker_api_key():
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

        filename = f"backup_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        logger.info('Created backup archive %s', filename)

        @after_this_request
        def cleanup_temp_file(response):
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except OSError:
                logger.warning('Failed to remove temp backup file %s', temp_path)
            return response

        return send_file(
            temp_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name=filename,
        )
    except Exception:
        logger.exception('Backup data request failed')
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500
