import logging
import os
import shutil
import threading
from datetime import datetime

import geojson
import pandas as pd

from backend.config import CONFLICT_BACKUP_DIR, DATA_DIR


logger = logging.getLogger(__name__)
CONFLICT_LOCK = threading.Lock()


def conflict_geojson_path():
    return os.path.join(DATA_DIR, 'Haiti_conflict_map.geojson')


def backup_conflict(xlsx_path):
    if not os.path.exists(xlsx_path):
        return

    timestamp = datetime.now().strftime('%d%m%y_%H%M%S')
    backup_path = os.path.join(CONFLICT_BACKUP_DIR, f'conflict_template_{timestamp}.xlsx')
    shutil.copyfile(xlsx_path, backup_path)


def convert_conflict_to_geojson(xlsx_path):
    df = pd.read_excel(xlsx_path)
    required_columns = {'region_name', 'conflict_level'}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing columns in conflict template: {sorted(missing_columns)}")

    conflict_map = dict(zip(df['region_name'], df['conflict_level']))
    geojson_path = conflict_geojson_path()
    if not os.path.exists(geojson_path):
        raise FileNotFoundError(f'Base conflict GeoJSON not found at {geojson_path}')

    with open(geojson_path, 'r', encoding='utf-8') as f:
        geo = geojson.load(f)

    for feature in geo['features']:
        shape_name = feature['properties'].get('ADM3_EN')
        if shape_name in conflict_map:
            feature['properties']['conflict_level'] = conflict_map[shape_name]

    temp_path = f'{geojson_path}.tmp'
    with open(temp_path, 'w', encoding='utf-8') as f:
        geojson.dump(geo, f, indent=2)
    os.replace(temp_path, geojson_path)
    logger.info('Updated conflict GeoJSON from %s with %d matching regions', xlsx_path, len(conflict_map))
