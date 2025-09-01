#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

gitingest -o "$BACKGROUND_DIR/appco-repo.txt" \
  -e "CONTRIBUTING*" -e LICENSE -e ".*" -e "go.*" -e markdownlint.yml \
  https://github.com/rancherlabs/application-collection-extension
