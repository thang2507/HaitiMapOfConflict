import os
import secrets

from flask import Flask

from backend.routes import auth_api, backup_api, conflict_api, drawings_api, frontend_api, marker_api


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv('SECRET_KEY', 'haitimap-dev-secret')
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_RUNTIME_TOKEN'] = secrets.token_hex(16)
    app.register_blueprint(frontend_api)
    app.register_blueprint(auth_api)
    app.register_blueprint(drawings_api)
    app.register_blueprint(backup_api)
    app.register_blueprint(conflict_api)
    app.register_blueprint(marker_api)

    @app.after_request
    def disable_cache(response):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    return app
