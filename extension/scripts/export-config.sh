#!/bin/sh
# Export extension configuration as JSON with base64-encoded files
# Usage: docker run --rm <image> export-config
#
# Output format:
# {
#   "version": "1.0",
#   "files": {
#     "manifest.yaml": "<base64>",
#     "metadata.json": "<base64>",
#     "icons/...": "<base64>"
#   }
# }

set -e

# Start JSON output
printf '{"version":"1.0","files":{'

first=true

# Export manifest.yaml if it exists
if [ -f /ui/manifest.yaml ]; then
    content=$(base64 -w 0 /ui/manifest.yaml 2>/dev/null || base64 /ui/manifest.yaml | tr -d '\n')
    printf '"manifest.yaml":"%s"' "$content"
    first=false
fi

# Export metadata.json if it exists
if [ -f /metadata.json ]; then
    if [ "$first" = false ]; then printf ','; fi
    content=$(base64 -w 0 /metadata.json 2>/dev/null || base64 /metadata.json | tr -d '\n')
    printf '"metadata.json":"%s"' "$content"
    first=false
fi

# Export icons
if [ -d /icons ]; then
    for icon in /icons/*; do
        if [ -f "$icon" ]; then
            if [ "$first" = false ]; then printf ','; fi
            filename=$(basename "$icon")
            content=$(base64 -w 0 "$icon" 2>/dev/null || base64 "$icon" | tr -d '\n')
            printf '"icons/%s":"%s"' "$filename" "$content"
            first=false
        fi
    done
fi

# Close JSON
printf '}}\n'
