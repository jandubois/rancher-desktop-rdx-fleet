#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

curl --silent --output "$BACKGROUND_DIR/k3s-helm-controller.md" \
  https://raw.githubusercontent.com/k3s-io/docs/refs/heads/main/docs/add-ons/helm.md
