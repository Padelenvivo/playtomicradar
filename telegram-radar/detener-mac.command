#!/bin/zsh
set -e

cd "$(dirname "$0")"
PLIST="$HOME/Library/LaunchAgents/com.freedom.pistas-radar.plist"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
if [ -f .env ]; then
  sed -i '' 's/^DRY_RUN=.*/DRY_RUN=true/' .env
fi

echo "Radar detenido."
read "?Pulsa Enter para cerrar..."
