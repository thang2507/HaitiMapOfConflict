import json
import os

from werkzeug.security import check_password_hash, generate_password_hash

from backend.config import USERS_FILE


VALID_ROLES = {'guest', 'editor', 'admin'}
DEFAULT_PASSWORD = 'Natcom@123'


def normalize_role(role):
    normalized = (role or '').strip().lower()
    return normalized if normalized in VALID_ROLES else 'editor'


def default_role_for_username(username):
    return 'admin' if (username or '').strip().lower() == 'admin' else 'editor'


def normalize_user_record(record):
    username = (record.get('username') or '').strip()
    if not username:
        return None

    normalized = {
        'username': username,
        'role': normalize_role(record.get('role') or default_role_for_username(username)),
    }

    password_hash = (record.get('password_hash') or '').strip()
    password = (record.get('password') or '').strip()
    if password_hash:
        normalized['password_hash'] = password_hash
    elif password:
        normalized['password_hash'] = generate_password_hash(password)
    return normalized


def load_users():
    if not os.path.exists(USERS_FILE):
        return []

    with open(USERS_FILE, 'r', encoding='utf-8') as handle:
        raw_users = json.load(handle)

    users = []
    for record in raw_users:
        normalized = normalize_user_record(record)
        if normalized:
            users.append(normalized)
    return users


def save_users(users):
    serializable = []
    for user in users:
        serializable.append({
            'username': user['username'],
            'password_hash': user['password_hash'],
            'role': normalize_role(user.get('role')),
        })

    with open(USERS_FILE, 'w', encoding='utf-8') as handle:
        json.dump(serializable, handle, ensure_ascii=False, indent=2)


def find_user(username):
    lookup = (username or '').strip().lower()
    for user in load_users():
        if user['username'].lower() == lookup:
            return user
    return None


def verify_user_password(user, password):
    password_hash = (user or {}).get('password_hash', '')
    if not password_hash:
        return False
    return check_password_hash(password_hash, password or '')


def create_user(username, password, role):
    normalized_username = (username or '').strip()
    if not normalized_username:
        raise ValueError('Username is required')
    normalized_password = (password or '').strip() or DEFAULT_PASSWORD
    if find_user(normalized_username):
        raise ValueError('Username already exists')

    users = load_users()
    users.append({
        'username': normalized_username,
        'password_hash': generate_password_hash(normalized_password),
        'role': normalize_role(role),
    })
    save_users(users)
    return {'username': normalized_username, 'role': normalize_role(role)}


def update_user_password(username, password):
    normalized_username = (username or '').strip()
    if not normalized_username:
        raise ValueError('Username is required')
    if not (password or '').strip():
        raise ValueError('Password is required')

    users = load_users()
    updated = False
    for user in users:
        if user['username'].lower() == normalized_username.lower():
            user['password_hash'] = generate_password_hash(password.strip())
            updated = True
            break

    if not updated:
        raise ValueError('User not found')

    save_users(users)


def update_user_password_with_current_password(username, current_password, new_password):
    normalized_username = (username or '').strip()
    if not normalized_username:
        raise ValueError('Username is required')
    if not (current_password or '').strip():
        raise ValueError('Current password is required')
    if not (new_password or '').strip():
        raise ValueError('New password is required')

    users = load_users()
    updated = False
    for user in users:
        if user['username'].lower() != normalized_username.lower():
            continue
        if not check_password_hash(user['password_hash'], current_password.strip()):
            raise ValueError('Current password is incorrect')
        user['password_hash'] = generate_password_hash(new_password.strip())
        updated = True
        break

    if not updated:
        raise ValueError('User not found')

    save_users(users)


def delete_user(username):
    normalized_username = (username or '').strip()
    users = load_users()
    remaining = [user for user in users if user['username'].lower() != normalized_username.lower()]
    if len(remaining) == len(users):
        raise ValueError('User not found')
    save_users(remaining)


def list_users():
    return [{'username': user['username'], 'role': user['role']} for user in load_users()]
