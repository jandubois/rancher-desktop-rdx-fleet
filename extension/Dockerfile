# Build UI
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui-builder
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Final image
FROM alpine:3.19

LABEL org.opencontainers.image.title="Fleet GitOps"
LABEL org.opencontainers.image.description="GitOps-based developer environment provisioning using Fleet"
LABEL org.opencontainers.image.vendor="SUSE"
LABEL com.docker.desktop.extension.api.version="0.3.4"
LABEL com.docker.extension.categories="kubernetes,utility-tools"
LABEL com.docker.desktop.extension.icon="/icons/fleet-icon.svg"

# Copy UI build
COPY --from=ui-builder /app/build /ui

# Copy metadata and icons
COPY metadata.json /
COPY icons/ /icons/

# Copy host binary wrapper scripts
COPY host/ /host/
RUN chmod +x /host/darwin/* /host/linux/*
