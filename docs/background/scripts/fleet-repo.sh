#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

gitingest -o "$BACKGROUND_DIR/fleet-repo.txt" \
  -e "CONTRIBUTING*" -e LICENSE -e ".*" -e "go.*" -e "updatecli/*" \
  -e "benchmarks/*" -e "e2e/*" -e "integrationtests/*" \
  https://github.com/rancher/fleet
