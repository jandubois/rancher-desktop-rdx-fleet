#!/bin/bash
# Build both React and Vue versions of the extension UI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(dirname "$SCRIPT_DIR")"
UI_VUE_DIR="$UI_DIR/../ui-vue"
BUILD_DIR="$UI_DIR/build"

echo "Building Fleet Extension UI (React + Vue)..."
echo "============================================="

# Clean build directory
echo "Cleaning build directory..."
rm -rf "$BUILD_DIR"

# Build React version
echo ""
echo "Building React version..."
cd "$UI_DIR"
npm run build

# Rename React's index.html to index-react.html
mv "$BUILD_DIR/index.html" "$BUILD_DIR/index-react.html"
echo "  -> Renamed to index-react.html"

# Build Vue version
echo ""
echo "Building Vue version..."
cd "$UI_VUE_DIR"
npm run build

# Copy Vue build assets to React build directory
echo "  -> Copying Vue assets to build directory..."
cp -r "$UI_VUE_DIR/build/assets/"* "$BUILD_DIR/assets/"
cp "$UI_VUE_DIR/build/index.html" "$BUILD_DIR/index-vue.html"
echo "  -> Created index-vue.html"

# Copy loader as index.html
echo ""
echo "Creating loader index.html..."
cp "$UI_DIR/loader.html" "$BUILD_DIR/index.html"

echo ""
echo "============================================="
echo "Build complete!"
echo ""
echo "Output files in $BUILD_DIR:"
ls -la "$BUILD_DIR"/*.html 2>/dev/null || echo "  (no HTML files found)"
echo ""
echo "The extension will load React by default."
echo "Users can switch to Vue via Edit Mode > Edit tab > UI Framework section."
