#!/usr/bin/env bash
# Opens MapApp from the Kho folder. Place this file at the root of the Kho, next to app/ and data/.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export APPIMAGE_ORIG_DIR="$DIR/app/linux"
# Keep GTK and Mesa from writing under ~/.cache or ~/.config, so the Kho stays portable.
export GSETTINGS_BACKEND=memory
export MESA_SHADER_CACHE_DIR="$DIR/app/electron-data/mesa-cache"
exec "$APPIMAGE_ORIG_DIR/MapApp.AppImage" "$@"
