# --- Stage 1: Build React frontend ---
FROM node:20-alpine AS build-frontend

WORKDIR /app/web
COPY web/package.json .
COPY web/package-lock.json .

RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

COPY web/ .

RUN npm run build

# Create main.json template with placeholders
RUN mkdir -p dist/config && \
    cat << 'EOF' > dist/config/main.json.template
{
 "auth": {
       "authority": "${AUTH_AUTHORITY}",
       "clientId": "${AUTH_CLIENT_ID}",
       "redirectUri": "${AUTH_REDIRECT_URI}",
       "metadataUri": "${AUTH_METADATA_URI}",
       "scope": "${AUTH_SCOPE}"
 },
 "endpoints": {
       "backend": "${BACKEND_URL}",
       "nucleus": "${NUCLEUS_URL}"
 },
 "sessions":  {
    "maxTtl": 28800,
    "sessionEndNotificationTime": 600,
    "sessionEndNotificationDuration": 30
 }
}
EOF

# --- Stage 2: Build Python Poetry backend (Debian Slim for glibc compatibility) ---
FROM python:3.13-slim-bookworm AS build-backend

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    POETRY_VERSION=1.8.3 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    ACCEPT_EULA=Y

ENV PATH="$POETRY_HOME/bin:$PATH"

# Install build dependencies including ODBC
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gettext-base \
    gnupg \
    unixodbc \
    unixodbc-dev \
    g++ \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR /app/backend
COPY backend/app app
COPY backend/migrations migrations
COPY backend/poetry.lock .
COPY backend/pyproject.toml .
COPY backend/README.md .

# Install runtime dependencies
RUN poetry install --only main --no-root

# Create placeholder settings for migrations
RUN cat << 'EOF' > /app/backend/settings.toml
root_path = "/api"
client_id = "placeholder"
nvcf_api_key = "placeholder"
metadata_uri = "https://placeholder/.well-known/openid-configuration"
jwks_alg = "RS256"
jwks_ttl = 1000
userinfo_ttl = 1000
admin_group = "${ADMIN_GROUP_ID}"
user_group = "${USER_GROUP_ID}"
max_app_instances_count = 2
EOF

# Run migrations
RUN mkdir -p db && poetry run migrations

# --- Stage 3: Debian Slim runtime with Python 3.13 + nginx + MSSQL ODBC ---
FROM python:3.13-slim-bookworm AS serve

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ACCEPT_EULA=Y

# Install nginx, supervisor, gettext, and ODBC dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    gettext-base \
    curl \
    gnupg \
    unixodbc \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create nginx user with UID 101
RUN groupadd -g 101 nginx 2>/dev/null || true && \
    useradd -u 101 -g nginx -s /bin/false -M nginx 2>/dev/null || true

# Copy React build to NGINX web root
RUN mkdir -p /usr/share/nginx/html && chown -R nginx:nginx /usr/share/nginx/html
COPY --from=build-frontend --chown=nginx:nginx /app/web/dist /usr/share/nginx/html

# Copy main.json template for runtime config generation
COPY --from=build-frontend --chown=nginx:nginx /app/web/dist/config/main.json.template /app/main.json.template

# Copy backend application
WORKDIR /app/backend
COPY --from=build-backend --chown=nginx:nginx /app/backend /app/backend

# Create settings.toml template for runtime
RUN cat << 'EOF' > /app/backend/settings.toml.template
root_path = "/api"
client_id = "${AUTH_CLIENT_ID}"
nvcf_api_key = "${NVCF_API_KEY}"
metadata_uri = "${AUTH_METADATA_URI}"
jwks_alg = "RS256"
jwks_ttl = 1000
userinfo_ttl = 1000
admin_group = "${ADMIN_GROUP_ID}"
user_group = "${USER_GROUP_ID}"
max_app_instances_count = 2
use_sqlserver = true
sql_host = "${SQL_HOST}"
sql_database = "${SQL_DATABASE}"
sql_user = "${SQL_USER}"
sql_password = "${SQL_PASSWORD}"
EOF

# NGINX config
COPY nginx.conf /etc/nginx/nginx.conf

# Create only the directories we actually need
RUN mkdir -p /var/log/nginx /run/nginx /tmp/nginx && \
    chown -R nginx:nginx /var/log/nginx /run/nginx /tmp/nginx /app

# Supervisor config to run both NGINX and API
RUN mkdir -p /etc/supervisor/conf.d && \
    cat << 'EOF' > /etc/supervisor/supervisord.conf
[supervisord]
nodaemon=true
user=nginx
logfile=/tmp/supervisord.log
pidfile=/tmp/supervisord.pid

[program:api]
command=/app/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
directory=/app/backend
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
autorestart=true

[program:nginx]
command=nginx -c /etc/nginx/nginx.conf -g "daemon off;"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
autorestart=true
EOF

# Create entrypoint script to generate configs once, then start supervisor
RUN cat << 'EOF' > /entrypoint.sh
#!/bin/sh
set -e

# Generate frontend config from template
envsubst < /app/main.json.template > /usr/share/nginx/html/config/main.json

# Generate backend config from template
envsubst < /app/backend/settings.toml.template > /app/backend/settings.toml

# Start supervisor
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
EOF

RUN chmod +x /entrypoint.sh && \
    chown -R nginx:nginx /app

USER nginx

EXPOSE 8080

CMD ["/entrypoint.sh"]