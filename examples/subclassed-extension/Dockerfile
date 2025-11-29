# Subclassed Extension Example
#
# This Dockerfile demonstrates how to create a customized extension
# by inheriting from the base Fleet GitOps extension image.
#
# Build with:
#   docker build -t my-company-fleet:dev .
#
# Install with:
#   docker extension install my-company-fleet:dev

# Use the base Fleet GitOps extension as the parent image
# Replace with your actual base image tag (e.g., from Docker Hub)
ARG BASE_IMAGE=fleet-gitops-extension:latest
FROM ${BASE_IMAGE}

# Update labels for the subclassed extension
LABEL org.opencontainers.image.title="My Company Fleet"
LABEL org.opencontainers.image.description="Customized Fleet GitOps extension for My Company"
LABEL org.opencontainers.image.vendor="My Company"

# Override the metadata.json with custom configuration
COPY metadata.json /metadata.json

# Override the manifest with custom cards and branding
COPY manifest.yaml /ui/manifest.yaml

# Optionally override icons
COPY icons/ /icons/
