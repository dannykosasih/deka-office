import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { scene, buildWorld, lights, labels, tickWorld, tickScreens, ROOMS } from "./world.js";
import { buildGrid, isBlocked } from "./nav.js";
import { bots, clickable, createBot, buildDesk, deskSpot, setTag, say, update as updateBots, STATE_COLOR } from "./bots.js";
import { initLife, lifeState, PLACE_LIST, sendBot, backToDesk, giveOrder, runDemo, handOff } from "./life.js";

const $ = id => document.getElementById(id);
let roster;
try { roster = await (await fetch("roster.json?t=" + Date.now())).json(); }
catch (e) { $("updated").textContent = "Couldn't read roster.json"; throw e; }

// ---------- renderer, camera, light ----------
scene.background = new THREE.Color(0x0d1220); scene.fog = new THREE.Fog(0x0d1220, 90, 190);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
camera.position.set(30, 36, 46);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const css = new CSS2DRenderer(); css.setSize(innerWidth, innerHeight);
Object.assign(css.domElement.style, { position: "absolute", top: "0", pointerEvents: "none" }); document.body.appendChild(css.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 2); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.15; controls.minDistance = 8; controls.maxDistance = 110;

const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x4a5578, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.7); sun.position.set(20, 50, 24); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003;
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 35, bottom: -35, near: 1, far: 120 }); scene.add(sun);
const fill = new THREE.DirectionalLight(0xb8d0ff, 0.4); fill.position.set(-30, 30, -20); scene.add(fill);

// ---------- build the world, desks and bots ----------
buildWorld();
const zoneColor = Object.fromEntries(roster.zones.map(z => [z.name, Number(z.color)]));
roster.bots.forEach((info, i) => {
  const spot = deskSpot(i), color = zoneColor[info.zone] ?? 0x7eb6ff;
  const glow = buildDesk(spot.x, spot.z, color);
  createBot(info, color, spot, info.voxel, glow);
});
buildGrid();

// ---------- feed ----------
const feedEl = $("feed");
function log(msg) {
  const d = document.createElement("div"); d.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "  " + msg;
  feedEl.appendChild(d); while (feedEl.children.length > 7) feedEl.removeChild(feedEl.firstChild); feedEl.style.display = "block";
}
initLife(roster, log);

// ---------- status.json: live over SSE locally, polling on GitHub Pages ----------
let liveOn = false, lastText = "";
function applyStatus(data) {
  for (const [id, s] of Object.entries(data.bots || {})) {
    const b = bots[id]; if (!b) continue;
    const state = STATE_COLOR[s.state] ? s.state : "idle";
    b.remote = { state, task: s.task || "" };
    if (!b.override) { b.state = state; b.task = s.task || ""; b.target.setHex(STATE_COLOR[state]); }
    if (s.goto !== b.lastGoto) {
      b.lastGoto = s.goto;
      if (s.goto) { b.remoteGoto = true; sendBot(id, s.goto, { mode: "goto" }); }
      else { b.remoteGoto = false; if (b.mode === "goto") backToDesk(b); }
    }
    setTag(b);
  }
  lastText = "Status updated " + new Date(data.updated).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB";
  $("updated").textContent = liveOn ? lastText + " · live" : lastText;
  if (selected) showPanel(selected);
}
async function loadStatus() {
  try { applyStatus(await (await fetch("status.json?t=" + Date.now())).json()); }
  catch (e) { $("updated").textContent = location.hostname.endsWith("dekabot.app") ? "Live from the DeKa Bots chat" : "Couldn't read status.json"; }
}
function connectLive() {
  if (!window.EventSource) return;
  const es = new EventSource("events");
  es.onopen = () => { liveOn = true; };
  es.addEventListener("status", e => { liveOn = true; try { applyStatus(JSON.parse(e.data)); } catch (err) { console.warn(err); } });
  es.onerror = () => { liveOn = false; $("updated").textContent = lastText; if (es.readyState === EventSource.CLOSED) es.close(); };
}
// On dekabot.app there is no status.json or /events: activity arrives from the chat instead (see the bridge below).
if (location.hostname.endsWith("dekabot.app")) $("updated").textContent = "Live from the DeKa Bots chat";
else { loadStatus(); connectLive(); setInterval(() => { if (!liveOn) loadStatus(); }, 5000); }

// ---------- DeKa Bots chat app (dekabot.app) ----------
// The chat page posts {bot, state, from?} on the "deka-office" channel whenever a bot starts, waits for approval or finishes.
// This only works when both pages are on the same site (the office is served from dekabot.app/office/).
const CHAT_URL = location.hostname.endsWith("dekabot.app") ? "/app" : "https://dekabot.app/app";
const appState = {};
function applyAppEvent(e) {
  const b = bots[e.bot]; if (!b || !["working", "waiting", "idle"].includes(e.state)) return;
  appState[e.bot] = e.state;
  if (e.state === "idle") { b.override = null; b.state = b.remote ? b.remote.state : "idle"; b.task = b.remote ? b.remote.task : ""; }
  else { b.override = { state: e.state }; b.state = e.state; b.task = e.state === "working" ? "Working in the DeKa Bots chat" : "Waiting for your approval"; }
  b.target.setHex(STATE_COLOR[b.state]); setTag(b);
  if (e.from && e.state === "working") handOff(e.from, e.bot);
  // one bot working walks to its workplace; two or more (a team job) meet in the meeting room; idle goes back to the desk
  const gather = () => {
    const working = Object.keys(appState).filter(id => appState[id] === "working");
    if (working.length >= 2) working.forEach(id => sendBot(id, "meeting", { mode: "app" }));
    else if (working.length === 1) { const wp = (roster.bots.find(x => x.id === working[0]) || {}).workplace; if (wp) sendBot(working[0], wp, { mode: "app" }); }
  };
  if (e.state === "working") setTimeout(gather, e.from ? 3300 : 0); // let the hand-off animation finish first
  else if (e.state === "idle" && b.mode === "app") backToDesk(b);
}
// Other devices: the chat server keeps the latest state of each bot; poll it (adaptive, and only while this tab is visible).
let relayOff = false, relayTimer = null;
async function pollRelay() {
  if (relayOff) return;
  let next = 12000;
  try {
    if (!document.hidden) {
      const res = await fetch("/api/office/state", { credentials: "same-origin", cache: "no-store" });
      if (res.status === 401) { $("updated").textContent = "Sign in at dekabot.app to see live chat activity"; relayOff = true; return; }
      const d = await res.json();
      if (!d.enabled) { relayOff = true; return; }
      let active = false;
      for (const [id, r] of Object.entries(d.bots || {})) {
        const age = d.now - r.ts; let st = r.state;
        if (st === "working" && age > 330) st = "idle";   // a chat request cannot run longer than 5 minutes
        if (st === "waiting" && age > 1800) st = "idle";  // an approval left alone for 30 minutes
        if (st !== "idle") active = true;
        if ((appState[id] || "idle") !== st) applyAppEvent({ bot: id, state: st, from: age < 10 ? r.from : undefined });
      }
      $("updated").textContent = "Live from the DeKa Bots chat · all devices"; next = active ? 3000 : 12000;
    }
  } catch (e) { next = 15000; }
  relayTimer = setTimeout(pollRelay, next);
}
if (location.hostname.endsWith("dekabot.app") || location.search.includes("relay=1")) { pollRelay(); document.addEventListener("visibilitychange", () => { if (!document.hidden && !relayOff) { clearTimeout(relayTimer); pollRelay(); } }); }
try { new BroadcastChannel("deka-office").onmessage = ev => { try { applyAppEvent(ev.data || {}); } catch (err) { console.warn(err); } }; } catch (e) { /* no BroadcastChannel */ }

// ---------- panel ----------
let selected = null;
function fillSelects() {
  const place = $("p-place"), to = $("p-to"); place.textContent = ""; to.textContent = "";
  const add = (sel, v, t, parent) => { const o = document.createElement("option"); o.value = v; o.textContent = t; (parent || sel).appendChild(o); };
  const g1 = document.createElement("optgroup"); g1.label = "Rooms and spots"; PLACE_LIST.forEach(([v, t]) => add(place, v, t, g1)); place.appendChild(g1);
  const g2 = document.createElement("optgroup"); g2.label = "Visit a desk"; roster.bots.forEach(x => { if (x.id !== selected) add(place, "desk:" + x.id, x.name, g2); }); place.appendChild(g2);
  roster.bots.forEach(x => { if (x.id !== selected) add(to, x.id, x.name); });
}
function showPanel(id) {
  const b = bots[id]; if (!b) return; const changed = selected !== id; selected = id;
  $("p-zone").textContent = b.zone; $("p-name").textContent = b.name; $("p-role").textContent = b.role;
  const word = { working: "Working on", waiting: "Waiting on Danny:", idle: "Idle." }[b.state];
  $("p-now").textContent = b.mode === "activity" && b.activity ? b.activity.text : (b.state === "idle" ? `Idle. ${b.task}` : `${word} ${b.task}`);
  const info = roster.bots.find(x => x.id === id); $("p-chat").style.display = info && info.agent ? "inline-block" : "none";
  $("panel").style.display = "block"; if (changed) fillSelects();
}
$("p-chat").onclick = () => { const b = bots[selected]; const info = roster.bots.find(x => x.id === selected); if (b && info && info.agent) window.open(CHAT_URL + "#" + info.agent, "_blank", "noopener"); };
$("p-close").onclick = () => { $("panel").style.display = "none"; selected = null; };
$("p-go").onclick = () => { if (selected && !sendBot(selected, $("p-place").value)) hint("No free spot there right now"); };
$("p-home").onclick = () => { if (selected) backToDesk(bots[selected]); };
$("p-order").onclick = () => {
  const text = $("p-text").value.trim(); if (!selected || !text) return;
  if (giveOrder(selected, $("p-to").value, text)) $("p-text").value = ""; else hint("Can't deliver that order");
};
$("p-text").addEventListener("keydown", e => { if (e.key === "Enter") $("p-order").click(); });

// click a bot (ignore drags)
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let downAt = null;
renderer.domElement.addEventListener("pointerdown", e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(clickable)[0]; if (hit) showPanel(hit.object.userData.id);
});
let hintT = null;
function hint(msg, ms = 2500) { const h = $("hint"); h.textContent = msg; h.style.display = "block"; clearTimeout(hintT); hintT = setTimeout(() => { h.style.display = "none"; }, ms); }

// ---------- camera: room chips ----------
let goal = null;
const chips = $("rooms");
ROOMS.filter(r => r.name).concat([{ name: "Overview", id: "all" }]).forEach(r => {
  const b = document.createElement("button"); b.textContent = r.name; b.style.borderColor = r.color ? "#" + r.color.toString(16).padStart(6, "0") : "";
  b.onclick = () => {
    if (player.on) setPlayer(false);
    if (r.id === "all") goal = { t: new THREE.Vector3(0, 0, 2), p: new THREE.Vector3(34, 42, 52) };
    else { const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2; goal = { t: new THREE.Vector3(cx, 0, cz), p: new THREE.Vector3(cx + 11, 15, cz + 17) }; }
  };
  chips.appendChild(b);
});

// ---------- play as Danny ----------
const player = { on: false, keys: {} };
function setPlayer(on) {
  const d = bots.danny; if (!d) return;
  player.on = on; $("btn-play").classList.toggle("on", on);
  if (on) { d.path = []; d.mode = "player"; d.manualMove = true; d.state = "idle"; hint("WASD to walk, Shift to run, E to talk to a bot, drag to turn the camera, P to stop", 5000); goal = null; }
  else { d.manualMove = false; backToDesk(d); }
}
function playerStep(dt) {
  const d = bots.danny; if (!player.on || !d) return;
  const az = controls.getAzimuthalAngle();
  const f = (player.keys.KeyW || player.keys.ArrowUp ? 1 : 0) - (player.keys.KeyS || player.keys.ArrowDown ? 1 : 0);
  const r = (player.keys.KeyD || player.keys.ArrowRight ? 1 : 0) - (player.keys.KeyA || player.keys.ArrowLeft ? 1 : 0);
  d.manualMove = !!(f || r);
  if (f || r) {
    const sp = (player.keys.ShiftLeft ? 7 : 4) * dt, fx = -Math.sin(az), fz = -Math.cos(az), rx = Math.cos(az), rz = -Math.sin(az);
    let dx = (fx * f + rx * r), dz = (fz * f + rz * r); const len = Math.hypot(dx, dz) || 1; dx = dx / len * sp; dz = dz / len * sp;
    if (!isBlocked(d.pos.x + dx, d.pos.z)) d.pos.x += dx;
    if (!isBlocked(d.pos.x, d.pos.z + dz)) d.pos.z += dz;
    d.heading = Math.atan2(dx, dz); if (Math.abs(dx) > 0.01) d.face = dx > 0 ? 1 : -1;
    d.root.position.set(d.pos.x, 0, d.pos.z);
  }
  const t = controls.target, k = 1 - Math.exp(-dt * 6), ox = camera.position.x - t.x, oz = camera.position.z - t.z, oy = camera.position.y - t.y;
  t.x += (d.pos.x - t.x) * k; t.z += (d.pos.z - t.z) * k; t.y = 1;
  camera.position.set(t.x + ox, t.y + oy - 0, t.z + oz);
  // nearest bot to talk to
  let near = null, nd = 3.4; for (const o of Object.values(bots)) if (o !== d) { const dist = Math.hypot(o.pos.x - d.pos.x, o.pos.z - d.pos.z); if (dist < nd) { nd = dist; near = o; } }
  player.near = near; if (near) hint(`E: talk to ${near.name}`, 400);
}

// ---------- buttons and keys ----------
$("btn-play").onclick = () => setPlayer(!player.on);
$("btn-life").onclick = () => { lifeState.ambient = !lifeState.ambient; $("btn-life").classList.toggle("on", lifeState.ambient); hint(lifeState.ambient ? "Idle bots take breaks again" : "Idle bots stay at their desks"); };
$("btn-demo").onclick = runDemo;
let night = false;
function setNight(on) {
  night = on; $("btn-night").classList.toggle("on", on); const bg = on ? 0x05070f : 0x0d1220; scene.background.setHex(bg); scene.fog.color.setHex(bg);
  hemi.intensity = on ? 0.28 : 1.6; sun.intensity = on ? 0.15 : 1.7; fill.intensity = on ? 0.08 : 0.4; sun.color.setHex(on ? 0x8aa4ff : 0xfff5e6);
  lights.forEach(([l, day, nite]) => { l.intensity = on ? nite : day; });
}
$("btn-night").onclick = () => setNight(!night);
$("btn-life").classList.add("on");
addEventListener("keydown", e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  player.keys[e.code] = true;
  if (e.code === "KeyP") setPlayer(!player.on); else if (e.code === "KeyN") setNight(!night);
  else if (e.code === "KeyL") $("btn-life").click(); else if (e.code === "KeyD") runDemo();
  else if (e.code === "KeyE" && player.on && player.near) showPanel(player.near.id);
});
addEventListener("keyup", e => { player.keys[e.code] = false; });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); css.setSize(innerWidth, innerHeight); });

// ---------- loop ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  updateBots(dt, t); tickWorld(t); tickScreens(t); playerStep(dt);
  if (goal && !player.on) {
    const k = 1 - Math.exp(-dt * 3.5); controls.target.lerp(goal.t, k); camera.position.lerp(goal.p, k);
    if (camera.position.distanceTo(goal.p) < 0.3) goal = null;
  }
  document.body.classList.toggle("far", camera.position.distanceTo(controls.target) > 42); // fewer words on tags when zoomed out
  controls.update(); renderer.render(scene, camera); css.render(scene, camera);
});
window.__game = { bots, sendBot, giveOrder, runDemo, camera, controls, renderer, scene };
