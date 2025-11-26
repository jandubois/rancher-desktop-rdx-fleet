#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

# Delete everything in the "Spark Runtime API" section, and the final "Process & Output" section
curl --silent https://raw.githubusercontent.com/simonw/system-exploration-g/refs/heads/main/src/system_prompt.md \
  | sed '/^## Spark/,/^## Theme/{/^## Theme/!d;}' \
  | sed '/^## Process/,$d' \
  > "$BACKGROUND_DIR/spark-app-guide.md"
