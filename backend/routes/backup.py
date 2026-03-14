import io
import logging
import os
import zipfile
from datetime import datetime

from flask import Blueprint, jsonify, send_file

from backend.auth import require_role
from backend.config import DATA_DIR
from backend.services.audit_service import write_audit_log


backup_api = Blueprint('backup_api', __name__)
logger = logging.getLogger(__name__)


@backup_api.route('/backup_data')
@require_role('admin')
def backup_data():
    try:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in os.listdir(DATA_DIR):
                full_path = os.path.join(DATA_DIR, filename)
                if os.path.isfile(full_path):
                    zf.write(full_path, arcname=filename)
        buffer.seek(0)

        filename = f"backup_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        logger.info('Created backup archive %s', filename)
        write_audit_log('backup.download', details={'filename': filename})

        return send_file(
            buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=filename,
        )
    except Exception:
        logger.exception('Backup data request failed')
        write_audit_log('backup.download', status='failed')
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500
