# Build UI
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui-builder
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Final image
FROM alpine:3.19

LABEL org.opencontainers.image.title="RD Extension Debugger"
LABEL org.opencontainers.image.description="Debug tool for investigating Rancher Desktop extension internals"
LABEL org.opencontainers.image.vendor="Rancher Desktop Debug"
LABEL com.docker.desktop.extension.api.version="0.3.4"
LABEL com.docker.desktop.extension.icon="/icons/debug-icon.svg"

# Copy UI build
COPY --from=ui-builder /app/build /ui

# Copy metadata and icons
COPY metadata.json /
COPY icons/ /icons/

# Copy host binary wrapper scripts
COPY host/ /host/
RUN chmod +x /host/darwin/* /host/linux/*

# Install useful tools for container introspection
RUN apk add --no-cache coreutils
