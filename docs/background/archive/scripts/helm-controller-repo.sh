#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

gitingest -o "$BACKGROUND_DIR/helm-controller-repo.txt" \
  -e "CONTRIBUTING*" -e LICENSE -e ".*" -e "go.*" -e "updatecli/*" \
  https://github.com/k3s-io/helm-controller
