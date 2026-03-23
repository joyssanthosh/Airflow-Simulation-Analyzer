import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key-for-dev'
    # Use MySQL as specified in requirements
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'mysql+pymysql://root:18%401972@localhost/airflow_db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
