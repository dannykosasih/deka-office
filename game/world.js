// The building: rooms, walls, furniture, lights. Everything is axis-aligned boxes and cylinders (low-poly game look).
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export const HW = 32, HD = 22;                 // half width / half depth of the floor
export const scene = new THREE.Scene();
export const obstacles = [];                    // footprints bots must walk around: {x, z, w, d}
export const neonMats = [];                     // glowing strips that pulse
export const lights = [];                       // [light, dayIntensity, nightIntensity]
export const slots = {};                        // activity spots by kind: name -> [{x, z, face}]
export const places = {};                       // single named spots
export const ROOMS = [];                        // {id, name, x1, z1, x2, z2, color}
export const animated = [];                     // canvas screens that redraw: {tex, draw(ctx, w, h, t)}
export const labels = [];

export const P = { pink: 0xff4fd8, cyan: 0x22e5ff, lime: 0xb6ff3b, violet: 0x8b5cf6, orange: 0xff8a3d, yellow: 0xffe14d, blue: 0x3b82f6, teal: 0x14d8b8, red: 0xff4d6d };
const PAL = Object.values(P);

export function obstacle(x, z, w, d, rotY = 0) { if (Math.abs(Math.sin(rotY)) > 0.5) [w, d] = [d, w]; obstacles.push({ x, z, w, d }); }
export function slot(name, x, z, face) { (slots[name] ??= []).push({ x, z, face }); }

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({
  color: c, roughness: o.r ?? 0.6, metalness: o.m ?? 0.05, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0,
  transparent: o.a !== undefined, opacity: o.a ?? 1, map: o.map ?? null
});
export function box(w, h, d, c, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o));
  m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast !== false && o.a === undefined; m.receiveShadow = true;
  (o.parent || scene).add(m); return m;
}
export function cyl(rt, rb, h, c, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20), mat(c, o));
  m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true; (o.parent || scene).add(m); return m;
}
export function ball(r, c, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(c, o));
  m.position.set(x, y, z); if (o.sy) m.scale.y = o.sy; m.castShadow = true; (o.parent || scene).add(m); return m;
}
export function neon(w, h, d, c, x, y, z, pulse = true) {
  const m = box(w, h, d, c, x, y, z, { e: c, ei: 1, cast: false, r: 0.3 });
  if (pulse) neonMats.push({ mat: m.material, p: Math.random() * 6 });
  return m;
}
export function glow(c, intensity, x, y, z, dist = 14) {
  const l = new THREE.PointLight(c, intensity, dist, 2); l.position.set(x, y, z); scene.add(l);
  lights.push([l, intensity, intensity * 2.2]); return l;
}
export function label(text, x, y, z, color = "#fff", size = 14) {
  const el = document.createElement("div"); el.className = "zone";
  el.style.cssText = `font-size:${size}px;color:${color};text-shadow:0 0 10px ${color}`; el.textContent = text;
  const o = new CSS2DObject(el); o.position.set(x, y, z); scene.add(o); labels.push(o); return o;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, ctx: c.getContext("2d"), w, h, draw };
}
export function screen(w, h, x, y, z, ry, ct) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ct.tex }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  box(ry % Math.PI ? 0.1 : w + 0.2, h + 0.2, ry % Math.PI ? w + 0.2 : 0.1, 0x0b0f1f, x - Math.sin(ry) * 0.07, y, z - Math.cos(ry) * 0.07, { cast: false });
  return m;
}
const titleScreen = (text, c1, c2) => canvasTex(512, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(255,255,255,0.1)"; for (let i = 0; i < h; i += 8) g.fillRect(0, i, w, 2);
  g.fillStyle = "#fff"; g.font = "bold 62px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2);
});
const checker = (c1, c2, n) => {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  g.fillStyle = c1; g.fillRect(0, 0, 64, 64); g.fillStyle = c2; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(n[0], n[1]); t.colorSpace = THREE.SRGBColorSpace; return t;
};

// ---------- walls: solid base + glass top + neon trim, with door gaps ----------
export function wall(x1, z1, x2, z2, o = {}) {
  const horiz = z1 === z2;
  const a = horiz ? Math.min(x1, x2) : Math.min(z1, z2), b = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
  const h = o.h ?? 1.0, gh = o.glass ?? 1.3, t = 0.24, col = o.color ?? 0xf4f1ff, trim = o.trim ?? P.cyan;
  const doors = (o.doors || []).slice().sort((p, q) => p[0] - q[0]);
  const segs = []; let cur = a;
  for (const [d0, d1] of doors) { if (d0 > cur) segs.push([cur, d0]); cur = d1; }
  if (cur < b) segs.push([cur, b]);
  for (const [s0, s1] of segs) {
    const len = s1 - s0, mid = (s0 + s1) / 2, cx = horiz ? mid : x1, cz = horiz ? z1 : mid, w = horiz ? len : t, d = horiz ? t : len;
    box(w, h, d, col, cx, h / 2, cz);
    if (gh > 0) box(horiz ? len : t * 0.5, gh, horiz ? t * 0.5 : len, 0x9be7ff, cx, h + gh / 2, cz, { a: 0.22, r: 0.1, m: 0.3 });
    neon(horiz ? len : 0.07, 0.07, horiz ? 0.07 : len, trim, cx, h + gh + 0.04, cz);
    obstacle(cx, cz, w, d);
  }
  for (const [d0, d1] of doors) for (const e of [d0, d1]) neon(0.1, h + gh, 0.1, trim, horiz ? e : x1, (h + gh) / 2, horiz ? z1 : e);
}
function floor(x1, z1, x2, z2, color, o = {}) {
  const w = x2 - x1, d = z2 - z1;
  const map = o.checker ? checker(o.checker[0], o.checker[1], [w / 2, d / 2]) : null;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(map ? 0xffffff : color, { r: o.r ?? 0.45, m: o.m ?? 0.0, map }));
  m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, o.y ?? 0.01, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m);
  if (o.edge) {
    neon(w, 0.03, 0.08, o.edge, (x1 + x2) / 2, 0.05, z1 + 0.15); neon(w, 0.03, 0.08, o.edge, (x1 + x2) / 2, 0.05, z2 - 0.15);
    neon(0.08, 0.03, d, o.edge, x1 + 0.15, 0.05, (z1 + z2) / 2); neon(0.08, 0.03, d, o.edge, x2 - 0.15, 0.05, (z1 + z2) / 2);
  }
}
function room(id, name, x1, z1, x2, z2, color, floorColor, o = {}) {
  ROOMS.push({ id, name, x1, z1, x2, z2, color });
  floor(x1, z1, x2, z2, floorColor, { edge: color, ...o });
  label(name.toUpperCase(), (x1 + x2) / 2, 3.1, o.labelZ ?? z1 + 1.2, "#" + color.toString(16).padStart(6, "0"), 13);
}

// ---------- furniture ----------
export function plant(x, z, s = 1) {
  obstacle(x, z, 0.7 * s, 0.7 * s);
  cyl(0.28 * s, 0.22 * s, 0.42 * s, 0xff8a3d, x, 0.21 * s, z);
  [[0, 0.85, 0, 0.38], [0.18, 0.7, 0.12, 0.28], [-0.15, 0.72, -0.1, 0.26], [0.05, 1.05, -0.08, 0.22]].forEach(([dx, dy, dz, r]) => ball(r * s, 0x2fbf71, x + dx * s, dy * s, z + dz * s));
}
export function sofa(x, z, len, ry, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const m1 = mat(color, { r: 0.6 }), m2 = mat(color, { r: 0.6, e: color, ei: 0.12 });
  [[len, 0.45, 0.95, 0, 0.3, 0, m1], [len - 0.5, 0.2, 0.8, 0, 0.62, 0.04, m2], [len, 0.75, 0.22, 0, 0.85, -0.37, m1], [0.25, 0.65, 0.95, len / 2 - 0.12, 0.55, 0, m1], [0.25, 0.65, 0.95, -len / 2 + 0.12, 0.55, 0, m1]]
    .forEach(([w, h, d, px, py, pz, mt]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); b.position.set(px, py, pz); b.castShadow = b.receiveShadow = true; g.add(b); });
  obstacle(x, z, len, 0.95, ry);
}
export function beanbag(x, z, color) { ball(0.55, color, x, 0.38, z, { sy: 0.7, r: 0.85 }); obstacle(x, z, 0.9, 0.9); }
export function chair(x, z, ry, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const mk = (w, h, d, px, py, pz, c) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, { r: 0.5 })); b.position.set(px, py, pz); b.castShadow = true; g.add(b); };
  mk(0.75, 0.1, 0.75, 0, 0.5, 0, color); mk(0.75, 0.75, 0.1, 0, 0.92, -0.35, color); mk(0.1, 0.45, 0.1, 0, 0.25, 0, 0x2b3550);
}
export function stool(x, z, color) { cyl(0.27, 0.27, 0.08, color, x, 0.78, z); cyl(0.04, 0.04, 0.74, 0xc9d0e0, x, 0.38, z, { m: 0.6 }); obstacle(x, z, 0.6, 0.6); }
export function table(x, z, w, d, color = 0xf5f3ff, h = 0.95, neonC = null) {
  box(w, 0.12, d, color, x, h, z, { r: 0.25, m: 0.3 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.12, h, 0.12, 0x2b3550, x + sx * (w / 2 - 0.2), h / 2, z + sz * (d / 2 - 0.2)));
  if (neonC) neon(w + 0.1, 0.04, d + 0.1, neonC, x, h - 0.1, z);
  obstacle(x, z, w, d);
}
export function arcade(x, z, ry, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.95, 1.9, 0.8), mat(0x1b1f3a, { r: 0.5 }), 0, 0.95, 0);
  add(new THREE.BoxGeometry(0.99, 1.9, 0.1), mat(color, { e: color, ei: 0.5 }), 0, 0.95, 0.36);
  const s = canvasTex(128, 96, (c, w, h) => { c.fillStyle = "#111836"; c.fillRect(0, 0, w, h); c.fillStyle = "#" + color.toString(16).padStart(6, "0"); for (let i = 0; i < 14; i++) c.fillRect(Math.random() * 110, Math.random() * 80, 12, 8); });
  const sc = add(new THREE.PlaneGeometry(0.68, 0.52), new THREE.MeshBasicMaterial({ map: s.tex }), 0, 1.35, 0.425); sc.rotation.x = -0.15;
  const mq = add(new THREE.BoxGeometry(0.95, 0.22, 0.2), mat(color, { e: color, ei: 1 }), 0, 1.97, 0.35); neonMats.push({ mat: mq.material, p: Math.random() * 6 });
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), mat(0xff3b6b), -0.15, 0.95, 0.5);
  obstacle(x, z, 0.95, 0.8, ry);
}
export function shelf(x, z, ry, w = 1.8, h = 2.1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), mat(0x7b5a3a)); sh.position.y = h / 2; sh.castShadow = true; g.add(sh);
  for (let r = 0; r < 4; r++) for (let b = 0; b < Math.floor(w / 0.22); b++) {
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3 + (b % 3) * 0.05, 0.3), mat(PAL[(r * 7 + b) % PAL.length]));
    bk.position.set(-w / 2 + 0.2 + b * 0.22, 0.4 + r * 0.46, 0.05); g.add(bk);
  }
  obstacle(x, z, w, 0.45, ry);
}
export function rack(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 2.3, 0.85), mat(0x1f2937)); b.position.y = 1.15; b.castShadow = true; g.add(b);
  for (let i = 0; i < 8; i++) {
    const u = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.2, 0.04), mat(0x2d3748)); u.position.set(0, 0.35 + i * 0.27, 0.44); g.add(u);
    const c = i % 3 === 0 ? P.cyan : i % 3 === 1 ? P.lime : P.pink;
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: c })); led.position.set(0.32, 0.35 + i * 0.27, 0.47); g.add(led);
    neonMats.push({ blink: led.material, p: Math.random() * 10, on: c });
  }
  obstacle(x, z, 1, 0.85, ry);
}
function coffeeMachine(x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  const part = (w, h, d, px, py, pz, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  part(0.7, 0.85, 0.55, 0, 0.43, 0, mat(0x2b2f45, { r: 0.4, m: 0.4 }));
  const d = part(0.28, 0.14, 0.03, 0.12, 0.62, 0.29, mat(P.red, { e: P.red, ei: 1 })); neonMats.push({ mat: d.material, p: 1 });
  part(0.12, 0.16, 0.12, -0.15, 0.1, 0.22, mat(0xffffff));
  part(0.08, 0.1, 0.08, 0.12, 0.35, 0.25, mat(0x888fa8));
}
function vending(x, z, ry, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.9), mat(color, { e: color, ei: 0.15 })); b.position.y = 1.05; b.castShadow = true; g.add(b);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.4, 0.04), mat(0x101626, { a: 0.9 })); win.position.set(-0.1, 1.2, 0.46); g.add(win);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), mat(PAL[(r * 4 + c) % PAL.length], { e: PAL[(r * 4 + c) % PAL.length], ei: 0.4 })); s.position.set(-0.4 + c * 0.2, 0.7 + r * 0.33, 0.43); g.add(s); }
  obstacle(x, z, 1.2, 0.9, ry);
}
function pod(x, z, ry, color) { // nap capsule
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.2), mat(0x2b3550)); base.position.y = 0.3; g.add(base);
  const mat1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 1.0), mat(0xf5f3ff)); mat1.position.y = 0.66; g.add(mat1);
  const dome = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.4, 6, 14), mat(color, { a: 0.35, r: 0.1, e: color, ei: 0.25 })); dome.rotation.z = Math.PI / 2; dome.position.y = 1.0; g.add(dome);
  obstacle(x, z, 2.4, 1.2, ry);
}

// ---------- the building ----------
export function buildWorld() {
  // sky-ish backdrop floor under everything
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x0d1220, { r: 1, m: 0 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);

  // rooms (floors, neon edges, labels)
  room("game", "Game Room", -32, -22, -14, -8, P.pink, 0x3b2a7a, { m: 0.3 });
  room("meeting", "Meeting Room", -14, -22, 2, -8, P.cyan, 0xd9e8ff);
  room("tele", "Teleconference", 2, -22, 16, -8, P.blue, 0xcdd9ff);
  room("server", "Server Lab", 16, -22, 32, -8, P.lime, 0x1c2540, { m: 0.4 });
  room("corridor", "", -32, -8, 32, -5, P.violet, 0xdfe5f5);
  room("pantry", "Pantry", -32, -5, -14, 8, P.orange, 0xffe9b8, { checker: ["#ffe9b8", "#ffd48a"] });
  room("rest", "Rest Room", -32, 8, -14, 22, P.violet, 0xe5d9ff);
  room("library", "Focus Library", 14, -5, 32, 8, P.teal, 0xd7f5df);
  room("chill", "Chill Lounge", 14, 8, 32, 22, P.yellow, 0xffd9ee);
  room("work", "Open Workspace", -14, -5, 14, 14, P.cyan, 0xeaf0ff, { labelZ: -3.6 });
  room("reception", "Reception", -14, 14, 14, 22, P.pink, 0xf2f6ff, { labelZ: 20.6 });

  // exterior walls: tall on the north/west (back), low glass on south/east (so the camera sees in)
  wall(-HW, -HD, HW, -HD, { h: 3.4, glass: 0, color: 0xb9b0ff, trim: P.violet });
  wall(-HW, -HD, -HW, HD, { h: 3.4, glass: 0, color: 0xb9b0ff, trim: P.violet });
  wall(HW, -HD, HW, HD, { h: 0.7, glass: 1.4, color: 0xb9b0ff, trim: P.violet });
  wall(-HW, HD, HW, HD, { h: 0.7, glass: 1.4, color: 0xb9b0ff, trim: P.violet, doors: [[-2.6, 2.6]] });
  // north row: dividers and the wall facing the corridor (a door per room)
  for (const x of [-14, 2, 16]) wall(x, -HD, x, -8, { trim: P.cyan });
  wall(-HW, -8, HW, -8, { trim: P.cyan, doors: [[-24.5, -21.5], [-7.5, -4.5], [7.5, 10.5], [21.5, 24.5]] });
  // west and east columns: doors open onto the workspace
  wall(-14, -5, -14, HD, { trim: P.orange, doors: [[0, 3.2], [13, 16.2]] });
  wall(14, -5, 14, HD, { trim: P.teal, doors: [[0, 3.2], [13, 16.2]] });
  wall(-HW, -5, -14, -5, { trim: P.orange }); wall(14, -5, HW, -5, { trim: P.teal });
  wall(-HW, 8, -14, 8, { trim: P.violet }); wall(14, 8, HW, 8, { trim: P.yellow });

  buildGame(); buildMeeting(); buildTele(); buildServer(); buildPantry(); buildRest(); buildLibrary(); buildChill(); buildCommon();
  places.corridor = { x: 0, z: -6.5 };
  places.entrance = { x: 0, z: 19.6 };
  places.reception = { x: -2, z: 17 };
  places["water-cooler"] = { x: -15.6, z: -3.2 };
}
function buildGame() {
  const cx = -23;
  [-29, -26.8, -24.6, -22.4, -20.2].forEach((x, i) => { arcade(x, -21.2, 0, [P.cyan, P.pink, P.lime, P.yellow, P.orange][i]); slot("arcade", x, -19.8, "n"); });
  box(3.6, 0.9, 1.9, 0x1fa26b, cx, 0.45, -13.5); neon(3.7, 0.04, 2.0, P.lime, cx, 0.9, -13.5); box(0.1, 0.5, 1.7, 0xffffff, cx, 1.15, -13.5, { cast: false });
  obstacle(cx, -13.5, 3.6, 1.9);
  [[cx, -15.4], [cx, -11.6], [cx - 2.4, -13.5], [cx + 2.4, -13.5]].forEach(([x, z]) => slot("table", x, z));
  const tv = canvasTex(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#be185d"); gr.addColorStop(1, "#4f46e5"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 72px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("GAME ON", w / 2, h / 2); });
  screen(3.8, 2.0, -31.7, 1.9, -11, Math.PI / 2, tv);
  sofa(-28.6, -11, 4, -Math.PI / 2, P.violet); slot("couch", -28.8, -12.2, "w"); slot("couch", -28.8, -9.8, "w");
  beanbag(-27, -15.6, P.pink); beanbag(-25.7, -8.8, P.orange); slot("couch", -27, -15.6, "w");
  box(6, 0.04, 6.5, 0x5b21b6, -27.5, 0.03, -11, { cast: false });
  glow(P.pink, 1.6, cx, 2.8, -15); plant(-30.5, -8.9, 1);
}
function buildMeeting() {
  const cx = -6, cz = -15;
  table(cx, cz, 7.4, 2.4, 0x161a3a, 0.95, P.pink);
  [-8.8, -7.4, -6, -4.6, -3.2].forEach(x => { chair(x, -17.1, 0, 0x22e5ff); chair(x, -12.9, Math.PI, 0xff4fd8); slot("meeting", x, -17.1, "s"); slot("meeting", x, -12.9, "n"); });
  chair(-10.8, cz, Math.PI / 2, P.lime); chair(-1.2, cz, -Math.PI / 2, P.yellow); slot("meeting", -10.8, cz, "e"); slot("meeting", -1.2, cz, "w");
  [-11, -9.3, -7.6, -5.9, -4.2, -2.5, -9, -3].forEach((x, i) => slot("meeting", x, i < 6 ? -20.4 : -10.2, i < 6 ? "s" : "n"));
  // whiteboard + wall screen on the north wall
  box(3.4, 1.9, 0.08, 0xf8fafc, -9, 2.0, -21.8, { r: 0.3 }); box(3.5, 2.0, 0.06, 0x9aa4b4, -9, 2.0, -21.85, { cast: false });
  [[P.lime, -0.8, 0.4], [P.blue, 0.2, 0.1], [P.pink, 0.8, -0.4]].forEach(([c, dx, dy]) => box(1.0, 0.05, 0.02, c, -9 + dx, 2.0 + dy, -21.73, { cast: false }));
  screen(4.2, 2.1, -3, 2.0, -21.75, 0, titleScreen("TEAM SYNC", "#6d28d9", "#06b6d4"));
  places.whiteboard = { x: -9, z: -20.4 };
  glow(P.cyan, 1.4, cx, 2.8, cz); plant(-12.6, -9, 1); plant(0.6, -9, 1);
}
function buildTele() {
  const cx = 9;
  const wallScreen = canvasTex(512, 288, () => {});
  animated.push({ ...wallScreen, draw(g, w, h, t) {
    g.fillStyle = "#0b1030"; g.fillRect(0, 0, w, h);
    const cols = 4, rows = 2, tw = w / cols, th = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, active = Math.floor(t / 2) % 8 === i;
      g.fillStyle = "#" + PAL[i % PAL.length].toString(16).padStart(6, "0"); g.globalAlpha = active ? 0.95 : 0.55; g.fillRect(c * tw + 4, r * th + 4, tw - 8, th - 8); g.globalAlpha = 1;
      g.fillStyle = "#0b1030"; g.beginPath(); g.arc(c * tw + tw / 2, r * th + th / 2 - 8, 22, 0, Math.PI * 2); g.fill();
      g.fillRect(c * tw + tw / 2 - 30, r * th + th / 2 + 18, 60, 22);
      if (active) { g.strokeStyle = "#fff"; g.lineWidth = 4; g.strokeRect(c * tw + 4, r * th + 4, tw - 8, th - 8); }
    }
  } });
  screen(8.6, 4.8, cx, 2.6, -21.75, 0, wallScreen);
  table(cx, -14.6, 7.2, 1.5, 0xe8ecff, 0.95, P.blue);
  [6.3, 7.8, 9.3, 10.8, 12].forEach(x => { chair(x, -12.7, Math.PI, 0x3b82f6); slot("tele", x, -12.7, "n"); });
  [[5.2, -19.8], [9, -19.9], [12.8, -19.8]].forEach(([x, z]) => slot("tele", x, z, "n"));
  const onair = label("● ON AIR", 6, 2.6, -8, "#ff4d6d", 12);
  neon(1.6, 0.06, 0.06, P.red, 6, 2.2, -8.1);
  cyl(0.5, 0.5, 0.05, P.pink, 9, 3.4, -12, { e: P.pink, ei: 1 });
  glow(P.blue, 1.5, cx, 2.8, -15); plant(15.2, -9, 1); plant(2.8, -9, 1);
}
function buildServer() {
  for (let i = 0; i < 9; i++) rack(18.5 + i * 1.35, -21.1, 0);
  for (let i = 0; i < 5; i++) rack(31.1, -19 + i * 1.4, -Math.PI / 2);
  table(22, -12.6, 3.4, 1.4, 0x0f172a, 0.9, P.lime);
  [-0.8, 0.8].forEach(dx => box(0.9, 0.55, 0.05, 0x050816, 22 + dx, 1.45, -12.9, { e: P.cyan, ei: 0.35 }));
  chair(22, -11.3, Math.PI, P.lime); slot("server", 22, -11.3, "n"); slot("server", 20, -12.6, "e"); slot("server", 24, -12.6, "w");
  places["server-racks"] = { x: 24, z: -19.2 };
  box(15, 0.03, 0.08, P.cyan, 24, 0.05, -17.2, { e: P.cyan, ei: 1, cast: false });
  glow(P.lime, 1.3, 24, 2.8, -15); glow(P.cyan, 1.0, 24, 2.4, -19);
}
function buildPantry() {
  box(1.3, 1.0, 9.6, 0xffffff, -31.1, 0.5, 1.3, { r: 0.3 }); box(1.4, 0.08, 9.7, 0x2b3550, -31.1, 1.02, 1.3); obstacle(-31.1, 1.3, 1.3, 9.6);
  coffeeMachine(-31.1, 1.06, -1.6, Math.PI / 2); coffeeMachine(-31.1, 1.06, 0.2, Math.PI / 2);
  box(0.5, 0.35, 0.45, 0x888fa8, -31.1, 1.25, 2.6, { m: 0.5 }); box(0.45, 0.3, 0.35, 0xf5f5f5, -31.1, 1.22, 3.5);
  box(0.9, 1.9, 1.0, 0xe8eef5, -31.1, 0.95, 6.9, { m: 0.3 }); box(1.0, 0.8, 8.4, 0xffd48a, -31.5, 2.5, 1.3, { cast: false });
  slot("coffee", -29.5, -1.6, "w"); slot("coffee", -29.5, 0.2, "w");
  box(5.2, 1.0, 1.1, 0xff8a3d, -22, 0.5, 2.8); box(5.4, 0.08, 1.3, 0xffffff, -22, 1.04, 2.8); neon(5, 0.05, 0.05, P.yellow, -22, 0.8, 2.22);
  obstacle(-22, 2.8, 5.4, 1.3);
  [-24.2, -22.7, -21.2, -19.7].forEach((x, i) => { stool(x, 4.5, [P.cyan, P.pink, P.lime, P.violet][i]); slot("snack", x, 4.5, "n"); });
  slot("snack", -23, 1.0, "s"); slot("snack", -21, 1.0, "s");
  [P.pink, P.cyan, P.yellow].forEach((c, i) => cyl(0.14, 0.11, 0.3, c, -23.8 + i * 1.6, 1.23, 2.8));
  vending(-19.8, -4.2, 0, P.pink); vending(-18.4, -4.2, 0, P.cyan); slot("vending", -19.1, -2.8, "n");
  cyl(0.28, 0.28, 1.1, 0xe8eef5, -15.6, 0.55, -3.6); cyl(0.24, 0.24, 0.5, 0x7ec8e3, -15.6, 1.35, -3.6, { a: 0.6 });
  glow(P.orange, 1.4, -23, 2.8, 1.5); plant(-15.5, 6.8, 1); label("COFFEE", -31.1, 2.6, -0.7, "#ffb36b", 11);
}
function buildRest() {
  [10.6, 13.3, 16, 18.7].forEach((z, i) => { pod(-30.3, z, Math.PI / 2, [P.violet, P.pink, P.teal, P.blue][i]); slot("nap", -30.3, z, "e"); });
  beanbag(-24, 11.5, P.pink); beanbag(-22.3, 12.6, P.yellow); beanbag(-25, 13.2, P.cyan); beanbag(-21, 10.8, P.lime);
  slot("sit", -24, 11.5, "s"); slot("sit", -22.3, 12.6, "s"); slot("sit", -25, 13.2, "s"); slot("sit", -21, 10.8, "s");
  sofa(-22, 19.6, 5.2, Math.PI, P.teal); slot("sit", -23.4, 18.4, "n"); slot("sit", -22, 18.4, "n"); slot("sit", -20.6, 18.4, "n");
  box(5, 0.03, 4, 0x6d28d9, -23, 0.03, 15.5, { cast: false }); plant(-15.5, 20.5, 1.1); plant(-15.5, 9.2, 1);
  for (let i = 0; i < 14; i++) ball(0.07, PAL[i % PAL.length], -31 + i * 1.2, 2.4 + Math.sin(i) * 0.15, 21.6, { e: PAL[i % PAL.length], ei: 1, cast: false });
  glow(P.violet, 1.0, -23, 2.6, 15);
}
function buildLibrary() {
  for (let i = 0; i < 5; i++) shelf(31.4, -3.2 + i * 2, -Math.PI / 2);
  for (let i = 0; i < 6; i++) shelf(17 + i * 2, -4.6, 0);
  [20, 24, 28].forEach(x => {
    table(x, 0.8, 2.2, 0.9, 0xf5f3ff, 0.9, P.teal);
    box(0.08, 1.6, 1.6, 0x14d8b8, x - 1.15, 0.8, 1.1, { a: 0.55 }); box(0.08, 1.6, 1.6, 0x14d8b8, x + 1.15, 0.8, 1.1, { a: 0.55 });
    box(0.7, 0.45, 0.05, 0x050816, x, 1.35, 0.55, { e: P.teal, ei: 0.3 });
    chair(x, 2.0, Math.PI, 0x14d8b8); slot("focus", x, 2.0, "n");
  });
  [[17.5, 5.5, 0.6], [30, 5.5, -0.6]].forEach(([x, z, ry]) => { sofa(x, z, 1.8, ry, P.orange); slot("read", x, z + 0.2, "s"); });
  glow(P.teal, 1.1, 23, 2.6, 2); plant(15.4, 6.8, 1.1);
}
function buildChill() {
  const tv = canvasTex(512, 280, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#f59e0b"); gr.addColorStop(1, "#db2777"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 60px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("MOVIE NIGHT", w / 2, h / 2); });
  screen(5.2, 2.9, 31.7, 2.2, 15, -Math.PI / 2, tv);
  sofa(27.4, 15, 5.4, Math.PI / 2, P.violet); [13.3, 15, 16.7].forEach(z => slot("cinema", 27.2, z, "e"));
  sofa(23, 20.2, 4.4, Math.PI, P.pink); [21.5, 23, 24.5].forEach(x => slot("cinema", x, 20.0, "n"));
  table(24.2, 15.4, 1.6, 1.6, 0x2b3550, 0.45, P.yellow);
  beanbag(20.5, 11.8, P.cyan); beanbag(22.3, 12.6, P.lime); slot("cinema", 20.5, 11.8, "e"); slot("cinema", 22.3, 12.6, "e");
  box(5, 0.03, 7, 0xb91c6a, 24.5, 0.03, 15, { cast: false });
  // boba bar
  box(4.4, 1.1, 0.9, 0xff4fd8, 17.4, 0.55, 21.2); box(4.6, 0.08, 1.1, 0xf5f3ff, 17.4, 1.12, 21.2); neon(4.2, 0.05, 0.05, P.cyan, 17.4, 0.9, 20.72); obstacle(17.4, 21.2, 4.6, 1.1);
  [15.8, 17.4, 19].forEach((x, i) => { stool(x, 19.4, [P.lime, P.yellow, P.cyan][i]); slot("boba", x, 19.4, "n"); cyl(0.14, 0.11, 0.3, PAL[(i + 3) % 8], x, 1.31, 21.2); });
  places["boba-bar"] = { x: 17.4, z: 18.2 };
  label("BOBA BAR", 17.4, 2.7, 21.4, "#ff9be9", 11);
  glow(P.yellow, 1.2, 24, 2.7, 15); glow(P.pink, 1.0, 17.5, 2.6, 19); plant(30.6, 9.4, 1.1);
}
function buildCommon() {
  // reception desk + sofas + plants + welcome mat
  box(5.6, 1.1, 1.3, 0xffffff, -7, 0.55, 18, { r: 0.3 }); box(5.8, 0.08, 1.5, 0x161a3a, -7, 1.12, 18); neon(5.4, 0.06, 0.06, P.pink, -7, 0.95, 17.3); obstacle(-7, 18, 5.8, 1.5);
  slot("reception", -7, 16.6, "s"); slot("reception", -5, 16.6, "s");
  sofa(7, 19.6, 4, Math.PI, P.cyan); slot("sit", 5.8, 18.4, "n"); slot("sit", 8.2, 18.4, "n");
  box(3.2, 0.04, 1.6, 0x161a3a, 0, 0.03, 20.3, { cast: false });
  plant(-12.6, 15.2, 1.2); plant(12.6, 15.2, 1.2); plant(-12.6, 20.8, 1.1); plant(12.6, 20.8, 1.1); plant(0, 15.2, 0.9);
  // open workspace pillars of light + plants
  plant(-13, -3.8, 1); plant(13, -3.8, 1); plant(-13, 13, 1); plant(13, 13, 1);
  const sign = label("DEKA OFFICE", 0, 2.6, 21.2, "#bff3ff", 18);
  glow(P.cyan, 1.2, 0, 2.8, 4); glow(P.pink, 1.0, 0, 2.8, 18); glow(0xcfe6ff, 1.0, -8, 2.8, 5); glow(0xcfe6ff, 1.0, 8, 2.8, 5); glow(0xcfe6ff, 1.0, 0, 2.8, -6.5);
}

export function tickWorld(t) {
  for (const n of neonMats) {
    if (n.mat) n.mat.emissiveIntensity = 0.85 + 0.35 * Math.sin(t * 1.6 + n.p);
    else if (n.blink) n.blink.color.setHex(Math.sin(t * 5 + n.p) > 0.1 ? n.on : 0x1f2937);
  }
}
let lastAnim = 0;
export function tickScreens(t) {
  if (t - lastAnim < 0.5) return; lastAnim = t;
  for (const a of animated) { a.draw(a.ctx, a.w, a.h, t); a.tex.needsUpdate = true; }
}
