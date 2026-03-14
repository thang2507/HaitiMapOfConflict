import logging
import os
import shutil
from datetime import datetime

from flask import Blueprint, jsonify, request, send_from_directory

from backend.auth import require_role
from backend.config import DATA_DIR
from backend.services.audit_service import write_audit_log
from backend.services.marker_service import (
    MARKER_LOCKS,
    convert_xlsx_to_json,
    infer_marker_type_from_payload,
    load_marker_collection,
    marker_file_path,
    marker_json_filename,
    marker_xlsx_path,
    normalize_marker_type,
    write_marker_bundle,
)
from backend.utils import file_version


marker_api = Blueprint('marker_api', __name__)
logger = logging.getLogger(__name__)


def _handle_marker_upload(file_obj, xlsx_filename, json_filename, name_field):
    xlsx_path = os.path.join(DATA_DIR, xlsx_filename)
    file_obj.save(xlsx_path)
    convert_xlsx_to_json(xlsx_path, os.path.join(DATA_DIR, json_filename), name_field)
    return jsonify({'status': 'ok'})


@marker_api.route('/process_site_position', methods=['GET'])
def process_site_position():
    xlsx_path = os.path.join(DATA_DIR, 'SitePosition.xlsx')
    json_path = os.path.join(DATA_DIR, 'SitePosition.json')
    if not os.path.exists(xlsx_path):
        return jsonify({'status': 'error', 'message': 'SitePosition.xlsx not found'}), 404

    try:
        convert_xlsx_to_json(
            xlsx_path,
            json_path,
            name_field='SiteName',
            additional_fields=['MainNode'],
        )
        return jsonify({'status': 'ok', 'message': 'SitePosition.json created successfully'})
    except Exception as exc:
        logger.exception('Site position conversion failed for %s', xlsx_path)
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@marker_api.route('/upload_site', methods=['POST'])
@require_role('admin')
def upload_site():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(DATA_DIR, 'SitePosition.xlsx')
        file.save(xlsx_path)
        write_audit_log('markers.upload', details={'marker_type': 'site', 'filename': file.filename})
        return process_site_position()
    except Exception as exc:
        logger.exception('upload_site failed')
        write_audit_log('markers.upload', status='failed', details={'marker_type': 'site', 'reason': str(exc)})
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@marker_api.route('/upload_police', methods=['POST'])
@require_role('admin')
def upload_police():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400
        write_audit_log('markers.upload', details={'marker_type': 'police', 'filename': file.filename})
        return _handle_marker_upload(file, 'PolicePosition.xlsx', 'PolicePosition.json', 'PoliceName')
    except Exception as exc:
        logger.exception('upload_police failed')
        write_audit_log('markers.upload', status='failed', details={'marker_type': 'police', 'reason': str(exc)})
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@marker_api.route('/upload_showroom', methods=['POST'])
@require_role('admin')
def upload_showroom():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400
        write_audit_log('markers.upload', details={'marker_type': 'showroom', 'filename': file.filename})
        return _handle_marker_upload(file, 'ShowroomPosition.xlsx', 'ShowroomPosition.json', 'ShowroomName')
    except Exception as exc:
        logger.exception('upload_showroom failed')
        write_audit_log('markers.upload', status='failed', details={'marker_type': 'showroom', 'reason': str(exc)})
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@marker_api.route('/upload_bandit', methods=['POST'])
@require_role('admin')
def upload_bandit():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400
        write_audit_log('markers.upload', details={'marker_type': 'bandit', 'filename': file.filename})
        return _handle_marker_upload(file, 'BanditPosition.xlsx', 'BanditPosition.json', 'BanditName')
    except Exception as exc:
        logger.exception('upload_bandit failed')
        write_audit_log('markers.upload', status='failed', details={'marker_type': 'bandit', 'reason': str(exc)})
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@marker_api.route('/upload_hq', methods=['POST'])
@require_role('admin')
def upload_hq():
    file = request.files.get('file')
    if file and file.filename.endswith('.xlsx'):
        xlsx_path = os.path.join(DATA_DIR, 'HQ_Position.xlsx')
        file.save(xlsx_path)
        try:
            convert_xlsx_to_json(
                xlsx_path,
                os.path.join(DATA_DIR, 'HQ_Position.json'),
                name_field='HQName',
                additional_fields=[],
            )
            write_audit_log('markers.upload', details={'marker_type': 'hq', 'filename': file.filename})
            return jsonify({'status': 'ok', 'message': 'HQ_Position.json created successfully'})
        except Exception as exc:
            logger.exception('HQ position conversion failed for %s', xlsx_path)
            write_audit_log('markers.upload', status='failed', details={'marker_type': 'hq', 'reason': str(exc)})
            return jsonify({'status': 'error', 'message': str(exc)}), 500

    return jsonify({'status': 'error', 'message': 'Invalid file format. Please upload an .xlsx file'}), 400


@marker_api.route('/load_markers', methods=['GET'])
def load_markers():
    marker_type = normalize_marker_type(request.args.get('type'))
    filename = marker_json_filename(marker_type)
    if not filename:
        return jsonify({'status': 'error', 'message': 'Invalid marker type'}), 400
    return load_marker_collection(marker_type)


@marker_api.route('/save_markers', methods=['POST'])
@require_role('editor')
def save_markers():
    try:
        marker_type = normalize_marker_type(request.args.get('type'))
        data = request.get_json()
        if not data or data.get('type') != 'FeatureCollection' or 'features' not in data:
            return jsonify({'status': 'error', 'message': 'Invalid GeoJSON payload'}), 400

        filename = marker_json_filename(marker_type)
        if not filename:
            marker_type = infer_marker_type_from_payload(data)
            filename = marker_json_filename(marker_type)

        if not filename:
            return jsonify({
                'status': 'error',
                'message': f'Invalid marker type: {request.args.get("type", "")}'
            }), 400

        target_path = marker_file_path(marker_type)
        xlsx_path = marker_xlsx_path(marker_type)
        client_version = (request.headers.get('X-Data-Version') or '').strip() or 'missing'
        current_version = file_version(target_path)
        if client_version != current_version:
            return jsonify({
                'status': 'error',
                'message': 'Marker data has changed on the server. Reload and try again.',
                'current_version': current_version
            }), 409

        backup_folder = os.path.join(DATA_DIR, 'backup', marker_type)
        os.makedirs(backup_folder, exist_ok=True)

        with MARKER_LOCKS[marker_type]:
            current_version = file_version(target_path)
            if client_version != current_version:
                return jsonify({
                    'status': 'error',
                    'message': 'Marker data has changed on the server. Reload and try again.',
                    'current_version': current_version
                }), 409

            if os.path.exists(target_path):
                timestamp = datetime.now().strftime('%d%m%y_%H%M%S')
                backup_path = os.path.join(backup_folder, f'{marker_type}_{timestamp}.json')
                shutil.copyfile(target_path, backup_path)
                if xlsx_path and os.path.exists(xlsx_path):
                    backup_xlsx_path = os.path.join(backup_folder, f'{marker_type}_{timestamp}.xlsx')
                    shutil.copyfile(xlsx_path, backup_xlsx_path)

            write_marker_bundle(marker_type, data, target_path, xlsx_path)

        latest_version = file_version(target_path)
        response = jsonify({
            'status': 'ok',
            'message': f'{filename} updated',
            'version': latest_version
        })
        response.headers['X-Data-Version'] = latest_version
        write_audit_log('markers.save', details={'marker_type': marker_type, 'feature_count': len(data.get('features', []))})
        return response
    except Exception as exc:
        logger.exception('save_markers failed')
        write_audit_log('markers.save', status='failed', details={'reason': str(exc)})
        return jsonify({'status': 'error', 'message': str(exc)}), 500
