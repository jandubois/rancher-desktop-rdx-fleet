#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

gitingest -o "$BACKGROUND_DIR/fleet-docs-repo.txt" -i "*.md" -e "versioned_docs/*" \
  https://github.com/rancher/fleet-docs
