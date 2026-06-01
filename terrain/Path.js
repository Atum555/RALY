// Procedural network of dirt paths carved into the terrain.
//
// A path is a winding polyline on the model-space xz plane. The terrain is
// pulled toward the path so that, near it, the surface is flat across the
// path's width and follows a *smoothed* version of the natural elevation along
// its length (a gentle, drivable grade rather than the raw bumpy ground).
//
// The network is built with a graph + A* pipeline so intersections are
// structural (paths share nodes) rather than accidental crossings:
//
//   1. Scatter points of interest with Poisson-disk sampling (even spacing,
//      no clusters, no holes), confined to the visible terrain.
//   2. Connect them with a Relative Neighborhood Graph -- mostly local links
//      with natural T-junctions and Y-forks, like a real trail network.
//   3. Trace each edge with A* over the height field, costing slope heavily so
//      paths hug contours and gentle grades and curve around hills.
//   4. Smooth the pixelated A* routes with Chaikin corner-cutting.
//
// Edges sort longest-first ("major" trails carved before "minor" ones) and a
// usage discount in the cost field nudges later routes to join existing ones,
// giving the branching, tree-like feel of hiking networks. Because edges share
// node cells, paths that meet do so at a common point.
//
// query(mx, my) is the hot path -- it runs once per terrain vertex and per
// mask texel -- so segments are bucketed into a uniform grid and points far
// from every path early-out in O(1).
export class PathNetwork {
    // =====================================================
    // Init
    // =====================================================

    constructor(opts) {
        this.size = opts.size; // terrain extent (world units), centred on origin
        this.seed = opts.seed >>> 0;
        this.num_nodes = Math.max(0, Math.round(opts.num_nodes)); // target points of interest
        this.half_width = opts.half_width; // fully-flat zone, measured from centerline
        this.shoulder = opts.shoulder; // falloff width blending back to natural ground
        this.smoothing = Math.max(0, Math.round(opts.smoothing)); // centerline smoothing window (vertices each side)
        this.slope_weight = opts.slope_weight; // how strongly A* avoids slopes (squared)
        this.natural_height_at = opts.natural_height_at; // (mx, my) -> raw terrain height

        this.build();
    }

    // =====================================================
    // Procedural generation
    // =====================================================

    build() {
        const half = this.size / 2;
        const margin = this.size * 0.04; // keep nodes (and splines) inside the edge
        this.bound = half - margin; // nodes live in [-bound, bound]^2 (model space)

        // Each polyline is a flat [x0,y0, x1,y1, ...] array of model-space points.
        this.polylines = [];

        this.build_cost_grid(); // height/noise/usage fields + A* scratch buffers
        const step_len = this.cell_size; // path vertex spacing ~ one cost-grid cell

        if (this.num_nodes >= 2) {
            const rand = mulberry32(this.seed);
            const nodes = this.sample_poisson_nodes(rand);
            if (nodes.length >= 2) {
                const edges = this.relative_neighborhood_graph(nodes);
                this.trace_edges(nodes, edges);
            }
        }

        this.compute_heights();
        this.build_segments(step_len);
    }

    // Cost grid covering the node region. The height field is sampled once per
    // cell (A* reads it millions of times); a small per-cell noise multiplier
    // breaks up overly clean curves; the usage field records where earlier
    // routes ran so later ones can be discounted toward joining them.
    build_cost_grid() {
        const span = 2 * this.bound;
        // Resolution: aim for ~45-unit cells, clamped so the buffers stay small.
        const TARGET_CELL = 45;
        this.ns = Math.max(64, Math.min(256, Math.round(span / TARGET_CELL)));
        this.cell_size = span / (this.ns - 1);

        const ns = this.ns;
        const cs = this.cell_size;
        const total = ns * ns;
        const h = new Float32Array(total);
        const noise = new Float32Array(total);

        // Independent PRNG for the cost noise so node layout (which consumes the
        // main stream) and the noise field don't perturb each other.
        const nrand = mulberry32(this.seed ^ 0x9e3779b9);
        const COST_NOISE = 0.12; // +/-12% per-cell cost jitter

        for (let r = 0; r < ns; r++) {
            const my = -this.bound + r * cs;
            for (let c = 0; c < ns; c++) {
                const mx = -this.bound + c * cs;
                const idx = r * ns + c;
                h[idx] = this.natural_height_at(mx, my);
                noise[idx] = 1 + COST_NOISE * (nrand() * 2 - 1);
            }
        }

        this.h_grid = h;
        this.noise_grid = noise;
        this.usage_grid = new Uint8Array(total);

        // A* scratch, allocated once and reset per search via a generation stamp.
        this.g_score = new Float64Array(total);
        this.seen = new Int32Array(total); // seen[idx] == gen means g_score is live
        this.closed = new Int32Array(total);
        this.came_from = new Int32Array(total);
        this.a_gen = 0;
        // Binary min-heap over cell indices, keyed by fScore. Lazy deletion can
        // re-push a cell once per in-neighbor (8-connectivity), so the heap can
        // hold up to 8 entries per cell; size it for that worst case.
        this.h_idx = new Int32Array(total * 8);
        this.h_f = new Float64Array(total * 8);
        this.h_size = 0;
    }

    // Poisson-disk sampling (Bridson) over the node region: every accepted point
    // is at least `radius` from the others, so the network is neither clustered
    // nor sparse. Returns up to num_nodes points as [x, y] pairs.
    sample_poisson_nodes(rand) {
        const span = 2 * this.bound;
        // Derive a spacing that yields roughly num_nodes points across the area.
        const radius = Math.max(this.cell_size * 1.5, (span / Math.sqrt(this.num_nodes)) * 0.85);
        const cell = radius / Math.SQRT2;
        const gw = Math.max(1, Math.ceil(span / cell));
        const grid = new Int32Array(gw * gw).fill(-1);
        const pts = [];
        const active = [];

        const grid_xy = (x, y) => [
            Math.min(gw - 1, Math.floor((x + this.bound) / cell)),
            Math.min(gw - 1, Math.floor((y + this.bound) / cell)),
        ];
        const fits = (x, y) => {
            if (x < -this.bound || x > this.bound || y < -this.bound || y > this.bound) return false;
            const [gx, gy] = grid_xy(x, y);
            for (let yy = Math.max(0, gy - 2); yy <= Math.min(gw - 1, gy + 2); yy++) {
                for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
                    const j = grid[yy * gw + xx];
                    if (j < 0) continue;
                    const dx = pts[j][0] - x;
                    const dy = pts[j][1] - y;
                    if (dx * dx + dy * dy < radius * radius) return false;
                }
            }
            return true;
        };
        const add = (x, y) => {
            const id = pts.length;
            pts.push([x, y]);
            const [gx, gy] = grid_xy(x, y);
            grid[gy * gw + gx] = id;
            active.push(id);
        };

        add((rand() * 2 - 1) * this.bound, (rand() * 2 - 1) * this.bound);

        const k = 30; // candidate attempts before a point is retired
        while (active.length && pts.length < this.num_nodes) {
            const ai = (rand() * active.length) | 0;
            const [bx, by] = pts[active[ai]];
            let placed = false;
            for (let t = 0; t < k; t++) {
                const ang = rand() * Math.PI * 2;
                const rr = radius * (1 + rand()); // annulus [radius, 2*radius)
                const nx = bx + Math.cos(ang) * rr;
                const ny = by + Math.sin(ang) * rr;
                if (fits(nx, ny)) {
                    add(nx, ny);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                active[ai] = active[active.length - 1];
                active.pop();
            }
        }
        return pts;
    }

    // Relative Neighborhood Graph: edge (i, j) exists iff no other node k is
    // closer to *both* than i and j are to each other. This keeps mostly-local
    // connections and produces natural T/Y junctions; it contains the minimum
    // spanning tree, so the network is always connected. O(n^3), fine for the
    // handful of nodes we scatter. Returns [i, j, dist] triples.
    relative_neighborhood_graph(nodes) {
        const n = nodes.length;
        const d2 = (a, b) => {
            const dx = nodes[a][0] - nodes[b][0];
            const dy = nodes[a][1] - nodes[b][1];
            return dx * dx + dy * dy;
        };
        const edges = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const dij = d2(i, j);
                let blocked = false;
                for (let kk = 0; kk < n; kk++) {
                    if (kk === i || kk === j) continue;
                    // r is "in the lune" if it is nearer to both endpoints.
                    if (d2(i, kk) < dij && d2(j, kk) < dij) {
                        blocked = true;
                        break;
                    }
                }
                if (!blocked) edges.push([i, j, Math.sqrt(dij)]);
            }
        }
        // Carve longer "major" trails first so shorter ones can branch into them
        // (via the usage discount in the cost field).
        edges.sort((a, b) => b[2] - a[2]);
        return edges;
    }

    // Trace every graph edge with A* over the cost grid and smooth the result
    // into a path polyline. Routes share node cells, so meeting paths coincide.
    trace_edges(nodes, edges) {
        for (const [i, j] of edges) {
            const sc = this.cell_of(nodes[i][0]);
            const sr = this.cell_of(nodes[i][1]);
            const gc = this.cell_of(nodes[j][0]);
            const gr = this.cell_of(nodes[j][1]);
            if (sc === gc && sr === gr) continue;

            const route = this.a_star(sc, sr, gc, gr);
            if (!route || route.length < 2) continue;

            // Record usage so later (shorter) edges are discounted toward this
            // route, encouraging branching joins rather than parallel paths.
            for (let p = 0; p < route.length; p++) this.usage_grid[route[p]] = 1;

            // Cell indices -> model-space points, then smooth.
            const raw = [];
            for (let p = 0; p < route.length; p++) {
                const idx = route[p];
                const c = idx % this.ns;
                const r = (idx - c) / this.ns;
                raw.push(-this.bound + c * this.cell_size, -this.bound + r * this.cell_size);
            }
            const smooth = chaikin(raw, 3);
            if (smooth.length >= 4) this.polylines.push(smooth);
        }
    }

    // Map a model-space coordinate to the nearest cost-grid column/row.
    cell_of(coord) {
        const c = Math.round((coord + this.bound) / this.cell_size);
        return c < 0 ? 0 : c >= this.ns ? this.ns - 1 : c;
    }

    // A* over the cost grid from (sc, sr) to (gc, gr) with 8-connectivity. Edge
    // cost is horizontal distance scaled by a squared-slope penalty (so gentle
    // grades are cheap and steep ones expensive), times a small noise jitter,
    // discounted where an earlier route already ran. The search is confined to
    // a window around the endpoints so detours stay local and it stays fast.
    // Returns an array of cell indices (start..goal) or null.
    a_star(sc, sr, gc, gr) {
        const ns = this.ns;
        const cs = this.cell_size;
        const h = this.h_grid;
        const noise = this.noise_grid;
        const usage = this.usage_grid;
        const sw = this.slope_weight;
        const DISCOUNT = 0.55; // cost multiplier for cells on an existing route

        // Search window: endpoints' bounding box expanded so contours can be
        // followed without wandering across the whole terrain.
        const pad = Math.max(6, Math.round(Math.max(Math.abs(gc - sc), Math.abs(gr - sr)) * 0.4));
        const min_c = Math.max(0, Math.min(sc, gc) - pad);
        const max_c = Math.min(ns - 1, Math.max(sc, gc) + pad);
        const min_r = Math.max(0, Math.min(sr, gr) - pad);
        const max_r = Math.min(ns - 1, Math.max(sr, gr) + pad);

        const gen = ++this.a_gen;
        const g = this.g_score;
        const seen = this.seen;
        const closed = this.closed;
        const came = this.came_from;
        this.h_size = 0;

        const heur = (c, r) => cs * Math.hypot(gc - c, gr - r);

        const start = sr * ns + sc;
        const goal = gr * ns + gc;
        g[start] = 0;
        seen[start] = gen;
        this.heap_push(start, heur(sc, sr));

        while (this.h_size > 0) {
            const cur = this.heap_pop();
            if (closed[cur] === gen) continue;
            closed[cur] = gen;
            if (cur === goal) break;

            const cc = cur % ns;
            const cr = (cur - cc) / ns;
            const h_cur = h[cur];
            const g_cur = g[cur];

            for (let dr = -1; dr <= 1; dr++) {
                const nr = cr + dr;
                if (nr < min_r || nr > max_r) continue;
                for (let dc = -1; dc <= 1; dc++) {
                    if (dc === 0 && dr === 0) continue;
                    const nc = cc + dc;
                    if (nc < min_c || nc > max_c) continue;
                    const nb = nr * ns + nc;
                    if (closed[nb] === gen) continue;

                    const horiz = cs * (dc && dr ? Math.SQRT2 : 1);
                    const slope = (h[nb] - h_cur) / horiz;
                    let cost = horiz * (1 + sw * slope * slope) * noise[nb];
                    if (usage[nb]) cost *= DISCOUNT;

                    const tentative = g_cur + cost;
                    if (seen[nb] !== gen || tentative < g[nb]) {
                        g[nb] = tentative;
                        came[nb] = cur;
                        seen[nb] = gen;
                        this.heap_push(nb, tentative + heur(nc, nr));
                    }
                }
            }
        }

        if (closed[goal] !== gen) return null;

        // Reconstruct start..goal.
        const route = [];
        let cur = goal;
        while (cur !== start) {
            route.push(cur);
            cur = came[cur];
        }
        route.push(start);
        route.reverse();
        return route;
    }

    // =====================================================
    // Binary min-heap (cell index keyed by fScore)
    // =====================================================

    heap_push(idx, f) {
        let i = this.h_size++;
        const h_idx = this.h_idx;
        const h_f = this.h_f;
        h_idx[i] = idx;
        h_f[i] = f;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (h_f[parent] <= h_f[i]) break;
            const ti = h_idx[i];
            h_idx[i] = h_idx[parent];
            h_idx[parent] = ti;
            const tf = h_f[i];
            h_f[i] = h_f[parent];
            h_f[parent] = tf;
            i = parent;
        }
    }

    heap_pop() {
        const h_idx = this.h_idx;
        const h_f = this.h_f;
        const top = h_idx[0];
        const n = --this.h_size;
        h_idx[0] = h_idx[n];
        h_f[0] = h_f[n];
        let i = 0;
        while (true) {
            const l = 2 * i + 1;
            const r = l + 1;
            let small = i;
            if (l < n && h_f[l] < h_f[small]) small = l;
            if (r < n && h_f[r] < h_f[small]) small = r;
            if (small === i) break;
            const ti = h_idx[i];
            h_idx[i] = h_idx[small];
            h_idx[small] = ti;
            const tf = h_f[i];
            h_f[i] = h_f[small];
            h_f[small] = tf;
            i = small;
        }
        return top;
    }

    // =====================================================
    // Centerline heights & segment grid
    // =====================================================

    // Sample the natural ground at every vertex, then take a moving average
    // along each polyline so the path's centerline is a gentle grade.
    compute_heights() {
        this.heights = [];
        for (const pts of this.polylines) {
            const n = pts.length / 2;
            const raw = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                raw[i] = this.natural_height_at(pts[i * 2], pts[i * 2 + 1]);
            }
            const w = this.smoothing;
            const smooth = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                let sum = 0;
                let count = 0;
                for (let k = -w; k <= w; k++) {
                    const j = i + k;
                    if (j < 0 || j >= n) continue;
                    sum += raw[j];
                    count++;
                }
                smooth[i] = sum / count;
            }
            this.heights.push(smooth);
        }
    }

    // Flatten all polylines into one segment soup and bucket the segments into
    // a uniform grid keyed by the area each segment can influence.
    build_segments(step_len) {
        const reach = this.half_width + this.shoulder;
        // ax, ay, bx, by plus the smoothed endpoint heights ha, hb.
        const ax = [],
            ay = [],
            bx = [],
            by = [],
            ha = [],
            hb = [];
        for (let pl = 0; pl < this.polylines.length; pl++) {
            const pts = this.polylines[pl];
            const h = this.heights[pl];
            for (let i = 0; i + 1 < pts.length / 2; i++) {
                ax.push(pts[i * 2]);
                ay.push(pts[i * 2 + 1]);
                bx.push(pts[(i + 1) * 2]);
                by.push(pts[(i + 1) * 2 + 1]);
                ha.push(h[i]);
                hb.push(h[i + 1]);
            }
        }
        this.seg = { ax, ay, bx, by, ha, hb };
        this.reach = reach;

        // Uniform grid spanning the terrain. Cell ~ a path step or the reach,
        // whichever is larger, so a segment touches only a handful of cells.
        const half = this.size / 2;
        this.grid_origin = -half;
        this.cell_size = Math.max(reach, step_len);
        this.grid_dim = Math.max(1, Math.ceil(this.size / this.cell_size) + 1);
        this.grid = new Array(this.grid_dim * this.grid_dim);

        for (let s = 0; s < ax.length; s++) {
            // Cells overlapped by the segment's bounding box, expanded by reach.
            const min_x = Math.min(ax[s], bx[s]) - reach;
            const max_x = Math.max(ax[s], bx[s]) + reach;
            const min_y = Math.min(ay[s], by[s]) - reach;
            const max_y = Math.max(ay[s], by[s]) + reach;
            const c0 = this.cell_index(min_x);
            const c1 = this.cell_index(max_x);
            const r0 = this.cell_index(min_y);
            const r1 = this.cell_index(max_y);
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    const key = r * this.grid_dim + c;
                    (this.grid[key] || (this.grid[key] = [])).push(s);
                }
            }
        }
    }

    cell_index(coord) {
        const c = Math.floor((coord - this.grid_origin) / this.cell_size);
        return c < 0 ? 0 : c >= this.grid_dim ? this.grid_dim - 1 : c;
    }

    // =====================================================
    // Query
    // =====================================================

    // Path influence at a model-space point. influence is 1 on the path
    // centerline strip, smoothstep-falls to 0 across the shoulder, and is 0
    // beyond. target_height is the height to pull toward.
    //
    // Where paths meet, several segments are in range at once. Picking only the
    // nearest would make target_height jump as the nearest flips between paths
    // (a stair-step at junctions). Instead the segments' heights are blended
    // with a continuous proximity weight (zero at reach), so target_height
    // varies smoothly across a junction while influence stays the max (paths
    // keep their full flat width). Returns the shared result object.
    query(mx, my) {
        const out = this._out || (this._out = { influence: 0, target_height: 0, dist: 0 });
        out.influence = 0;
        out.target_height = 0;
        out.dist = this.reach; // distance to the nearest path centerline, clamped to reach

        const bucket = this.grid[this.cell_index(my) * this.grid_dim + this.cell_index(mx)];
        if (!bucket) return out;

        const s = this.seg;
        const reach = this.reach;
        const reach2 = reach * reach;
        let max_inf = 0;
        let min_d = reach;
        let sum_w = 0;
        let sum_wh = 0;
        for (let k = 0; k < bucket.length; k++) {
            const i = bucket[k];
            const dx = s.bx[i] - s.ax[i];
            const dy = s.by[i] - s.ay[i];
            const len2 = dx * dx + dy * dy;
            let t = len2 > 0 ? ((mx - s.ax[i]) * dx + (my - s.ay[i]) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const cx = s.ax[i] + t * dx;
            const cy = s.ay[i] + t * dy;
            const ddx = mx - cx;
            const ddy = my - cy;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 >= reach2) continue; // outside this segment's influence

            const d = Math.sqrt(d2);
            if (d < min_d) min_d = d;
            const seg_h = s.ha[i] + t * (s.hb[i] - s.ha[i]);

            // Flattening strength for this segment (1 inside the flat strip,
            // smoothstep down across the shoulder); the strongest one wins.
            let inf;
            if (d <= this.half_width) {
                inf = 1;
            } else {
                const x = (d - this.half_width) / this.shoulder; // 0..1 across shoulder
                inf = 1 - x * x * (3 - 2 * x); // smoothstep down
            }
            if (inf > max_inf) max_inf = inf;

            // Proximity weight for the height blend: continuous and zero at
            // reach, so the blended height has no discontinuity at junctions.
            const w = reach - d;
            sum_w += w;
            sum_wh += w * seg_h;
        }

        out.dist = min_d;
        if (sum_w <= 0) return out;
        out.influence = max_inf;
        out.target_height = sum_wh / sum_w;
        return out;
    }
}

// =====================================================
// Helpers
// =====================================================

// Chaikin corner-cutting: replace each interior span by points at 1/4 and 3/4,
// rounding off the 8-directional A* staircase into a smooth curve. The first
// and last points are kept fixed so shared path endpoints stay coincident
// (junctions don't drift apart). pts is a flat [x0,y0, x1,y1, ...] array.
function chaikin(pts, iterations) {
    let cur = pts;
    for (let it = 0; it < iterations; it++) {
        const n = cur.length / 2;
        if (n < 3) break;
        const out = [cur[0], cur[1]];
        for (let i = 0; i + 1 < n; i++) {
            const ax = cur[i * 2],
                ay = cur[i * 2 + 1];
            const bx = cur[(i + 1) * 2],
                by = cur[(i + 1) * 2 + 1];
            out.push(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by);
            out.push(0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by);
        }
        out.push(cur[(n - 1) * 2], cur[(n - 1) * 2 + 1]);
        cur = out;
    }
    return cur;
}

// Small, fast seeded PRNG (mulberry32) -> deterministic paths per seed.
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
