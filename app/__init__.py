from flask import Flask
from flask_cors import CORS
import os
from .jobs import create_scheduler

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    # Get database URL from environment or use default
    database_url = os.getenv('DATABASE_URL', 'postgresql://todos_user:todos_password@localhost:5432/todos_db')
    
    from .storage import TodoStorage
    app.config['storage'] = TodoStorage(database_url)
    
    from .routes import api
    app.register_blueprint(api, url_prefix='/api')
    
    # Initialize and start the scheduler
    scheduler = create_scheduler(app)
    scheduler.start()
    
    return app 