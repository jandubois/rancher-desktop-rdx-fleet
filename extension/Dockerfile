# Build UI
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui-builder
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Build Backend
FROM --platform=$BUILDPLATFORM node:22-alpine AS backend-builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Final image - uses Node.js to run the backend service
FROM node:22-alpine

# Standard OCI labels
LABEL org.opencontainers.image.title="Fleet GitOps"
LABEL org.opencontainers.image.description="GitOps-based developer environment provisioning using Fleet"
LABEL org.opencontainers.image.vendor="SUSE"

# Docker Desktop extension labels
LABEL com.docker.desktop.extension.api.version="0.3.4"
LABEL com.docker.extension.categories="kubernetes,utility-tools"
LABEL com.docker.desktop.extension.icon="/icons/fleet-icon.svg"

# Fleet extension labels - used to identify and filter Fleet extensions
LABEL io.rancher-desktop.fleet.type="base"
LABEL io.rancher-desktop.fleet.version="1.0"
LABEL io.rancher-desktop.fleet.name="fleet-gitops"

# Copy UI build (for extension installation)
COPY --from=ui-builder /app/build /ui

# Copy backend build and dependencies
WORKDIR /backend
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./

# Copy metadata and icons
COPY metadata.json /
COPY icons/ /icons/

# Copy compose.yaml for backend service
COPY compose.yaml /

# Copy host binary wrapper scripts
COPY host/ /host/
RUN chmod +x /host/darwin/* /host/linux/*

# Copy scripts for config export
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# Environment variables for backend service
ENV PORT=8080
ENV EXTENSION_NAME=fleet-gitops
ENV EXTENSION_TYPE=base
ENV EXTENSION_VERSION=1.0.0

# Expose backend port
EXPOSE 8080

# Default command runs the backend service
# When used as an extension image for file extraction, Docker Desktop
# doesn't run this - it just extracts files from the image
# When started via compose.yaml, this runs the backend service
CMD ["node", "/backend/dist/index.js"]
