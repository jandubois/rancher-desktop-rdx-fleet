#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

gitingest -o "$BACKGROUND_DIR/docker-extensions-sdk-repo.txt" \
  -e NOTICE -e LICENSE -e ".*" -e "go.*" \
  https://github.com/docker/extensions-sdk
