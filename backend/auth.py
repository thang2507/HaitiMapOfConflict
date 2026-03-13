import os
from functools import wraps

from flask import jsonify, request


def check_marker_api_key():
    expected_key = os.getenv('MARKER_API_KEY', '').strip()
    if not expected_key:
        return True

    provided_key = request.headers.get('X-Marker-Key', '').strip()
    return provided_key == expected_key


def require_marker_api_key(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not check_marker_api_key():
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        return view_func(*args, **kwargs)

    return wrapped
