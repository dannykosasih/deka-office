// Behaviour: where a bot can go, what idle bots do for fun, and bots giving each other orders.
import { slots, places } from "./world.js";
import { bots, walkTo, say, setTag, atHome } from "./bots.js";

let roster = null, log = () => {};
export const lifeState = { ambient: true };
export function initLife(r, logFn) { roster = r; log = logFn; setInterval(tick, 1500); }

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const taken = new Map(); // slot -> bot id, so two bots do not stand on the same spot
function claim(kind, id) {
  const list = slots[kind]; if (!list || !list.length) return null;
  const free = list.filter(s => !taken.has(s) || taken.get(s) === id);
  const s = pick(free.length ? free : list); taken.set(s, id); return s;
}
function release(id) { for (const [s, who] of taken) if (who === id) taken.delete(s); }

// Spots a command or the panel can name
export const PLACE_LIST = [
  ["meeting", "Meeting room (team)"], ["tele", "Teleconference room"], ["arcade", "Game room: arcade"], ["table", "Game room: foosball"], ["couch", "Game room: console sofa"],
  ["coffee", "Pantry: coffee machine"], ["snack", "Pantry: snack bar"], ["vending", "Pantry: vending machine"], ["nap", "Rest room: nap pod"], ["sit", "Rest room: sofa"],
  ["focus", "Focus library"], ["cinema", "Chill lounge: movie sofa"], ["boba", "Chill lounge: boba bar"], ["server", "Server lab (desk)"], ["server-racks", "Server lab (racks)"],
  ["whiteboard", "Whiteboard (meeting room)"], ["reception", "Reception"], ["corridor", "Corridor"]
];
const ALIAS = { lounge: "cinema", sofa: "cinema", "game-station": "couch", "game-room": "arcade", pantry: "coffee", "coffee-machine": "coffee", "snack-bar": "snack", library: "focus",
  "server-lab": "server", conference: "tele", "rest-room": "nap", "meeting-room": "meeting", teleconference: "tele" };

export function resolve(spec, b) {
  if (!spec || spec === "desk") return { ...b.home, face: "n" };
  if (typeof spec === "object") return spec;
  if (spec.startsWith("desk:")) { const o = bots[spec.slice(5)]; return o ? { x: o.home.x + 2.5, z: o.home.z - 0.4 } : null; }
  spec = ALIAS[spec] || spec;
  if (spec === "meeting" || spec === "tele") { // one fixed seat per bot, by its place in the roster
    const list = slots[spec], i = Math.max(roster.bots.findIndex(x => x.id === b.id), 0); return list ? list[i % list.length] : null;
  }
  if (places[spec]) return places[spec];
  return claim(spec, b.id);
}

// ---------- commands from the panel, status.json or the demo ----------
export function sendBot(id, spec, opts = {}) {
  const b = bots[id]; if (!b) return false;
  const target = resolve(spec, b); if (!target) return false;
  cancel(b);
  const home = !spec || spec === "desk";
  b.mode = home ? "desk" : (opts.mode || "goto");
  if (!walkTo(b, target, home ? null : opts.onArrive)) { b.mode = "desk"; return false; }
  setTag(b); return true;
}
function cancel(b) { clearTimeout(b.timer); b.timer = null; b.activity = null; release(b.id); }

// ---------- ambient life: idle bots take breaks ----------
const ACTIVITIES = [
  { kind: "coffee", emoji: "☕", text: "coffee break", d: [8, 14], w: 3 }, { kind: "snack", emoji: "🍪", text: "snack time", d: [8, 13], w: 2 },
  { kind: "vending", emoji: "🥤", text: "grabbing a drink", d: [6, 9], w: 1 }, { kind: "arcade", emoji: "🎮", text: "playing arcade", d: [12, 22], w: 3 },
  { kind: "table", emoji: "🏓", text: "foosball!", d: [12, 20], w: 2 }, { kind: "couch", emoji: "🕹️", text: "console time", d: [12, 20], w: 2 },
  { kind: "nap", emoji: "😴", text: "power nap", d: [14, 24], w: 2 }, { kind: "sit", emoji: "🛋️", text: "chilling", d: [10, 16], w: 1 },
  { kind: "focus", emoji: "📚", text: "deep focus", d: [12, 20], w: 1 }, { kind: "cinema", emoji: "🍿", text: "watching a movie", d: [14, 22], w: 1 },
  { kind: "boba", emoji: "🧋", text: "boba break", d: [8, 13], w: 2 }, { kind: "chat", emoji: "💬", text: "chatting", d: [8, 13], w: 2 }
];
function startActivity(b) {
  const total = ACTIVITIES.reduce((s, a) => s + a.w, 0); let r = Math.random() * total, a = ACTIVITIES[0];
  for (const x of ACTIVITIES) { if ((r -= x.w) <= 0) { a = x; break; } }
  let target = null, text = a.text;
  if (a.kind === "chat") {
    const others = Object.values(bots).filter(o => o !== b && o.mode === "desk" && atHome(o)); if (!others.length) return;
    const o = pick(others); target = resolve("desk:" + o.id, b); text = "chatting with " + o.name; a = { ...a, other: o };
  } else target = claim(a.kind, b.id);
  if (!target) return;
  cancel(b); taken.delete(target); if (a.kind !== "chat") taken.set(target, b.id);
  b.mode = "activity"; b.activity = { text }; setTag(b);
  const dur = rnd(...a.d) * 1000;
  const ok = walkTo(b, target, () => {
    say(b, a.emoji + " " + text, dur); if (a.other) say(a.other, "💬 hey " + b.name.split(" ")[0] + "!", 2500);
    b.timer = setTimeout(() => backToDesk(b), dur);
  });
  if (!ok) { b.mode = "desk"; b.activity = null; release(b.id); }
}
export function backToDesk(b) {
  cancel(b); b.mode = "desk"; walkTo(b, { ...b.home, face: "n" }); setTag(b);
}
function tick() {
  if (!lifeState.ambient) return;
  for (const b of Object.values(bots)) {
    if (b.mode !== "desk" || !atHome(b) || b.override || b.state !== "idle" || b.remoteGoto) continue;
    if (b.nextBreak === undefined) b.nextBreak = performance.now() + rnd(8, 40) * 1000;
    if (performance.now() >= b.nextBreak) { b.nextBreak = performance.now() + rnd(30, 70) * 1000; startActivity(b); }
  }
}

// ---------- bots giving each other orders ----------
export function giveOrder(fromId, toId, text, onDone) {
  const from = bots[fromId], to = bots[toId]; if (!from || !to || from === to) return false;
  cancel(from); from.mode = "order";
  log(`📋 ${from.name} → ${to.name}: ${text}`);
  const ok = walkTo(from, resolve("desk:" + toId, from), () => {
    say(from, "📋 " + text, 3500);
    setTimeout(() => {
      say(to, "👍 on it!", 2200);
      cancel(to); to.mode = "order"; to.override = { state: "working", task: text };
      to.state = "working"; to.task = text; to.target.setHex(0x4ade80); setTag(to);
      const wp = (roster.bots.find(x => x.id === toId) || {}).workplace;
      const doWork = () => { // work at its desk (or at its workplace if it has one) for a while
        to.timer = setTimeout(() => {
          to.override = null; say(to, "✅ done!", 2500); log(`✅ ${to.name} finished: ${text}`);
          if (to.remote) { to.state = to.remote.state; to.task = to.remote.task; to.target.setHex(({ working: 0x4ade80, waiting: 0xfbbf24, idle: 0x64748b })[to.state]); }
          else { to.state = "idle"; to.task = ""; to.target.setHex(0x64748b); }
          backToDesk(to); if (onDone) onDone(to);
        }, rnd(9, 15) * 1000);
      };
      if (wp && resolve(wp, to)) sendBot(toId, wp, { mode: "order", onArrive: doWork }); else doWork();
      to.mode = "order";
    }, 1400);
    setTimeout(() => { say(from, "🙌", 1500); backToDesk(from); }, 2600);
  });
  if (!ok) { backToDesk(from); return false; }
  setTag(from); return true;
}

// ---------- demo: Chief of Staff delegates, then the team meets ----------
export function runDemo() {
  const lead = "cos", crew = [["research", "Find sources for the brief"], ["data", "Clean the dataset"], ["slide", "Draft the deck"], ["story", "Write the narrative"]];
  log("🎬 Demo: Chief of Staff starts a team job");
  let done = 0;
  crew.forEach(([id, text], i) => setTimeout(() => giveOrder(lead, id, text, () => {
    if (++done === crew.length) {
      log("🤝 Everyone meets to sync");
      [lead, ...crew.map(c => c[0])].forEach(x => { sendBot(x, "meeting", { onArrive: bb => say(bb, "🤝", 3000) }); });
      setTimeout(() => [lead, ...crew.map(c => c[0])].forEach(x => backToDesk(bots[x])), 16000);
    }
  }), i * 4500));
}

// A real delegation from the DeKa Bots chat: the sender walks to the receiver's desk, hands over the task and goes back.
export function handOff(fromId, toId) {
  const from = bots[fromId], to = bots[toId]; if (!from || !to || from === to) return false;
  cancel(from); from.mode = "order";
  const ok = walkTo(from, resolve("desk:" + toId, from), () => {
    say(from, "📋 new task", 2600);
    setTimeout(() => say(to, "👍 on it!", 2200), 900);
    setTimeout(() => backToDesk(from), 2400);
  });
  if (!ok) backToDesk(from);
  return ok;
}
