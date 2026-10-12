// Bots: desks, bodies (voxel sprites or a built-in robot), name tags, speech bubbles, walking.
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { scene, box, cyl, chair, obstacle, neon } from "./world.js";
import { findPath } from "./nav.js";

export const STATE_COLOR = { working: 0x4ade80, waiting: 0xfbbf24, idle: 0x64748b };
export const bots = {};
export const clickable = [];
const SPEED = 3.4;
const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.5, metalness: o.m ?? 0.05, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 0 });

// 5 x 4 grid of desks in the open workspace, in roster order
const DESK_X = [-10, -5, 0, 5, 10], DESK_Z = [-1.8, 2.4, 6.6, 10.8];
export function deskSpot(i) { return { x: DESK_X[i % 5], z: DESK_Z[Math.floor(i / 5) % 4] }; }

function buildDesk(x, z, color) {
  box(2.9, 0.12, 1.5, 0xc79a6b, x, 1.0, z, { r: 0.5 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.1, 1.0, 0.1, 0x3b3f4a, x + sx * 1.3, 0.5, z + sz * 0.6);
  box(1.3, 0.8, 0.07, 0x111827, x, 1.65, z - 0.45);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.68), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
  glow.position.set(x, 1.65, z - 0.4); scene.add(glow);
  box(0.5, 0.04, 0.3, 0x2b3550, x + 0.9, 1.08, z + 0.2); box(0.12, 0.1, 0.12, color, x - 1.1, 1.1, z + 0.1, { e: color, ei: 0.4 });
  chair(x, z + 1.3, Math.PI, color); obstacle(x, z, 3.1, 1.7); obstacle(x, z + 1.3, 1.0, 1.0);
  return glow;
}

function robotBody(color) {
  const g = new THREE.Group();
  const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);
  const body = new THREE.Mesh(rb(0.85, 0.95, 0.6, 0.18), m(color)); body.position.y = 1.15; g.add(body);
  const belly = new THREE.Mesh(rb(0.5, 0.5, 0.05, 0.05), m(0xffffff)); belly.position.set(0, 1.18, 0.31); g.add(belly);
  const badge = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20), m(0xf5b301, { e: 0xf5b301, ei: 0.6 })); badge.position.set(0, 1.18, 0.34); g.add(badge);
  const head = new THREE.Group(); head.position.y = 2.0; g.add(head);
  head.add(new THREE.Mesh(rb(1.0, 0.8, 0.8, 0.25), m(0xf1f5f9)));
  const visor = new THREE.Mesh(rb(0.78, 0.5, 0.06, 0.1), m(0x0a0e1f, { r: 0.2 })); visor.position.set(0, 0.0, 0.4); head.add(visor);
  for (const ex of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color })); e.position.set(ex, 0.03, 0.44); e.scale.set(1, 1.3, 0.5); head.add(e); }
  for (const sx of [-1, 1]) { const ph = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16), m(color)); ph.rotation.z = Math.PI / 2; ph.position.set(sx * 0.55, 0, 0); head.add(ph); }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), m(0xcbd5e1)); ant.position.set(0, 0.55, 0); head.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m(color, { e: color, ei: 1 })); tip.position.set(0, 0.72, 0); head.add(tip);
  const arm = side => { const p = new THREE.Group(); p.position.set(side * 0.55, 1.5, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), m(color)); a.position.y = -0.35; p.add(a); g.add(p); return p; };
  const leg = side => { const p = new THREE.Group(); p.position.set(side * 0.22, 0.7, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 4, 8), m(0xe2e8f0)); a.position.y = -0.3; p.add(a); const f = new THREE.Mesh(rb(0.3, 0.14, 0.4, 0.05), m(color)); f.position.set(0, -0.6, 0.05); p.add(f); g.add(p); return p; };
  g.userData = { head, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), body };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createBot(info, color, spot, art, deskGlow) {
  const home = { x: spot.x, z: spot.z + 1.3 };
  const root = new THREE.Group(); root.position.set(home.x, 0, home.z); scene.add(root);
  const b = {
    id: info.id, name: info.name, role: info.role, zone: info.zone, color, root, home, pos: { ...home }, path: [], face: 1, heading: Math.PI,
    state: "idle", task: "", mode: "desk", activity: null, walkW: 0, phase: Math.random() * 10, deskGlow, w: { working: 0, waiting: 0, idle: 1 },
    onArrive: null, extra: {}
  };
  if (art) {
    const tex = new THREE.TextureLoader().load(`portraits/voxels/${art}.png?v=2`); tex.colorSpace = THREE.SRGBColorSpace;
    b.spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    b.spr.scale.set(1.58, 2.5, 1); b.spr.position.y = 1.3; b.spr.userData.id = b.id; root.add(b.spr); clickable.push(b.spr);
  } else {
    b.robot = robotBody(color); b.robot.rotation.y = Math.PI; root.add(b.robot);
    b.robot.traverse(o => { if (o.isMesh) { o.userData.id = b.id; clickable.push(o); } });
  }
  // glowing status orb, name tag, speech bubble
  b.orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshBasicMaterial({ color: STATE_COLOR.idle })); b.orb.position.y = 2.95; root.add(b.orb);
  b.target = new THREE.Color(STATE_COLOR.idle);
  const tag = document.createElement("div"); tag.className = "tag"; tag.innerHTML = `<b>${info.name}</b><i>idle</i>`;
  const tagObj = new CSS2DObject(tag); tagObj.position.set(0, 3.45, 0); root.add(tagObj); b.tagEl = tag;
  const bub = document.createElement("div"); bub.className = "bubble";
  const bubObj = new CSS2DObject(bub); bubObj.position.set(0, 4.25, 0); bubObj.visible = false; root.add(bubObj); b.bubEl = bub; b.bubObj = bubObj; // CSS2DRenderer owns style.display, so hide via .visible
  bots[b.id] = b;
  return b;
}
export { buildDesk };

export function setTag(b) {
  const n = b.extra.queued || 0;
  const line = b.mode === "activity" && b.activity ? b.activity.text : (b.state === "idle" ? "idle" : b.task);
  b.tagEl.querySelector("i").textContent = line + (n ? ` · ${n} queued` : "");
}
let bubbleTimers = new WeakMap();
export function say(b, text, ms = 3200) {
  b.bubEl.textContent = text; b.bubObj.visible = true;
  clearTimeout(bubbleTimers.get(b)); bubbleTimers.set(b, setTimeout(() => { b.bubObj.visible = false; }, ms));
}

// Walk to {x, z, face}. Returns false when there is no way.
export function walkTo(b, target, onArrive) {
  const path = findPath(b.pos, target);
  if (!path) return false;
  b.path = path; b.onArrive = onArrive || null;
  b.endFace = target.face === "e" ? 1 : target.face === "w" ? -1 : null;
  b.endHeading = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[target.face] ?? null;
  return true;
}
export const atHome = b => Math.hypot(b.pos.x - b.home.x, b.pos.z - b.home.z) < 0.6 && !b.path.length;

export function update(dt, t) {
  for (const b of Object.values(bots)) {
    const moving = b.path.length > 0 || b.manualMove;
    b.walkW += ((moving ? 1 : 0) - b.walkW) * (1 - Math.exp(-dt * 8));
    if (b.path.length) {
      const p = b.path[0], nx = p.x - b.pos.x, nz = p.z - b.pos.z, dist = Math.hypot(nx, nz), step = SPEED * dt;
      if (dist <= step) {
        b.pos.x = p.x; b.pos.z = p.z; b.path.shift();
        if (!b.path.length) { if (b.endFace) b.face = b.endFace; if (b.endHeading !== null && b.endHeading !== undefined) b.heading = b.endHeading; const cb = b.onArrive; b.onArrive = null; if (cb) cb(b); }
      } else {
        b.pos.x += nx / dist * step; b.pos.z += nz / dist * step; b.heading = Math.atan2(nx, nz);
        if (Math.abs(nx) > 0.05) b.face = nx > 0 ? 1 : -1;
      }
      b.root.position.set(b.pos.x, 0, b.pos.z);
    }
    const k = 1 - Math.exp(-dt * 2.5);
    for (const s of ["working", "waiting", "idle"]) b.w[s] += ((b.state === s ? 1 : 0) - b.w[s]) * k;
    const { working: W, waiting: A, idle: I } = b.w, ph = b.phase, wk = b.walkW;
    const atDesk = !moving && atHome(b), seated = atDesk && b.mode === "desk";
    const actBob = b.mode === "activity" && !moving ? Math.abs(Math.sin(t * 4 + ph)) * 0.05 : 0;
    const bob = wk * Math.abs(Math.sin(t * 10 + ph)) * 0.14 + (seated ? W * Math.abs(Math.sin(t * 7 + ph)) * 0.06 + I * Math.sin(t * 1.8 + ph) * 0.03 : 0) + actBob;
    if (b.spr) { b.spr.position.y = 1.3 + bob; b.spr.scale.x = 1.58 * (seated && A > 0.5 ? -b.face : b.face); }
    if (b.robot) {
      const u = b.robot.userData, swing = Math.sin(t * 9 + ph) * wk;
      b.robot.rotation.y = seated ? Math.PI + A * Math.PI : b.heading;
      b.robot.position.y = bob;
      u.legL.rotation.x = swing * 0.7; u.legR.rotation.x = -swing * 0.7;
      u.armL.rotation.x = wk > 0.1 ? -swing * 0.8 : W * (1.15 + Math.sin(t * 14 + ph) * 0.15);
      u.armR.rotation.x = wk > 0.1 ? swing * 0.8 : W * (1.15 + Math.sin(t * 14 + ph + 3) * 0.15);
      u.armR.rotation.z = wk > 0.1 ? 0 : A * (2.5 + Math.sin(t * 7 + ph) * 0.35);
      u.head.rotation.y = I * Math.sin(t * 0.45 + ph) * 0.5; u.head.rotation.x = W * 0.15;
    }
    b.orb.material.color.lerp(b.target, k); b.orb.scale.setScalar(1 + A * Math.sin(t * 4) * 0.3);
    b.orb.position.y = 2.95 + bob;
    if (b.deskGlow) b.deskGlow.material.opacity = 0.2 + W * (0.35 + Math.sin(t * 9 + ph) * 0.05) + A * 0.1;
  }
}
