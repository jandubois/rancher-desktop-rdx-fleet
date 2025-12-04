#!/bin/sh
# Extension entrypoint script
# Handles special commands like export-config, or passes through to exec other commands

case "$1" in
    export-config)
        exec /scripts/export-config.sh
        ;;
    "")
        # No arguments - show help
        echo "Fleet GitOps Extension"
        echo ""
        echo "Available commands:"
        echo "  export-config    Export extension configuration as JSON"
        echo ""
        echo "Example:"
        echo "  docker run --rm <image> export-config > config.json"
        exit 0
        ;;
    *)
        # Pass through to exec the command (e.g., for backend service)
        exec "$@"
        ;;
esac
