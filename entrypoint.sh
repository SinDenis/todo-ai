#!/bin/bash

# Wait for Postgres to be ready
wait-for-it postgres:5432 -t 60

# Install pgvector extension
PGPASSWORD=todos_password psql -h postgres -U todos_user -d todos_db -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Apply migrations
alembic upgrade head

# Start the application
python run.py 