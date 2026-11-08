# DeKa Office

A 3D virtual office for your AI agents. Every agent has a desk and a little bot. The bots walk through doors, grab coffee, play arcade games, and gather in the meeting room when the team works together.

![The DeKa Office](https://dekabot.app/img/office.jpg)

**[Live demo](https://dekabot.app/office/)** · [Bahasa Indonesia](README.id.md)

It is a plain static web page (HTML + JavaScript + [Three.js](https://threejs.org)). There is no build step and no database. Which bot is doing what comes from one small file, `status.json`.

## Two views

| File | What it is |
|---|---|
| `game.html` | **Game view.** A startup-style floor plan with 8 rooms (meeting, teleconference, game room, server lab, pantry, rest room, focus library, chill lounge), an open workspace and a reception. Bots find their own way with pathfinding, take breaks, give each other orders, and meet in the meeting room. Interface in Indonesian or English. |
| `index.html` | **Classic view.** One open-plan office with a desk per bot, a first-person walk mode, and a colorful theme. |

## Quick start

You need: Git, Python 3.8 or newer, and a modern browser. Three.js is loaded from a CDN, so you also need an internet connection.

```bash
git clone https://github.com/dannykosasih/deka-office.git
cd deka-office
python realtime-server.py
```

Then open:

- http://127.0.0.1:8080/game.html for the game view
- http://127.0.0.1:8080/ for the classic view

`realtime-server.py` serves the folder and pushes `status.json` to the page the moment it changes. It only listens on your own computer.

Prefer something simpler? `python -m http.server 8080` also works; the page then re-reads `status.json` every 5 seconds instead of getting live pushes. Do not open the files by double-clicking them (`file://`): browsers block the scripts and the data file that way.

## How it works

```
your agents ──► status.json ──► realtime-server.py ──► the page (bots move)
                    ▲
              roster.json = who the bots are
```

- `roster.json` describes the bots: who they are, which zone they belong to, and which artwork they use.
- `status.json` says what each bot is doing right now: `working`, `waiting` (needs a human decision) or `idle`, plus a short task label.
- The page draws one bot per entry in `roster.json` and animates it from `status.json`.

## Make it yours

### 1. Describe your bots in `roster.json`

Each entry in `bots` looks like this:

```json
{ "id": "research", "name": "Research", "zone": "Research & Data",
  "role": "Finds and sources information on the web.",
  "agent": "my-research", "voxel": "research", "workplace": "whiteboard" }
```

| Field | Meaning |
|---|---|
| `id` | Short unique id. The same id is used in `status.json`. |
| `name`, `role` | Shown on the name tag and in the side panel. |
| `zone` | Group name. Must match a zone in the `zones` list (name, color, position), which gives the bot its color. |
| `agent` | Optional. The name of the agent this bot represents (used for the "open chat" button). Use `null` if there is none. |
| `voxel` / `portrait` | Optional artwork (see below). Without art, the bot gets a built-in robot in its zone color. |
| `workplace` | Optional. Where the bot walks when it is working alone (game view), for example `whiteboard` or `server-racks`. |

In the game view, desks are placed in the order the bots appear in the file.

### 2. Use your own artwork

Put transparent PNG sprites in `portraits/voxels/` (roughly 2:3, full-body, facing the viewer) and set the `voxel` field to the file name without `.png`. The sprites included here are the author's own characters. Replace them with yours before you publish anything.

### 3. Change a bot's status

From a terminal (needs `bash` and `python3`; on Windows use Git Bash or WSL):

```bash
./set-status.sh research working "Looking up sources"
./set-status.sh research waiting "Needs a decision"
./set-status.sh research idle "Ready"
```

Or edit `status.json` by hand. The format is:

```json
{ "updated": "2026-01-01T09:00:00+07:00",
  "bots": { "research": { "state": "working", "task": "Looking up sources" } } }
```

To send a bot somewhere, add a place as a fourth argument or a `"goto"` field in `status.json`:

```bash
./set-status.sh research working "Team sync" meeting     # walk to the meeting room
./set-status.sh research idle "Back" desk                 # walk back to the desk
```

Places include `meeting`, `tele`, `arcade`, `coffee`, `snack`, `nap`, `focus`, `cinema`, `boba`, `server`, `whiteboard`, `reception`, and `desk:<other bot id>` to visit another bot.

### 4. Change the rooms

The floor plan, walls and furniture are code in `game/world.js` (one function per room). If you use an AI coding assistant, describe the change, for example "make the meeting room bigger and add a plant", and let it edit the file.

## Show real agent activity with Claude Code

Claude Code can run a command whenever a sub-agent starts or stops. A tiny hook turns that into bot status.

`.claude/hooks/office_status.py`:

```python
import datetime, json, pathlib, sys

PREFIX = "deka-"                                   # agents are named deka-<bot id>, e.g. deka-research
state = sys.argv[1]                                # "working" or "idle"
agent = json.load(sys.stdin).get("agent_type", "")
if not agent.startswith(PREFIX):
    sys.exit(0)
bot = agent[len(PREFIX):]
path = pathlib.Path(__file__).resolve().parents[2] / "status.json"   # the status.json next to index.html
data = json.loads(path.read_text(encoding="utf-8"))
if bot in data["bots"]:
    data["bots"][bot] = {"state": state, "task": "Working on a request" if state == "working" else "Ready"}
    data["updated"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
```

`.claude/settings.json`:

```json
{
  "hooks": {
    "SubagentStart": [{ "matcher": "deka-.*", "hooks": [{ "type": "command", "command": "python \"$CLAUDE_PROJECT_DIR/.claude/hooks/office_status.py\" working" }] }],
    "SubagentStop":  [{ "matcher": "deka-.*", "hooks": [{ "type": "command", "command": "python \"$CLAUDE_PROJECT_DIR/.claude/hooks/office_status.py\" idle" }] }]
  }
}
```

Run Claude Code from the folder that contains `.claude/`, keep `python realtime-server.py` running, and the bots start working the moment their agent does. The label is always generic on purpose; never copy the real request text into a public page.

## Controls (game view)

| Action | How |
|---|---|
| Look around | Drag to rotate, scroll to zoom. Room buttons at the top fly the camera there. |
| Open a bot | Click it. The panel can send it to a place, make it visit another bot, or give it a (visual) order. |
| Play as a character | `P` (controls the bot with id `danny`; rename it in `game/main.js` if yours is called something else). Walk with `WASD`, run with `Shift`, talk to the nearest bot with `E`. |
| Demo of a team job | `D` |
| Idle bots take breaks on or off | `L` |
| Night mode | `N` |
| Language | the **ID / EN** buttons |

Classic view: `F` first-person walk mode, `T` theme, `N` night.

## Publish it (GitHub Pages)

The workflow in `.github/workflows/pages.yml` deploys the whole folder. In your repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**, then push to `main`.

GitHub Pages is static, so there are no live pushes there. The page re-reads `status.json` every 5 seconds from what you committed. `sync-status.sh` is an optional helper that commits and pushes `status.json` about once a minute when it changes; it makes many small commits, so use it only if that suits you.

The page is public. Keep task labels generic: no client names, no personal data.

## Before you publish your fork

This repository still contains a few things that belong to the original author:

- `404.html`, and the three-line redirect script at the top of `index.html` and `game.html`, send visitors of one specific domain elsewhere. Delete them.
- The "open real chat" button and the chat bridge in `game/main.js` point to the author's chat app (`dekabot.app`). Remove or change them.
- `roster.json`, `status.json` and the sprites describe the author's own bots.

## What is in the folder

```
game.html, game/         game view (world.js rooms, bots.js, life.js behavior, nav.js pathfinding, i18n.js)
index.html               classic view
roster.json              the bots, zones and places
status.json              what the bots are doing right now
realtime-server.py       local server that pushes status.json to the page
set-status.sh            helper to change one bot's status
sync-status.sh           optional: push status.json to GitHub about every minute
lang.js                  the ID / EN language switch
portraits/, voxels/      artwork
.github/workflows/       GitHub Pages deployment
```

## Credits and license

Built with [Three.js](https://threejs.org) (MIT) and Claude Code. This repository does not have a license file yet, so please ask the author before reusing the artwork or the code in a product.
