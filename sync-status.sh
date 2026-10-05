#!/usr/bin/env bash
# Pushes status.json to GitHub Pages whenever it changes. Checks every minute.
cd "$(dirname "$0")"
while true; do
  if ! git diff --quiet -- status.json; then
    git add status.json && git commit -qm "Update bot status" && git push -q origin main >> sync.log 2>&1 \
      && echo "$(date '+%F %T') pushed" >> sync.log
  fi
  sleep 60
done
