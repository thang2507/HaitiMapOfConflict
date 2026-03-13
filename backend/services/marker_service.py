import json
import logging
import os
import threading

import pandas as pd
from flask import jsonify

from backend.config import DATA_DIR
from backend.utils import file_version


logger = logging.getLogger(__name__)

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


def normalize_marker_type(marker_type):
    return (marker_type or '').strip().lower()


def marker_json_filename(marker_type):
    marker_config = MARKER_FILES.get(normalize_marker_type(marker_type))
    if not marker_config:
        return None
    return marker_config['filename']


def marker_file_path(marker_type):
    filename = marker_json_filename(marker_type)
    if not filename:
        return None
    return os.path.join(DATA_DIR, filename)


def marker_xlsx_filename(marker_type):
    marker_config = MARKER_FILES.get(normalize_marker_type(marker_type))
    if not marker_config:
        return None
    return marker_config.get('xlsx_filename')


def marker_xlsx_path(marker_type):
    filename = marker_xlsx_filename(marker_type)
    if not filename:
        return None
    return os.path.join(DATA_DIR, filename)


def convert_xlsx_to_json(xlsx_path, json_path, name_field='SiteName', additional_fields=None):
    df = pd.read_excel(xlsx_path)
    required_columns = {name_field, 'Longitude', 'Latitude'}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing columns in {os.path.basename(xlsx_path)}: {sorted(missing_columns)}")

    df['Longitude'] = pd.to_numeric(df['Longitude'], errors='coerce')
    df['Latitude'] = pd.to_numeric(df['Latitude'], errors='coerce')

    features = []
    additional_fields = additional_fields or []
    for _, row in df.iterrows():
        if pd.isna(row['Longitude']) or pd.isna(row['Latitude']):
            continue
        geometry = {'type': 'Point', 'coordinates': [row['Longitude'], row['Latitude']]}
        props = {name_field: row.get(name_field, '')}
        for field in additional_fields:
            props[field] = str(row.get(field, '')).strip()
        features.append({'type': 'Feature', 'geometry': geometry, 'properties': props})

    geojson_obj = {'type': 'FeatureCollection', 'features': features}
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(geojson_obj, f, ensure_ascii=False, indent=2)
    logger.info('Converted %s to %s with %d features', xlsx_path, json_path, len(features))


def infer_marker_type_from_payload(data):
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


def marker_rows_from_geojson(marker_type, data):
    marker_config = MARKER_FILES.get(normalize_marker_type(marker_type))
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


def marker_xlsx_dataframe(marker_type, data):
    marker_config = MARKER_FILES[normalize_marker_type(marker_type)]
    name_field = marker_config['name_field']
    columns = [name_field, 'Longitude', 'Latitude']
    rows = marker_rows_from_geojson(marker_type, data)
    normalized_rows = []
    for row in rows:
        normalized_row = {column: '' for column in columns}
        normalized_row.update(row)
        normalized_rows.append(normalized_row)
    return pd.DataFrame(normalized_rows, columns=columns)


def write_marker_bundle(marker_type, data, json_path, xlsx_path):
    json_temp_path = f'{json_path}.tmp'
    with open(json_temp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    xlsx_temp_path = None
    if xlsx_path:
        df = marker_xlsx_dataframe(marker_type, data)
        xlsx_temp_path = f'{xlsx_path}.tmp.xlsx'
        df.to_excel(xlsx_temp_path, index=False)

    os.replace(json_temp_path, json_path)
    if xlsx_temp_path:
        os.replace(xlsx_temp_path, xlsx_path)


def load_marker_collection(marker_type):
    path = marker_file_path(marker_type)
    if not path or not os.path.exists(path):
        response = jsonify({'type': 'FeatureCollection', 'features': []})
        response.headers['X-Data-Version'] = 'missing'
        return response

    with open(path, 'r', encoding='utf-8') as f:
        response = jsonify(json.load(f))
        response.headers['X-Data-Version'] = file_version(path)
        return response
