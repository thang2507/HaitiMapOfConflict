from functools import wraps

from flask import current_app, jsonify, request, session


ROLE_LEVELS = {
    'guest': 1,
    'editor': 2,
    'admin': 3,
}


def normalize_role(role):
    normalized = (role or '').strip().lower()
    return normalized if normalized in ROLE_LEVELS else 'guest'


def current_user():
    username = session.get('username')
    role = normalize_role(session.get('role'))
    session_runtime_token = session.get('runtime_token')
    current_runtime_token = current_app.config.get('SESSION_RUNTIME_TOKEN')
    if not username:
        return None
    if not session_runtime_token or session_runtime_token != current_runtime_token:
        session.clear()
        return None
    return {
        'username': username,
        'role': role,
    }


def has_role(required_role):
    user = current_user()
    if not user:
        return False
    return ROLE_LEVELS[user['role']] >= ROLE_LEVELS[normalize_role(required_role)]


def login_user_session(user):
    session.clear()
    session.permanent = False
    session['username'] = user['username']
    session['role'] = normalize_role(user.get('role'))
    session['runtime_token'] = current_app.config.get('SESSION_RUNTIME_TOKEN')


def logout_user_session():
    session.clear()


def check_marker_api_key():
    return current_user() is not None


def require_marker_api_key(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        return view_func(*args, **kwargs)

    return wrapped


def require_login(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if current_user() is not None:
            return view_func(*args, **kwargs)
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    return wrapped


def require_role(required_role):
    required_role = normalize_role(required_role)

    def decorator(view_func):
        @wraps(view_func)
        def wrapped(*args, **kwargs):
            user = current_user()
            if user is None:
                return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
            if not has_role(required_role):
                return jsonify({'status': 'error', 'message': 'Forbidden'}), 403
            return view_func(*args, **kwargs)

        return wrapped

    return decorator
