#!/bin/bash
set -e

SERVER="root@65.109.8.114"
REMOTE_DIR="/app"
DOMAIN="bernd-api.mixedbread.com"

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

# Install deps, setup Caddy for HTTPS, and start server
ssh $SERVER "cd $REMOTE_DIR && \
  apt-get update && \
  apt-get install -y python3 python3-pip python3-venv debian-keyring debian-archive-keyring apt-transport-https curl && \
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true && \
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null && \
  apt-get update && apt-get install -y caddy && \
  python3 -m venv venv && \
  ./venv/bin/pip install fastapi uvicorn openai mixedbread google-api-python-client google-auth python-dotenv rich prompt-toolkit python-multipart && \
  pkill -f 'uvicorn backend.main' || true && \
  nohup ./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8080 > /var/log/bernd.log 2>&1 & \
  echo 'bernd-api.mixedbread.com {
    reverse_proxy localhost:8080
}' > /etc/caddy/Caddyfile && \
  systemctl restart caddy"

echo "Done! API running at https://$DOMAIN"
