# Build UI
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui-builder
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Build backend
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS backend-builder
ENV CGO_ENABLED=0
WORKDIR /backend
COPY vm/go.* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY vm/ ./
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o bin/service .

# Final image
FROM alpine:3.19

LABEL org.opencontainers.image.title="RD Extension Debugger"
LABEL org.opencontainers.image.description="Debug tool for investigating Rancher Desktop extension internals"
LABEL org.opencontainers.image.vendor="Rancher Desktop Debug"
LABEL com.docker.desktop.extension.api.version="0.3.4"
LABEL com.docker.desktop.extension.icon="/icons/debug-icon.svg"

# Copy UI build
COPY --from=ui-builder /app/build /ui

# Copy backend binary
COPY --from=backend-builder /backend/bin/service /

# Copy metadata and icons
COPY metadata.json /
COPY icons/ /icons/

# Copy host binary wrapper scripts
COPY host/ /host/
RUN chmod +x /host/darwin/* /host/linux/*

# Install useful tools for container introspection
RUN apk add --no-cache coreutils procps

# Start the backend service
CMD ["/service", "-socket", "/run/guest-services/rd-extension-debugger.sock"]
