#!/bin/sh
# Extension entrypoint script
# Handles special commands like export-config

case "$1" in
    export-config)
        exec /scripts/export-config.sh
        ;;
    *)
        # Default behavior - just exit (extension images don't normally run)
        echo "Fleet GitOps Extension"
        echo ""
        echo "Available commands:"
        echo "  export-config    Export extension configuration as JSON"
        echo ""
        echo "Example:"
        echo "  docker run --rm <image> export-config > config.json"
        exit 0
        ;;
esac
