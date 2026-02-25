FROM node:20-alpine AS build

WORKDIR /app
COPY package.json .
COPY package-lock.json .

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm install --ignore-scripts

COPY . .

RUN npm run build

# Install serve globally
RUN npm install -g serve

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

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Create startup script
RUN printf '#!/bin/sh\n' > /app/entrypoint.sh && \
    printf 'envsubst < /app/dist/config/main.json.template > /app/dist/config/main.json\n' >> /app/entrypoint.sh && \
    printf 'exec serve -s dist -l 8080\n' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]