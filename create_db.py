import pymysql
import os
from config import Config

# Parse URI: mysql+pymysql://root:18%401972@localhost/airflow_db
uri = Config.SQLALCHEMY_DATABASE_URI
# Extract user, password, host
import urllib.parse
parts = uri.replace('mysql+pymysql://', '').split('@')
user_pass = parts[0].split(':')
user = user_pass[0]
password = urllib.parse.unquote(user_pass[1]) if len(user_pass) > 1 else ''
host = parts[1].split('/')[0]

try:
    connection = pymysql.connect(host=host, user=user, password=password)
    with connection.cursor() as cursor:
        cursor.execute("CREATE DATABASE IF NOT EXISTS airflow_db")
        print("Successfully created database 'airflow_db'")
    connection.commit()
    connection.close()
except Exception as e:
    print(f"Failed to create database: {e}")
