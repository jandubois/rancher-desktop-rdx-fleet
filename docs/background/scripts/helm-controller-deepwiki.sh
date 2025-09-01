#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

deepwiki-to-md wiki https://deepwiki.com/k3s-io/helm-controller -o "$BACKGROUND_DIR"
