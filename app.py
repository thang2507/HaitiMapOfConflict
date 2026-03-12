from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
import os
import logging
import threading
import pandas as pd
import json
import geojson
import shutil
from datetime import datetime
from drawings_handler import drawings_api
from backupdb import backup_api


app = Flask(__name__)
app.register_blueprint(drawings_api)
app.register_blueprint(backup_api)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data')
BACKUP_FOLDER = os.path.join(UPLOAD_FOLDER, 'backup', 'conflict_template')
os.makedirs(BACKUP_FOLDER, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
CONFLICT_LOCK = threading.Lock()


@app.after_request
def disable_cache(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/frontend/<path:filename>')
def serve_frontend(filename):
    return send_from_directory(FRONTEND_DIR, filename)


def require_marker_api_key(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not _check_marker_api_key():
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        return view_func(*args, **kwargs)

    return wrapped

def convert_conflict_to_geojson(xlsx_path):
    df = pd.read_excel(xlsx_path)
    required_columns = {'region_name', 'conflict_level'}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing columns in conflict template: {sorted(missing_columns)}")

    conflict_map = dict(zip(df['region_name'], df['conflict_level']))
    base_geojson_path = os.path.join(UPLOAD_FOLDER, 'Haiti_conflict_map.geojson')
    if not os.path.exists(base_geojson_path):
        raise FileNotFoundError(f"Base conflict GeoJSON not found at {base_geojson_path}")

    with open(base_geojson_path, 'r', encoding='utf-8') as f:
        geo = geojson.load(f)

    for feature in geo['features']:
        shape_name = feature['properties'].get('ADM3_EN')
        if shape_name in conflict_map:
            feature['properties']['conflict_level'] = conflict_map[shape_name]

    temp_path = f"{base_geojson_path}.tmp"
    with open(temp_path, 'w', encoding='utf-8') as f:
        geojson.dump(geo, f, indent=2)
    os.replace(temp_path, base_geojson_path)
    logger.info("Updated conflict GeoJSON from %s with %d matching regions", xlsx_path, len(conflict_map))

def backup_conflict(xlsx_path):
    if not os.path.exists(xlsx_path):
        return

    timestp = datetime.now().strftime('%d%m%y_%H%M%S')
    backup_path = os.path.join(BACKUP_FOLDER, f"conflict_template_{timestp}.xlsx")
    shutil.copyfile(xlsx_path, backup_path)


def _conflict_geojson_path():
    return os.path.join(UPLOAD_FOLDER, 'Haiti_conflict_map.geojson')

@app.route('/upload_conflict', methods=['POST'])
@require_marker_api_key
def upload_conflict():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(UPLOAD_FOLDER, 'conflict_template.xlsx')
        backup_conflict(xlsx_path)
        file.save(xlsx_path)
        convert_conflict_to_geojson(xlsx_path)
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception("upload_conflict failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500


def convert_xlsx_to_json(xlsx_path, json_path, name_field='SiteName', additional_fields=None):
    """
    Chuyển đổi tệp Excel thành GeoJSON.
    :param xlsx_path: Đường dẫn tệp Excel đầu vào.
    :param json_path: Đường dẫn tệp GeoJSON đầu ra.
    :param name_field: Tên trường chính để hiển thị trong properties.
    :param additional_fields: Danh sách các trường bổ sung cần thêm vào properties.
    """
    df = pd.read_excel(xlsx_path)
    required_columns = {name_field, 'Longitude', 'Latitude'}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing columns in {os.path.basename(xlsx_path)}: {sorted(missing_columns)}")

    df['Longitude'] = pd.to_numeric(df['Longitude'], errors='coerce')
    df['Latitude'] = pd.to_numeric(df['Latitude'], errors='coerce')
    features = []
    additional_fields = additional_fields or []  # Nếu không có trường bổ sung, sử dụng danh sách rỗng
    for _, row in df.iterrows():
        if pd.isna(row['Longitude']) or pd.isna(row['Latitude']):
            continue
        geometry = {"type": "Point", "coordinates": [row['Longitude'], row['Latitude']]}
        props = {name_field: row.get(name_field, '')}
        
        # Thêm các trường bổ sung vào properties s
        for field in additional_fields:
            # Lấy giá trị của trường bổ sung, giữ nguyên giá trị dạng văn bản
            props[field] = str(row.get(field, '')).strip()

        features.append({"type": "Feature", "geometry": geometry, "properties": props})
    geojson_obj = {"type": "FeatureCollection", "features": features}
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(geojson_obj, f, ensure_ascii=False, indent=2)
    logger.info("Converted %s to %s with %d features", xlsx_path, json_path, len(features))

@app.route('/process_site_position', methods=['GET'])
def process_site_position():
    """
    Tự động đọc SitePosition.xlsx từ thư mục gốc, chuyển đổi thành SitePosition.json.
    """
    xlsx_path = os.path.join(UPLOAD_FOLDER, 'SitePosition.xlsx')
    json_path = os.path.join(UPLOAD_FOLDER, 'SitePosition.json')

    if not os.path.exists(xlsx_path):
        return jsonify({'status': 'error', 'message': 'SitePosition.xlsx not found'}), 404

    try:
        # Chuyển đổi tệp Excel thành GeoJSON
        convert_xlsx_to_json(
            xlsx_path,
            json_path,
            name_field='SiteName',
            additional_fields=['MainNode']
        )
        return jsonify({'status': 'ok', 'message': 'SitePosition.json created successfully'})
    except Exception as e:
        logger.exception("Site position conversion failed for %s", xlsx_path)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/upload_site', methods=['POST'])
@require_marker_api_key
def upload_site():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(UPLOAD_FOLDER, 'SitePosition.xlsx')
        file.save(xlsx_path)
        return process_site_position()
    except Exception as exc:
        logger.exception("upload_site failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@app.route('/upload_police', methods=['POST'])
@require_marker_api_key
def upload_police():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(UPLOAD_FOLDER, 'PolicePosition.xlsx')
        file.save(xlsx_path)
        convert_xlsx_to_json(xlsx_path, os.path.join(UPLOAD_FOLDER, 'PolicePosition.json'), 'PoliceName')
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception("upload_police failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@app.route('/upload_showroom', methods=['POST'])
@require_marker_api_key
def upload_showroom():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(UPLOAD_FOLDER, 'ShowroomPosition.xlsx')
        file.save(xlsx_path)
        convert_xlsx_to_json(xlsx_path, os.path.join(UPLOAD_FOLDER, 'ShowroomPosition.json'), 'ShowroomName')
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception("upload_showroom failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@app.route('/upload_bandit', methods=['POST'])
@require_marker_api_key
def upload_bandit():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.xlsx'):
            return jsonify({'status': 'error', 'message': 'Invalid file'}), 400

        xlsx_path = os.path.join(UPLOAD_FOLDER, 'BanditPosition.xlsx')
        file.save(xlsx_path)
        convert_xlsx_to_json(xlsx_path, os.path.join(UPLOAD_FOLDER, 'BanditPosition.json'), 'BanditName')
        return jsonify({'status': 'ok'})
    except Exception as exc:
        logger.exception("upload_bandit failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500

@app.route('/upload_hq', methods=['POST'])
@require_marker_api_key
def upload_hq():
    """
    Xử lý tải lên tệp HQ_Position.xlsx và chuyển đổi thành HQ_Position.json.
    """
    file = request.files.get('file')
    if file and file.filename.endswith('.xlsx'):
        xlsx_path = os.path.join(UPLOAD_FOLDER, 'HQ_Position.xlsx')
        file.save(xlsx_path)

        # Chuyển đổi tệp Excel thành GeoJSON
        try:
            convert_xlsx_to_json(
                xlsx_path,
                os.path.join(UPLOAD_FOLDER, 'HQ_Position.json'),
                name_field='HQName',  # Trường chính trong properties
                additional_fields=[]  # Không có trường bổ sung
            )
            return jsonify({'status': 'ok', 'message': 'HQ_Position.json created successfully'})
        except Exception as e:
            logger.exception("HQ position conversion failed for %s", xlsx_path)
            return jsonify({'status': 'error', 'message': str(e)}), 500

    return jsonify({'status': 'error', 'message': 'Invalid file format. Please upload an .xlsx file'}), 400

@app.route('/save_conflict_data', methods=['POST'])
@require_marker_api_key
def save_conflict_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400

        geojson_path = _conflict_geojson_path()
        if not os.path.exists(geojson_path):
            return jsonify({'status': 'error', 'message': 'GeoJSON file not found'}), 404

        client_version = (request.headers.get('X-Data-Version') or '').strip() or 'missing'
        current_version = _file_version(geojson_path)
        if client_version != current_version:
            return jsonify({
                'status': 'error',
                'message': 'Conflict data has changed on the server. Reload and try again.',
                'current_version': current_version
            }), 409

        xlsx_path = os.path.join(UPLOAD_FOLDER, 'conflict_template.xlsx')
        if not os.path.exists(xlsx_path):
            return jsonify({'status': 'error', 'message': 'Conflict template file not found'}), 404

        with CONFLICT_LOCK:
            current_version = _file_version(geojson_path)
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

            geojson_temp_path = f"{geojson_path}.tmp"
            xlsx_temp_path = f"{xlsx_path}.tmp.xlsx"
            with open(geojson_temp_path, 'w', encoding='utf-8') as f:
                geojson.dump(geo, f)
            df.to_excel(xlsx_temp_path, index=False)
            os.replace(geojson_temp_path, geojson_path)
            os.replace(xlsx_temp_path, xlsx_path)

        latest_version = _file_version(geojson_path)
        logger.info("Saved conflict data update with %d entries", len(level_map))
        response = jsonify({'status': 'updated', 'version': latest_version})
        response.headers['X-Data-Version'] = latest_version
        return response
    except Exception as exc:
        logger.exception("save_conflict_data failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500

# Serve static files
@app.route('/<filename>.json')
def serve_json(filename):
    path = os.path.join(UPLOAD_FOLDER, f'{filename}.json')
    if os.path.exists(path):
        return send_from_directory(UPLOAD_FOLDER, f'{filename}.json')
    return 'File not found', 404

@app.route('/Haiti_conflict_map.geojson')
def serve_geojson():
    response = send_from_directory(UPLOAD_FOLDER, 'Haiti_conflict_map.geojson')
    response.headers['X-Data-Version'] = _file_version(_conflict_geojson_path())
    return response

MARKER_FILES = {
    'police': {
        'filename': 'PolicePosition.json',
        'name_field': 'PoliceName',
        'xlsx_filename': 'PolicePosition.xlsx',
    },
    'bandit': {
        'filename': 'BanditPosition.json',
        'name_field': 'BanditName',
        'xlsx_filename': 'BanditPosition.xlsx',
    },
    'showroom': {
        'filename': 'ShowroomPosition.json',
        'name_field': 'ShowroomName',
        'xlsx_filename': 'ShowroomPosition.xlsx',
    },
}
MARKER_LOCKS = {marker_type: threading.Lock() for marker_type in MARKER_FILES}


def _normalize_marker_type(marker_type):
    return (marker_type or '').strip().lower()


def _marker_type_to_filename(marker_type):
    marker_config = MARKER_FILES.get(_normalize_marker_type(marker_type))
    if not marker_config:
        return None
    return marker_config['filename']


def _marker_type_to_path(marker_type):
    filename = _marker_type_to_filename(marker_type)
    if not filename:
        return None
    return os.path.join(UPLOAD_FOLDER, filename)


def _marker_type_to_xlsx_filename(marker_type):
    marker_config = MARKER_FILES.get(_normalize_marker_type(marker_type))
    if not marker_config:
        return None
    return marker_config.get('xlsx_filename')


def _marker_type_to_xlsx_path(marker_type):
    filename = _marker_type_to_xlsx_filename(marker_type)
    if not filename:
        return None
    return os.path.join(UPLOAD_FOLDER, filename)


def _file_version(path):
    if not path or not os.path.exists(path):
        return 'missing'
    stat = os.stat(path)
    return f"{stat.st_mtime_ns}-{stat.st_size}"


def _marker_version(marker_type):
    return _file_version(_marker_type_to_path(marker_type))


def _infer_marker_type_from_payload(data):
    if not isinstance(data, dict):
        return None

    features = data.get('features')
    if not isinstance(features, list) or not features:
        return None

    properties = features[0].get('properties', {})
    for marker_type, marker_config in MARKER_FILES.items():
        if marker_config['name_field'] in properties:
            return marker_type
    return None


def _marker_rows_from_geojson(marker_type, data):
    marker_config = MARKER_FILES.get(_normalize_marker_type(marker_type))
    if not marker_config:
        raise ValueError(f'Invalid marker type: {marker_type}')

    name_field = marker_config['name_field']
    rows = []
    for feature in data.get('features', []):
        geometry = feature.get('geometry', {})
        coordinates = geometry.get('coordinates', [])
        if geometry.get('type') != 'Point' or len(coordinates) < 2:
            continue

        properties = feature.get('properties', {})
        rows.append({
            name_field: properties.get(name_field, ''),
            'Longitude': coordinates[0],
            'Latitude': coordinates[1],
        })
    return rows


def _write_marker_xlsx(marker_type, data):
    xlsx_path = _marker_type_to_xlsx_path(marker_type)
    if not xlsx_path:
        raise ValueError(f'No xlsx file configured for marker type: {marker_type}')

    marker_config = MARKER_FILES[_normalize_marker_type(marker_type)]
    name_field = marker_config['name_field']
    columns = [name_field, 'Longitude', 'Latitude']

    rows = _marker_rows_from_geojson(marker_type, data)
    normalized_rows = []
    for row in rows:
        normalized_row = {column: '' for column in columns}
        normalized_row.update(row)
        normalized_rows.append(normalized_row)

    df = pd.DataFrame(normalized_rows, columns=columns)
    return df


def _write_marker_bundle(marker_type, data, json_path, xlsx_path):
    json_temp_path = f"{json_path}.tmp"
    with open(json_temp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    xlsx_temp_path = None
    if xlsx_path:
        df = _write_marker_xlsx(marker_type, data)
        xlsx_temp_path = f"{xlsx_path}.tmp.xlsx"
        df.to_excel(xlsx_temp_path, index=False)

    os.replace(json_temp_path, json_path)
    if xlsx_temp_path:
        os.replace(xlsx_temp_path, xlsx_path)


@app.route('/load_markers', methods=['GET'])
def load_markers():
    marker_type = _normalize_marker_type(request.args.get('type'))
    filename = _marker_type_to_filename(marker_type)

    if not filename:
        return jsonify({'status': 'error', 'message': 'Invalid marker type'}), 400

    path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(path):
        response = jsonify({"type": "FeatureCollection", "features": []})
        response.headers['X-Data-Version'] = 'missing'
        return response

    with open(path, 'r', encoding='utf-8') as f:
        response = jsonify(json.load(f))
        response.headers['X-Data-Version'] = _file_version(path)
        return response


def _check_marker_api_key():
    expected_key = os.getenv('MARKER_API_KEY', '').strip()
    if not expected_key:
        return True

    provided_key = request.headers.get('X-Marker-Key', '').strip()
    return provided_key == expected_key


@app.route('/save_markers', methods=['POST'])
@require_marker_api_key
def save_markers():
    try:
        marker_type = _normalize_marker_type(request.args.get('type'))

        data = request.get_json()
        if not data or data.get('type') != 'FeatureCollection' or 'features' not in data:
            return jsonify({'status': 'error', 'message': 'Invalid GeoJSON payload'}), 400

        filename = _marker_type_to_filename(marker_type)
        if not filename:
            marker_type = _infer_marker_type_from_payload(data)
            filename = _marker_type_to_filename(marker_type)

        if not filename:
            return jsonify({
                'status': 'error',
                'message': f'Invalid marker type: {request.args.get("type", "")}'
            }), 400

        target_path = os.path.join(UPLOAD_FOLDER, filename)
        xlsx_path = _marker_type_to_xlsx_path(marker_type)
        current_version = _file_version(target_path)
        client_version = (request.headers.get('X-Data-Version') or '').strip() or 'missing'
        if client_version != current_version:
            return jsonify({
                'status': 'error',
                'message': 'Marker data has changed on the server. Reload and try again.',
                'current_version': current_version
            }), 409

        backup_folder = os.path.join(UPLOAD_FOLDER, 'backup', marker_type)
        os.makedirs(backup_folder, exist_ok=True)

        with MARKER_LOCKS[marker_type]:
            current_version = _file_version(target_path)
            if client_version != current_version:
                return jsonify({
                    'status': 'error',
                    'message': 'Marker data has changed on the server. Reload and try again.',
                    'current_version': current_version
                }), 409

            if os.path.exists(target_path):
                timestp = datetime.now().strftime('%d%m%y_%H%M%S')
                backup_path = os.path.join(backup_folder, f"{marker_type}_{timestp}.json")
                shutil.copyfile(target_path, backup_path)
                if xlsx_path and os.path.exists(xlsx_path):
                    backup_xlsx_path = os.path.join(backup_folder, f"{marker_type}_{timestp}.xlsx")
                    shutil.copyfile(xlsx_path, backup_xlsx_path)

            _write_marker_bundle(marker_type, data, target_path, xlsx_path)

        response = jsonify({
            'status': 'ok',
            'message': f'{filename} updated',
            'version': _file_version(target_path)
        })
        response.headers['X-Data-Version'] = _file_version(target_path)
        return response
    except Exception as exc:
        logger.exception("save_markers failed")
        return jsonify({'status': 'error', 'message': str(exc)}), 500


if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG', '').lower() == 'true')
