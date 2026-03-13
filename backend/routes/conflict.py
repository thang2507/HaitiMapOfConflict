import logging
import os

import geojson
import pandas as pd
from flask import Blueprint, jsonify, request, send_from_directory

from backend.auth import require_marker_api_key
from backend.config import DATA_DIR
from backend.services.conflict_service import (
    CONFLICT_LOCK,
    backup_conflict,
    conflict_geojson_path,
    convert_conflict_to_geojson,
)
from backend.utils import file_version


conflict_api = Blueprint('conflict_api', __name__)
logger = logging.getLogger(__name__)


@conflict_api.route('/upload_conflict', methods=['POST'])
@require_marker_api_key
def upload_conflict():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(DATA_DIR, 'conflict_template.xlsx')
        backup_conflict(xlsx_path)
        file.save(xlsx_path)
        convert_conflict_to_geojson(xlsx_path)
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception('upload_conflict failed')
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@conflict_api.route('/save_conflict_data', methods=['POST'])
@require_marker_api_key
def save_conflict_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400

        geojson_path = conflict_geojson_path()
        if not os.path.exists(geojson_path):
            return jsonify({'status': 'error', 'message': 'GeoJSON file not found'}), 404

        client_version = (request.headers.get('X-Data-Version') or '').strip() or 'missing'
        current_version = file_version(geojson_path)
        if client_version != current_version:
            return jsonify({
                'status': 'error',
                'message': 'Conflict data has changed on the server. Reload and try again.',
                'current_version': current_version
            }), 409

        xlsx_path = os.path.join(DATA_DIR, 'conflict_template.xlsx')
        if not os.path.exists(xlsx_path):
            return jsonify({'status': 'error', 'message': 'Conflict template file not found'}), 404

        with CONFLICT_LOCK:
            current_version = file_version(geojson_path)
            if client_version != current_version:
                return jsonify({
                    'status': 'error',
                    'message': 'Conflict data has changed on the server. Reload and try again.',
                    'current_version': current_version
                }), 409

            with open(geojson_path, 'r', encoding='utf-8') as f:
                geo = geojson.load(f)

            level_map = {item['name']: item['conflict_level'] for item in data}
            backup_conflict(xlsx_path)
            df = pd.read_excel(xlsx_path)
            for feature in geo['features']:
                name = feature['properties'].get('ADM3_EN')
                if name in level_map:
                    feature['properties']['conflict_level'] = level_map[name]
                    df.loc[df['region_name'] == name, 'conflict_level'] = level_map[name]

            geojson_temp_path = f'{geojson_path}.tmp'
            xlsx_temp_path = f'{xlsx_path}.tmp.xlsx'
            with open(geojson_temp_path, 'w', encoding='utf-8') as f:
                geojson.dump(geo, f)
            df.to_excel(xlsx_temp_path, index=False)
            os.replace(geojson_temp_path, geojson_path)
            os.replace(xlsx_temp_path, xlsx_path)

        latest_version = file_version(geojson_path)
        logger.info('Saved conflict data update with %d entries', len(level_map))
        response = jsonify({'status': 'updated', 'version': latest_version})
        response.headers['X-Data-Version'] = latest_version
        return response
    except Exception as exc:
        logger.exception('save_conflict_data failed')
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@conflict_api.route('/Haiti_conflict_map.geojson')
def serve_geojson():
    response = send_from_directory(DATA_DIR, 'Haiti_conflict_map.geojson')
    response.headers['X-Data-Version'] = file_version(conflict_geojson_path())
    return response
