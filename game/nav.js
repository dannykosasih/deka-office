// Walkable grid + A* so bots go through doors and around furniture.
import { obstacles, HW, HD } from "./world.js";

const CELL = 0.5, PAD = 0.3, GX = Math.round(HW * 2 / CELL), GZ = Math.round(HD * 2 / CELL);
const cellOf = (x, z) => [Math.floor((x + HW) / CELL), Math.floor((z + HD) / CELL)];
const centerOf = (ix, iz) => [ix * CELL - HW + CELL / 2, iz * CELL - HD + CELL / 2];
const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < GX && iz < GZ;
let base = null;

export function buildGrid() {
  base = new Uint8Array(GX * GZ);
  for (let iz = 0; iz < GZ; iz++) for (let ix = 0; ix < GX; ix++) {
    const [cx, cz] = centerOf(ix, iz);
    if (Math.abs(cx) > HW - 0.8 || Math.abs(cz) > HD - 0.8) { base[iz * GX + ix] = 1; continue; }
    for (const o of obstacles) if (Math.abs(cx - o.x) <= o.w / 2 + PAD && Math.abs(cz - o.z) <= o.d / 2 + PAD) { base[iz * GX + ix] = 1; break; }
  }
}
export function isBlocked(x, z) { const [ix, iz] = cellOf(x, z); return !inGrid(ix, iz) || !!base[iz * GX + ix]; }

function nearestFree(grid, x, z, maxR = 12) {
  const [sx, sz] = cellOf(x, z);
  for (let r = 0; r <= maxR; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const ix = sx + dx, iz = sz + dz;
    if (inGrid(ix, iz) && !grid[iz * GX + ix]) return [ix, iz];
  }
  return null;
}
function lineFree(grid, a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2);
  for (let i = 0; i <= n; i++) {
    const [ix, iz] = cellOf(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n);
    if (!inGrid(ix, iz) || grid[iz * GX + ix]) return false;
  }
  return true;
}
class Heap {
  constructor() { this.a = []; }
  push(item) { const a = this.a; a.push(item); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

// from/to: {x, z} in world units. Returns waypoints [{x, z}] or null when unreachable.
export function findPath(from, to) {
  if (!base) buildGrid();
  const grid = base.slice();
  const [fx, fz] = cellOf(from.x, from.z);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { // free the seat the bot is leaving
    const ix = fx + dx, iz = fz + dz;
    if (inGrid(ix, iz)) { const [cx, cz] = centerOf(ix, iz); if (Math.hypot(cx - from.x, cz - from.z) < 1.1) grid[iz * GX + ix] = 0; }
  }
  const goal = nearestFree(grid, to.x, to.z); if (!goal) return null;
  const idx = (x, z) => z * GX + x, start = [fx, fz];
  const open = new Heap(); open.push([0, start[0], start[1]]);
  const came = new Map(), gs = new Map([[idx(...start), 0]]);
  const h = (x, z) => { const dx = Math.abs(x - goal[0]), dz = Math.abs(z - goal[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  let found = false;
  while (open.size) {
    const [, x, z] = open.pop();
    if (x === goal[0] && z === goal[1]) { found = true; break; }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz;
      if (!inGrid(nx, nz) || grid[idx(nx, nz)]) continue;
      if (dx && dz && (grid[idx(x + dx, z)] || grid[idx(x, z + dz)])) continue; // no corner cutting
      const ng = gs.get(idx(x, z)) + (dx && dz ? 1.414 : 1);
      if (ng < (gs.get(idx(nx, nz)) ?? Infinity)) { gs.set(idx(nx, nz), ng); came.set(idx(nx, nz), [x, z]); open.push([ng + h(nx, nz), nx, nz]); }
    }
  }
  if (!found) return null;
  let cur = goal; const cells = [cur];
  while (came.has(idx(...cur))) { cur = came.get(idx(...cur)); cells.push(cur); }
  cells.reverse();
  const pts = cells.map(([ix, iz]) => centerOf(ix, iz));
  pts[0] = [from.x, from.z];
  const out = [pts[0]]; let anchor = 0; // string-pull: skip waypoints that have a clear line of sight
  for (let i = 2; i < pts.length; i++) if (!lineFree(grid, pts[anchor], pts[i])) { out.push(pts[i - 1]); anchor = i - 1; }
  out.push(pts[pts.length - 1]);
  return out.slice(1).map(([x, z]) => ({ x, z }));
}
