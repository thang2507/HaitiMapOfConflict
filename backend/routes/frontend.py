from flask import Blueprint, send_from_directory

from backend.config import DATA_DIR, FRONTEND_DIR


frontend_api = Blueprint('frontend_api', __name__)


@frontend_api.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@frontend_api.route('/frontend/<path:filename>')
def serve_frontend(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@frontend_api.route('/<filename>.json')
def serve_json(filename):
    return send_from_directory(DATA_DIR, f'{filename}.json')
