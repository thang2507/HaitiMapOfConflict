import json
import logging
import os
import shutil
import threading
from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.auth import require_role
from backend.config import DATA_DIR, DRAW_BACKUP_DIR
from backend.services.audit_service import write_audit_log


drawings_api = Blueprint('drawings_api', __name__)
logger = logging.getLogger(__name__)
DRAWING_FILE = os.path.join(DATA_DIR, 'drawings.geojson')
DRAWINGS_LOCK = threading.Lock()


def _is_feature_collection(payload):
    return (
        isinstance(payload, dict)
        and payload.get('type') == 'FeatureCollection'
        and isinstance(payload.get('features'), list)
    )


def _read_drawings_collection():
    if not os.path.exists(DRAWING_FILE):
        return {'type': 'FeatureCollection', 'features': []}
    with open(DRAWING_FILE, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def _feature_identity(feature, index):
    if not isinstance(feature, dict):
        return f'feature:{index}'
    if feature.get('id') is not None:
        return f"id:{feature.get('id')}"
    properties = feature.get('properties', {})
    for key in ('id', '_id', 'drawId', '_drawId', 'name'):
        if properties.get(key) is not None:
            return f"{key}:{properties.get(key)}"
    return f'feature:{index}'


def _summarize_drawing_feature(feature):
    geometry = feature.get('geometry', {}) if isinstance(feature, dict) else {}
    return {
        'type': geometry.get('type'),
        'properties': feature.get('properties', {}) if isinstance(feature, dict) else {},
        'geometry': geometry,
    }


def _diff_drawings(before_collection, after_collection):
    before_features = before_collection.get('features', []) if isinstance(before_collection, dict) else []
    after_features = after_collection.get('features', []) if isinstance(after_collection, dict) else []

    before_index = {_feature_identity(feature, index): feature for index, feature in enumerate(before_features)}
    after_index = {_feature_identity(feature, index): feature for index, feature in enumerate(after_features)}

    created = []
    updated = []
    deleted = []

    for key, after_feature in after_index.items():
        before_feature = before_index.get(key)
        if before_feature is None:
            created.append({'before': None, 'after': _summarize_drawing_feature(after_feature)})
        elif before_feature != after_feature:
            updated.append({
                'before': _summarize_drawing_feature(before_feature),
                'after': _summarize_drawing_feature(after_feature),
            })

    for key, before_feature in before_index.items():
        if key not in after_index:
            deleted.append({'before': _summarize_drawing_feature(before_feature), 'after': None})

    return {
        'feature_count_before': len(before_features),
        'feature_count_after': len(after_features),
        'created': created,
        'updated': updated,
        'deleted': deleted,
    }


@drawings_api.route('/load_drawings', methods=['GET'])
def load_drawings():
    try:
        if os.path.exists(DRAWING_FILE):
            with open(DRAWING_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify({'type': 'FeatureCollection', 'features': []})
    except Exception as exc:
        logger.exception('Failed to load drawings from %s', DRAWING_FILE)
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@drawings_api.route('/save_drawings', methods=['POST'])
@require_role('editor')
def save_drawings():
    data = request.json
    if not _is_feature_collection(data):
        return jsonify({'status': 'error', 'message': 'Invalid GeoJSON payload'}), 400

    os.makedirs(os.path.dirname(DRAWING_FILE), exist_ok=True)
    os.makedirs(DRAW_BACKUP_DIR, exist_ok=True)

    try:
        with DRAWINGS_LOCK:
            before_collection = _read_drawings_collection()
            if os.path.exists(DRAWING_FILE):
                timestamp = datetime.now().strftime('%d%m%y_%H%M%S')
                backup_path = os.path.join(DRAW_BACKUP_DIR, f'drawings_{timestamp}.geojson')
                shutil.copyfile(DRAWING_FILE, backup_path)
                logger.info('Backed up drawings to %s', backup_path)
            else:
                logger.warning('No drawings file found to back up at %s', DRAWING_FILE)

            temp_path = f'{DRAWING_FILE}.tmp'
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(temp_path, DRAWING_FILE)

        logger.info('Saved drawings to %s', DRAWING_FILE)
        write_audit_log('drawings.save', details=_diff_drawings(before_collection, data))
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception('Failed to save drawings')
        write_audit_log('drawings.save', status='failed', details={'reason': str(exc)})
        return jsonify({'status': 'error', 'message': str(exc)}), 500
