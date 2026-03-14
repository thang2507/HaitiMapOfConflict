import json
from datetime import datetime, timezone

from flask import request

from backend.auth import current_user
from backend.config import AUDIT_LOG_FILE


def write_audit_log(action, status='success', details=None, username=None):
    actor = username
    if actor is None:
        user = current_user()
        actor = user['username'] if user else 'anonymous'

    payload = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'username': actor,
        'status': status,
        'action': action,
        'path': request.path if request else '',
        'method': request.method if request else '',
        'ip': request.headers.get('X-Forwarded-For', request.remote_addr) if request else '',
        'details': details or {},
    }

    with open(AUDIT_LOG_FILE, 'a', encoding='utf-8') as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + '\n')
