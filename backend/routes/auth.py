from flask import Blueprint, jsonify, request

from backend.auth import (
    current_user,
    login_user_session,
    logout_user_session,
    require_login,
    require_role,
)
from backend.services.audit_service import read_audit_logs
from backend.services.user_service import (
    create_user,
    delete_user,
    find_user,
    list_users,
    update_user_password,
    update_user_password_with_current_password,
    verify_user_password,
)


auth_api = Blueprint('auth_api', __name__)


@auth_api.route('/api/auth/login', methods=['POST'])
def login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get('username') or '').strip()
    password = payload.get('password') or ''

    user = find_user(username)
    if not user or not verify_user_password(user, password):
        return jsonify({'status': 'error', 'message': 'Sai tên đăng nhập hoặc mật khẩu'}), 401

    login_user_session(user)
    return jsonify({
        'status': 'ok',
        'user': {'username': user['username'], 'role': user['role']},
    })


@auth_api.route('/api/auth/logout', methods=['POST'])
@require_login
def logout():
    logout_user_session()
    return jsonify({'status': 'ok'})


@auth_api.route('/api/auth/password', methods=['PUT'])
@require_login
def change_own_password():
    user = current_user()
    payload = request.get_json(silent=True) or {}

    try:
        update_user_password_with_current_password(
            user['username'],
            payload.get('current_password'),
            payload.get('new_password'),
        )
    except ValueError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 400

    return jsonify({'status': 'ok'})


@auth_api.route('/api/auth/me', methods=['GET'])
@require_login
def me():
    user = current_user()
    return jsonify({'status': 'ok', 'user': user})


@auth_api.route('/api/audit-log', methods=['GET'])
@require_role('editor')
def get_audit_log():
    limit = request.args.get('limit', 50)
    return jsonify({'status': 'ok', 'entries': read_audit_logs(limit)})


@auth_api.route('/api/users', methods=['GET'])
@require_role('admin')
def get_users():
    users = [user for user in list_users() if user['role'] == 'editor']
    return jsonify({'status': 'ok', 'users': users})


@auth_api.route('/api/users', methods=['POST'])
@require_role('admin')
def add_user():
    payload = request.get_json(silent=True) or {}
    try:
        user = create_user(payload.get('username'), payload.get('password'), 'editor')
    except ValueError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 400

    return jsonify({'status': 'ok', 'user': user}), 201


@auth_api.route('/api/users/<username>', methods=['DELETE'])
@require_role('admin')
def remove_user(username):
    user = current_user()
    if user and user['username'].lower() == username.lower():
        return jsonify({'status': 'error', 'message': 'Không thể tự xóa chính mình'}), 400
    target_user = find_user(username)
    if not target_user or target_user.get('role') != 'editor':
        return jsonify({'status': 'error', 'message': 'Chỉ được phép xóa user editor'}), 400

    try:
        delete_user(username)
    except ValueError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 404

    return jsonify({'status': 'ok'})


@auth_api.route('/api/users/<username>/password', methods=['PUT'])
@require_role('admin')
def reset_user_password(username):
    target_user = find_user(username)
    if not target_user or target_user.get('role') != 'editor':
        return jsonify({'status': 'error', 'message': 'Chỉ được phép đặt lại mật khẩu cho user editor'}), 400

    payload = request.get_json(silent=True) or {}
    try:
        update_user_password(username, payload.get('password'))
    except ValueError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 400

    return jsonify({'status': 'ok'})
