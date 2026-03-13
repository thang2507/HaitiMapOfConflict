from flask import Flask

from backend.routes import backup_api, conflict_api, drawings_api, frontend_api, marker_api


def create_app():
    app = Flask(__name__)
    app.register_blueprint(frontend_api)
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
