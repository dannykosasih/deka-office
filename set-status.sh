#!/usr/bin/env bash
# Usage: ./set-status.sh <bot-id> <idle|working|waiting> "<generic task label>"
# Keep task labels generic: no client names.
set -euo pipefail
cd "$(dirname "$0")"
python3 - "$1" "$2" "$3" <<'PY'
import json, sys, datetime, os, tempfile
bot, state, task = sys.argv[1:4]
assert state in ("idle", "working", "waiting"), "state must be idle, working, or waiting"
with open("status.json") as f: data = json.load(f)
if bot not in data["bots"]: sys.exit(f"unknown bot id: {bot}")
data["bots"][bot] = {"state": state, "task": task}
data["updated"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
fd, tmp = tempfile.mkstemp(dir=".")
with os.fdopen(fd, "w") as f: json.dump(data, f, indent=2)
os.replace(tmp, "status.json")
print(f"{bot}: {state} - {task}")
PY
