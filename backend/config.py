import os


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
DATA_DIR = os.path.join(BASE_DIR, 'data')
CONFLICT_BACKUP_DIR = os.path.join(DATA_DIR, 'backup', 'conflict_template')
DRAW_BACKUP_DIR = os.path.join(DATA_DIR, 'backup', 'draw')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
AUDIT_LOG_FILE = os.path.join(DATA_DIR, 'audit_log.jsonl')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CONFLICT_BACKUP_DIR, exist_ok=True)
os.makedirs(DRAW_BACKUP_DIR, exist_ok=True)
