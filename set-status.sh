#!/usr/bin/env bash
# Usage: ./set-status.sh <bot-id> <idle|working|waiting> "<generic task label>" [place]
# place (optional): a place id from roster.json (e.g. water-cooler), desk:<bot-id>, or desk to send the bot back.
# Without a place, the bot keeps whatever walk it was last given.
# Keep task labels generic: no client names.
set -euo pipefail
cd "$(dirname "$0")"
python3 - "$1" "$2" "$3" "${4:-}" <<'PY'
import json, sys, datetime, os, tempfile
bot, state, task = sys.argv[1:4]
place = sys.argv[4] if len(sys.argv) > 4 else ""
assert state in ("idle", "working", "waiting"), "state must be idle, working, or waiting"
with open("status.json") as f: data = json.load(f)
if bot not in data["bots"]: sys.exit(f"unknown bot id: {bot}")
entry = {"state": state, "task": task}
keep = data["bots"][bot].get("goto")
if place and place != "desk": entry["goto"] = place
elif not place and keep: entry["goto"] = keep
data["bots"][bot] = entry
data["updated"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
fd, tmp = tempfile.mkstemp(dir=".")
with os.fdopen(fd, "w") as f: json.dump(data, f, indent=2)
os.replace(tmp, "status.json")
print(f"{bot}: {state} - {task}")
PY
