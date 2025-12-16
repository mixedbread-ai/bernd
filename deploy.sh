#!/bin/bash
set -e

SERVER="root@65.109.8.114"
REMOTE_DIR="/app"

echo "Deploying to $SERVER..."

# Create remote directory
ssh $SERVER "mkdir -p $REMOTE_DIR"

# Copy backend code
rsync -avz --delete \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude '*.pyc' \
  backend/ $SERVER:$REMOTE_DIR/backend/

# Copy .env
scp .env $SERVER:$REMOTE_DIR/.env

# Install deps and start server
ssh $SERVER "cd $REMOTE_DIR && \
  apt-get update && apt-get install -y python3 python3-pip python3-venv && \
  python3 -m venv venv && \
  ./venv/bin/pip install fastapi uvicorn openai mixedbread google-api-python-client google-auth python-dotenv rich prompt-toolkit && \
  pkill -f 'uvicorn backend.main' || true && \
  nohup ./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8080 > /var/log/bernd.log 2>&1 &"

echo "Done! API running at http://bernd-api.mixedbread.com:8080"
