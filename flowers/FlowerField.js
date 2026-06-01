import { CGFshader } from "../lib/CGF.js";
import { Chrysantemum } from "./chrysantemum/Chrysantemum.js";
import { Tulip } from "./tulip/Tulip.js";
import { BakedMesh } from "./common/BakedMesh.js";
import { ValueNoise } from "../terrain/Noise.js";
import { hexToRGB } from "../utils.js";

// Procedural flower field scattered over the terrain's grass.
//
// Performance note: an L-system flower at full detail is hundreds of GL draws
// (a chrysanthemum at 4 iterations expands to ~120 draw symbols, and each
// flower symbol draws ten petals). One unique plant per scatter point is far
// too expensive, so the field keeps a tiny POOL of prototype flowers and reuses
// them at every point -- the matrix changes per draw, the geometry does not.
//
// Each prototype is also baked once (buildPrototypes -> bakePrototype): its
// whole L-system is flattened into a handful of static merged meshes, one per
// material. A flower instance then costs ~3 GL draws (stem, leaf, bloom)
// regardless of L-system depth or petal count, instead of replaying hundreds
// of draws per flower -- the difference between a few thousand and ~100k draw
// calls a frame at the field's budget.
//
// Placement is deterministic: a cell grid is hashed so a given patch of ground
// always grows the same flowers, no popping or jitter as the wagon drives. A
// low-frequency value-noise density field gives the "some sparse, some in
// bunches" look -- high noise = dense clusters. A guaranteed base count per
// cell keeps the grass from ever going completely bare.
//
// There is no level-of-detail: every flower is drawn from the same single-tier
// prototype pool at a fixed geometry detail, so a flower never gains, sheds, or
// swaps detail as the wagon (and the chase camera that follows it) moves near.
// Flowers simply fade in/out at the draw radius; their look never changes.
export class FlowerField {
    constructor(scene, terrain) {
        this.scene = scene;
        this.terrain = terrain;

        this.enabled = true;

        // Set true by the shadow pass (ShadowMap.castFlowers): the field then emits
        // only its baked geometry under the active depth shader, so the flowers cast
        // into the wagon-following near map instead of lighting themselves.
        this._depth_pass = false;

        // Shadow-aware, untextured shader the field is lit with in the main pass.
        // It receives the sun/moon and all three shadow maps (terrain, near, wagon)
        // exactly like the terrain and wagon-cargo shaders, plus a per-group colour.
        this.shadowShader = new CGFshader(scene.gl, "flowers/shaders/flower.vert", "flowers/shaders/flower.frag");

        // -- Scatter grid & density --
        // The field reads as broad flowering grass with denser bunches mixed in:
        // every grass cell grows at least base_per_cell flowers, and cells where
        // the density noise is high ramp up toward max_per_cell (a tight bunch).
        this.cell_size = 50; // world units per scatter cell
        this.base_per_cell = 3; // flowers every grass cell grows (broad coverage)
        this.max_per_cell = 9; // flowers a fully-saturated cell spawns (bunch density)
        this.density_scale = 0.001; // noise frequency: smaller = larger bunches
        this.density_bias = 0.65; // noise above this starts ramping toward a bunch
        this.grass_threshold = 0.85; // terrain path_dist above this counts as open grass

        // -- Draw reach (world units from the wagon) --
        // A single flat radius: every grass flower within it is drawn at full
        // detail, nothing beyond. No distance tiers, no distance thinning.
        this.draw_radius = 600;

        // Safety cap on flowers drawn per frame. Cells are visited nearest-first
        // so the cap, if ever hit, only trims the most distant flowers.
        this.draw_budget = 800;

        // -- Size --
        this.base_scale = 1.7; // before per-flower jitter

        // Deterministic noise sources: one shapes the density patches, one drives
        // per-instance hashes (position jitter, rotation, scale, variant choice).
        this.density_noise = new ValueNoise(20260531);
        this.rng = new ValueNoise(1973);

        // Scatter cache: a cell's flowers (position, variant, height, scale,
        // rotation) depend only on its coordinates, never on the wagon, so each
        // cell is scattered once -- hashes, density noise and the heavy terrain
        // sampling (getHeightAt/sample_at_model) run on first visit and are
        // reused forever. Bounded by the (finite) terrain extent. Keyed "cx,cz".
        this._cell_cache = new Map();

        this.buildPrototypes();
    }

    // The curated palette of distinct flower variants the field scatters. Each
    // entry is a hand-picked type + bloom colour + stem tint combination, so the
    // pool reads as a varied wild meadow rather than a few repeated plants. The
    // mix of tulips and chrysanthemums and warm/cool blooms is deliberate; add or
    // reorder entries here to change the field's look. POOL tracks its length.
    static VARIANTS = [
        { type: "tulip",        flower: "#e63333", stem: "#4d9933" }, // red tulip
        { type: "tulip",        flower: "#ffd633", stem: "#266619" }, // yellow tulip
        { type: "tulip",        flower: "#9933cc", stem: "#4d9933" }, // purple tulip
        { type: "tulip",        flower: "#ff9911", stem: "#266619" }, // orange tulip
        { type: "tulip",        flower: "#ff66b3", stem: "#4d9933" }, // pink tulip
        { type: "tulip",        flower: "#f2f2f2", stem: "#266619" }, // white tulip
        { type: "tulip",        flower: "#e6228c", stem: "#4d9933" }, // magenta tulip
        { type: "chrysantemum", flower: "#cc0033", stem: "#3d7a1a" }, // red mum
        { type: "chrysantemum", flower: "#ffcc33", stem: "#1f4d0a" }, // yellow mum
        { type: "chrysantemum", flower: "#ff6699", stem: "#3d7a1a" }, // pink mum
        { type: "chrysantemum", flower: "#c299ff", stem: "#1f4d0a" }, // lavender mum
        { type: "chrysantemum", flower: "#ff7755", stem: "#3d7a1a" }, // coral mum
        { type: "chrysantemum", flower: "#fff0f0", stem: "#1f4d0a" }, // white mum
        { type: "chrysantemum", flower: "#8c1f3d", stem: "#3d7a1a" }, // burgundy mum
    ];

    // A reused pool, built once at a single fixed detail -- one baked prototype
    // per entry in VARIANTS, so the field's colour/type variety is exactly that
    // table.
    //
    // Each prototype's L-system is then *baked* into a handful of static meshes
    // (one per material). Replaying an L-system per flower is hundreds of GL
    // draws -- a single chrysanthemum head alone is rings*petals petals -- so at
    // 1200 flowers/frame the field would issue tens of thousands of draw calls.
    // Baking collapses one flower to ~3 draws (stem, leaf, bloom), independent
    // of L-system depth or petal count.
    buildPrototypes() {
        this.POOL = FlowerField.VARIANTS.length;
        this.proto = [];
        this.baked = [];
        for (let i = 0; i < this.POOL; i++) {
            const f = this.makeVariant(i);
            this.proto.push(f);
            this.baked.push(this.bakePrototype(f));
        }
    }

    makeVariant(i) {
        const v = FlowerField.VARIANTS[i];
        const isTulip = v.type === "tulip";
        const f = isTulip ? new Tulip(this.scene) : new Chrysantemum(this.scene);

        // Pin this prototype's colours to the curated combo (the constructors
        // pick a random palette colour; override before the re-init below so the
        // baked mesh carries our chosen bloom/stem tint instead).
        f.flowerColor = hexToRGB(v.flower, false);
        f.stemColor = hexToRGB(v.stem, false);

        f.iterations = 2;
        f.flower_petals = 8;
        if (!isTulip) f.flower_rings = 3;
        // At 2 iterations the L-system's internal scale (scaleFactor^(iter-1)) is
        // ~2.8x larger than at the showcase's 4 iterations, which would blow the
        // leaves up out of proportion with the bloom. Shrink them to compensate.
        f.leaf_scale = isTulip ? 1.2 : 0.8;
        f.init(); // rebuild the L-system + blooms at this detail (and colours)
        return f;
    }

    // Walk a prototype once and merge every primitive it would draw into static
    // meshes grouped by material. Rather than re-derive the L-system + bloom
    // layout (and risk drift from the real geometry), we temporarily replace
    // each leaf primitive's display() with a capture that records the current
    // model matrix and appends that primitive's transformed vertices -- so the
    // baked mesh is exactly what display() would have drawn.
    bakePrototype(proto) {
        const scene = this.scene;

        // One accumulation group per material instance. Stem and leaf carry
        // their own (matching) stem material; the bloom's petals carry the
        // flower material -- so a flower bakes down to ~3 meshes.
        const groups = [];
        const groupFor = (material) => {
            let g = groups.find(x => x.material === material);
            if (!g) { g = { material, vertices: [], normals: [], indices: [] }; groups.push(g); }
            return g;
        };

        // Transform a primitive's local verts/normals by the live model matrix
        // (column-major mat4) and append them to its material group.
        const append = (group, prim, m) => {
            const base = group.vertices.length / 3;
            const v = prim.vertices, nrm = prim.normals;
            for (let i = 0; i < v.length; i += 3) {
                const x = v[i], y = v[i + 1], z = v[i + 2];
                group.vertices.push(
                    m[0] * x + m[4] * y + m[8] * z + m[12],
                    m[1] * x + m[5] * y + m[9] * z + m[13],
                    m[2] * x + m[6] * y + m[10] * z + m[14],
                );
                const nx = nrm[i], ny = nrm[i + 1], nz = nrm[i + 2];
                const tx = m[0] * nx + m[4] * ny + m[8] * nz;
                const ty = m[1] * nx + m[5] * ny + m[9] * nz;
                const tz = m[2] * nx + m[6] * ny + m[10] * nz;
                const len = Math.hypot(tx, ty, tz) || 1;
                group.normals.push(tx / len, ty / len, tz / len);
            }
            const idx = prim.indices;
            for (let i = 0; i < idx.length; i++) group.indices.push(base + idx[i]);
        };

        // Swap each leaf primitive's draw for a capture. The Flower symbol "F"
        // is a composite that draws Petals through its own petal object, so we
        // hook that petal (with the flower material) rather than the Flower.
        const captures = [];
        const hook = (prim, material) => {
            const group = groupFor(material);
            const orig = prim.display;
            prim.display = () => append(group, prim, scene.activeMatrix);
            captures.push({ prim, orig });
        };
        for (let j = 0; j < proto.grammar.length; j++) {
            const prim = proto.primitives[j];
            if (proto.grammar[j] === "F") hook(prim.petal, prim.material);
            else hook(prim, prim.material);
        }

        // Replay the prototype in its own local space, then restore the draws.
        scene.pushMatrix();
        scene.loadIdentity();
        proto.display();
        scene.popMatrix();
        for (const c of captures) c.prim.display = c.orig;

        // A primitive that never appears in the expansion (e.g. a leaf the
        // grammar didn't grow) leaves an empty group -- skip it, no draw.
        //
        // Bake the material's flat colour (RGB of its diffuse) straight into the
        // mesh as a per-vertex attribute: the field is lit by its own shadow
        // shader, not the CGFappearance, so a group is a single coloured draw with
        // no per-draw uniform or appearance apply.
        return groups
            .filter(g => g.indices.length > 0)
            .map(g => new BakedMesh(
                scene, g.vertices, g.normals, g.indices,
                [g.material.diffuse[0], g.material.diffuse[1], g.material.diffuse[2]],
            ));
    }

    // =====================================================
    // Normal visualization (delegated to every prototype)
    // =====================================================

    forEachProto(fn) {
        for (const f of this.proto) fn(f);
    }

    // Viz the baked meshes, not the prototypes -- the field renders the baked
    // geometry, so the prototypes are never drawn.
    forEachBaked(fn) {
        for (const groups of this.baked) {
            for (const mesh of groups) fn(mesh);
        }
    }

    enableNormalViz() {
        this.forEachBaked(m => m.enableNormalViz());
    }

    disableNormalViz() {
        this.forEachBaked(m => m.disableNormalViz());
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        if (!this.enabled) return;

        const scene = this.scene;

        // Main pass: bind the shadow-aware flower shader once and feed it the
        // scene's sun/moon + shadow-map uniforms. These are identical for every
        // flower, so they're set here once rather than per draw; only the per-group
        // colour (and the per-instance matrices) change inside the draw loop.
        //
        // Depth pass (ShadowMap.castFlowers): leave the active depth shader in
        // place and just emit the baked geometry, so the flowers cast into the
        // near map. No shader/uniform work, no per-group colour.
        if (!this._depth_pass) {
            scene.setActiveShader(this.shadowShader);
            const sm = scene.shadow_map;
            if (sm) {
                if (sm.enabled) sm.applyUniforms(this.shadowShader);
                else sm.disable(this.shadowShader);
            }
        }

        // Centre the field on the wagon, like the terrain (the chase camera
        // follows it). World XZ; the terrain's model frame is (x, -z).
        const wx = scene.wagon ? scene.wagon.position_x : 0;
        const wz = scene.wagon ? scene.wagon.position_z : 0;

        const cs = this.cell_size;
        const reach = Math.ceil(this.draw_radius / cs);
        const wcx = Math.round(wx / cs);
        const wcz = Math.round(wz / cs);

        const count = { n: 0 };

        // Visit cells nearest-first (cached order) so the budget cap, when hit,
        // trims its most distant flowers rather than its nearest.
        const cells = this.cellOrder(reach);
        for (const [dx, dz] of cells) {
            if (count.n >= this.draw_budget) break;
            this.drawCell(wcx + dx, wcz + dz, wx, wz, count);
        }
    }

    // Offsets (dx, dz) of every cell within `reach`, sorted by distance from the
    // centre cell. Cached per reach value.
    cellOrder(reach) {
        if (this._cell_order_reach === reach) return this._cell_order;
        const cells = [];
        for (let dz = -reach; dz <= reach; dz++) {
            for (let dx = -reach; dx <= reach; dx++) cells.push([dx, dz]);
        }
        cells.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
        this._cell_order = cells;
        this._cell_order_reach = reach;
        return cells;
    }

    // The deterministic flower instances for a cell, scattered once and cached.
    // Everything here -- density count, per-instance hashes, the terrain bounds
    // and grass test, the sampled height -- depends only on the cell's world
    // coordinates, so the result never changes and is reused on every later
    // visit. Returns an array of { px, pz, y, variant, scl, rot }.
    cellInstances(cx, cz) {
        const key = cx + "," + cz;
        let inst = this._cell_cache.get(key);
        if (inst) return inst;
        inst = this.buildCell(cx, cz);
        this._cell_cache.set(key, inst);
        return inst;
    }

    // Scatter one cell from scratch (called once per cell, on first visit).
    buildCell(cx, cz) {
        const cs = this.cell_size;
        const cell_x = cx * cs;
        const cell_z = cz * cs;

        // Density patch for this cell: low-frequency fBm. Every cell grows the
        // base count; above the bias the count ramps up toward max_per_cell so
        // some patches read as tight bunches.
        const dens = this.density_noise.fbm(cell_x * this.density_scale, cell_z * this.density_scale, 4);
        const strength = dens - this.density_bias;
        const denom = Math.max(0.05, 0.85 - this.density_bias);
        const extra = strength > 0
            ? Math.ceil((this.max_per_cell - this.base_per_cell) * Math.min(1, strength / denom))
            : 0;
        const count_in_cell = this.base_per_cell + extra;

        const terrain = this.terrain;
        const half = terrain.half_extent;
        const H = this.rng;

        const out = [];
        for (let k = 0; k < count_in_cell; k++) {
            // Deterministic per-instance hashes in [0, 1].
            const hx = H.hash(cx * 7 + k * 101, cz * 13 + k * 131);
            const hz = H.hash(cx * 17 + k * 53, cz * 19 - k * 97);
            const hr = H.hash(cx * 23 - k * 61, cz * 29 + k * 89);
            const hs = H.hash(cx * 31 + k * 43, cz * 37 - k * 71);
            const hv = H.hash(cx * 41 - k * 59, cz * 43 + k * 67);

            const px = cell_x + (hx - 0.5) * cs;
            const pz = cell_z + (hz - 0.5) * cs;

            // Stay on the terrain and only on open grass (skip paths/clearing dirt).
            if (px < -half || px > half || pz < -half || pz > half) continue;
            const sample = terrain.sample_at_model(px, -pz); // reused scratch: read immediately
            if (sample.path_dist < this.grass_threshold) continue;

            const variant = Math.min(this.POOL - 1, (hv * this.POOL) | 0);
            const y = terrain.getHeightAt(px, pz);
            const scl = this.base_scale * (0.75 + hs * 0.6);
            const rot = hr * Math.PI * 2;

            out.push({ px, pz, y, variant, scl, rot });
        }
        return out;
    }

    // Draw one cell's (cached) flowers, accumulating the global draw count
    // (mutated in place) against the per-frame budget. The only per-frame work
    // is the flat distance cull and the matrix/draw emission.
    drawCell(cx, cz, wx, wz, count) {
        const scene = this.scene;
        const inst = this.cellInstances(cx, cz);

        for (let i = 0; i < inst.length; i++) {
            if (count.n >= this.draw_budget) return;
            const f = inst[i];

            // Flat draw reach: cull anything past the radius, same detail inside.
            if (Math.hypot(f.px - wx, f.pz - wz) > this.draw_radius) continue;

            const baked = this.baked[f.variant];
            scene.pushMatrix();
            scene.translate(f.px, f.y, f.pz);
            scene.rotate(f.rot, 0, 1, 0);
            scene.scale(f.scl, f.scl, f.scl);
            // Baked: ~3 draws per flower (stem, leaf, bloom) instead of replaying
            // the whole L-system. Each group carries its own flat colour as a
            // baked vertex attribute, so there is no per-draw uniform work in
            // either pass -- just emit the geometry.
            for (const mesh of baked) mesh.display();
            scene.popMatrix();

            count.n++;
        }
    }
}
